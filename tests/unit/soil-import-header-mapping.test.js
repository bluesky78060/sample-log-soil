import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SLS-1-230: 자동매핑 제외 목록 + 날짜 셀 정규화
//
// 🚨 사용자가 만든 서식을 실제 코드에 넣어 돌려 보다 찾은 결함이다.
//    `필지구분`(본필지/하위필지)과 `경지구분`(1차)이 subCategory('구분' = 논/밭/과수/시설)에
//    붙어, 저장된 레코드의 구분에 "예) 필지" / "농가의뢰"가 들어갔다.
//    구분이 오염되면 흙토람 내보내기와 성토 판별이 함께 어긋난다.
//
// ⚠️ 이 파일의 절반은 **과잉 차단을 막는 테스트**다. 키워드를 넓게 막으면
//    지금 잘 되던 서식이 조용히 매핑을 잃는다. 막는 것과 막지 않는 것을 함께 고정한다.

let fns
beforeAll(async () => {
    await import('../../src/shared/sanitize.js')
    await import('../../src/soil/soil-result-importer.js')
    fns = window.SoilResultImporter?._fns
    expect(fns, '_fns가 노출되지 않았다').toBeTruthy()
})

/** 헤더 하나만 놓고 어떤 필드에 붙는지 본다 */
const mapOne = (header) => {
    const m = fns.computeAutoMapping([header])
    const hit = Object.entries(m).find(([, i]) => i === 0)
    return hit ? hit[0] : null
}

describe('막는 것 — 조용히 틀린 값이 들어가던 헤더', () => {
    // 🚨 본필지/하위필지는 접수번호로 판별한다(503 / 503-1). 대응 필드가 없다.
    it('1. 필지구분은 어디에도 매핑되지 않는다', () => {
        expect(mapOne('필지구분'), '필지구분이 어딘가에 매핑됐다').toBeNull()
    })

    // ⚠️ 제외 목록은 사람이 읽는 표기('경지구분 1차')로 적혀 있고 normalizeHeader로 맞춘다.
    //    정규화를 빼면 헤더 '경지구분1차'와 어긋나 새어 나간다.
    //    (처음엔 목록을 이미 정규화된 형태로 적어 둬서 이 단언이 아무것도 구분하지 못했다.)
    it('2. 표기 변형도 함께 막힌다', () => {
        for (const h of ['필지 구분', '필지-구분', ' 필지구분 ', '필지(구분)', '필지유형', '본필지구분']) {
            expect(mapOne(h), `'${h}'가 새어 나갔다`).toBeNull()
        }
    })

    // ⚠️ SLS-1-234에서 계약이 바뀌었다. 경지구분 = **1차**(자체/대표필지/농가의뢰/공익직불제)이고
    //    이제 landClass1 필드가 생겨 거기에 붙는다. 예전에는 대응 필드가 없어 막았을 뿐이다.
    //    지켜야 할 것은 그대로다 — **구분(2차)에 붙으면 안 된다.**
    it('3. 경지구분 계열은 1차에 붙고, 구분(2차)에는 절대 안 붙는다', () => {
        for (const h of ['경지구분', '경지구분1차', '경지구분 1차', '경지구분1', '*경지구분']) {
            expect(mapOne(h), `'${h}'가 1차에 안 붙었다`).toBe('landClass1')
        }
    })
})

describe('막지 않는 것 — 과잉 차단 방지', () => {
    // 🚨 '구분' 키워드를 지우는 방식으로 고쳤다면 여기서 죽는다.
    //    헤더가 그냥 '구분'인 서식이 잘 동작 중이다.
    it('4. 구분 단독 헤더는 여전히 subCategory다', () => {
        expect(mapOne('구분'), "'구분'까지 막아 기존 서식이 깨졌다").toBe('subCategory')
    })

    // 🚨 1차 키워드('지구분','경지구분')가 2차를 가로채기 쉽다 —
    //    '경지구분2차'는 둘 다 부분 포함이라 **길이가 승부를 가른다**(지구분 3 > 구분 2).
    //    그래서 2차 표기를 완전일치로 못박아 두었다.
    it('5. 경지구분2차 계열은 정확히 우리 subCategory다', () => {
        for (const h of ['경지구분2차', '경지구분 2차', '경지구분2', '경지2차']) {
            expect(mapOne(h), `'${h}'가 1차에 끌려갔다`).toBe('subCategory')
        }
    })

    it('6. 지목·전답구분 같은 기존 키워드는 그대로 동작한다', () => {
        expect(mapOne('지목')).toBe('subCategory')
        expect(mapOne('전답구분')).toBe('subCategory')
        expect(mapOne('시료구분')).toBe('subCategory')
    })
})

// ══════════════════════════════════════════════════════════════
// SLS-1-240 — 지번주소에 '대상지'(흙토람 용어) 포함
//
// 🚨 키워드 한 줄 추가로 끝나지 않는다. '대상지'는 **접두사**로 걸려
//    '대상지면적'·'대상지 시도'까지 지번주소로 끌어온다(AFFIX 503).
//    막지 않으면 **면적 숫자가 주소 칸에 저장**되고 '경상북도'만 지번주소가 된다.
//    셋(키워드·면적 완전일치·denylist)이 한 세트다.
// ══════════════════════════════════════════════════════════════
describe("'대상지'를 지번주소로 읽는다", () => {
    it('13. 대상지 단독 헤더가 지번주소에 붙는다 (요청)', () => {
        expect(mapOne('대상지'), "'대상지'를 못 읽는다").toBe('lotAddress')
    })

    // 🚨 이걸 놓치면 면적(숫자)이 지번주소로 저장된다. 미리보기에는 값이 채워져 있어
    //    매핑된 것처럼 보이므로 **조용하다.**
    it('14. 대상지면적은 면적에 남는다 — 주소로 끌려가지 않는다', () => {
        for (const h of ['대상지면적(㎡)', '대상지면적']) {
            expect(mapOne(h), `'${h}'가 지번주소로 끌려갔다 — 면적 숫자가 주소가 된다`).toBe('area')
        }
    })

    // ⚠️ 매핑 결과만 보면 greedy 할당에 가려 **왜** 이겼는지 알 수 없다.
    //    등급(EXACT 1000 vs AFFIX 500)이 뒤집히는 변이를 여기서 직접 잡는다.
    it('15. 대상지면적에서 면적 점수가 지번주소 점수를 이긴다', () => {
        const nh = fns.normalizeHeader('대상지면적(㎡)')
        // 🚨 완전일치가 성립하려면 정규화가 괄호·기호를 떼어내야 한다.
        //    이 전제가 깨지면 방어가 통째로 무너지는데 매핑 결과만 보면 이유를 모른다.
        expect(nh, '정규화 결과가 달라져 완전일치가 깨졌다').toBe('대상지면적')

        const scoreOf = (key) => {
            const field = fns.TARGET_FIELDS.find((f) => f.key === key)
            return fns.scoreFieldHeader(field._autoNorm, nh)
        }
        expect(scoreOf('area'), '면적이 지번주소를 못 이긴다').toBeGreaterThan(scoreOf('lotAddress'))
    })

    // 🚨 흙토람은 주소를 시도/시군구/읍면동/리로 나눠 놓는다. 우리 지번주소는 한 칸이라
    //    조각이 붙으면 반쪽 데이터가 된다.
    //
    // ⚠️ 이 목록은 손으로 적으면 빠진다 — 계획 1차에서 '대상지 일반·산'을 빠뜨려
    //    리뷰에서 반려됐다. 실제 헤더 상수로 mergeHeaderRows를 돌려 뽑은 9종이다.
    it('16. 분할된 주소 조각은 어디에도 안 붙는다', () => {
        for (const h of [
            '대상지 시도', '대상지 시군구', '대상지 읍면동', '대상지 리', '대상지 일반·산',
            '*대상지 주소 시도', '*대상지 주소 시군구', '*대상지 주소 읍면동', '*대상지 주소 리',
        ]) {
            expect(mapOne(h), `'${h}'가 매핑됐다 — 반쪽 주소가 들어간다`).toBeNull()
        }
    })

    // ⚠️ 지금도 '지번' 키워드로 붙는다. 이번 변경으로 생긴 문제가 아니므로
    //    **일부러 건드리지 않았다.** 넣으면 기존 동작을 조용히 바꾸는 것이 된다.
    it('16-b. 대상지 지번1/2는 기존대로 지번주소에 붙는다 (건드리지 않았다는 고정)', () => {
        for (const h of ['대상지 지번 1', '대상지 지번 2']) {
            expect(mapOne(h), `'${h}' 동작을 바꿨다`).toBe('lotAddress')
        }
    })

    // 🚨 denylist를 넓게 잡거나 키워드를 건드리면 **지금 잘 되던 서식이 조용히 매핑을 잃는다.**
    it('17. 기존 지번주소 키워드가 전부 그대로다 — 과잉 차단 방지', () => {
        for (const h of ['지번주소', '지번', '소재지', '토지소재지', '필지주소', '경작지',
                         '농지주소', '주소', '대상지 주소', '*대상지 주소', '대상지주소']) {
            expect(mapOne(h), `'${h}'가 매핑을 잃었다`).toBe('lotAddress')
        }
    })

    it('18. 기존 면적 키워드도 그대로다', () => {
        for (const h of ['면적', '면적(㎡)', '재배면적', '경작면적', '필지면적']) {
            expect(mapOne(h), `'${h}'가 매핑을 잃었다`).toBe('area')
        }
    })

    // 같은 키워드가 두 필드에 들어가면 매핑이 상황에 따라 흔들린다
    it('19. 키워드 중복 감사에 걸리지 않는다', () => {
        expect(fns.auditDuplicateKeywords(), '두 필드에 같은 키워드가 들어갔다').toEqual([])
    })

    // ══════════════════════════════════════════════════════════════
    // 🚨 위 16번은 목록을 **테스트에 다시 적어** 검사한다. 양식 상수가 바뀌어
    //    새 조각이 생겨도 그대로 통과한다 — 이 티켓에서 실제로 겪은 실패 방식이다
    //    (계획 1차에서 손으로 적다가 '대상지 일반·산'을 빠뜨렸다).
    //
    //    그래서 여기서는 **실제 양식 상수로 병합을 돌려** 검사한다. 흙토람 양식이
    //    바뀌어 새 분할 조각이 생기면 목록을 안 고쳐도 여기서 빨간 불이 켜진다.
    // ══════════════════════════════════════════════════════════════
    describe('실제 양식 상수로 다시 검사한다 (목록이 낡는 것을 막는다)', () => {
        const SRC = readFileSync(resolve(process.cwd(), 'src/heuktoram/heuktoram-script.js'), 'utf8')
        const objOf = (name) => {
            const m = SRC.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\});`))
            if (!m) throw new Error(`${name}을 못 찾았다 — 흙토람 소스 구조가 바뀌었다`)
            return eval(`(${m[1]})`)
        }
        const toArr = (o, n) => {
            const a = new Array(n).fill('')
            for (const [k, v] of Object.entries(o)) a[+k] = v
            return a
        }

        it.each([
            ['토양 41열', 'HEUKTORAM_WS_HEADER3', 'HEUKTORAM_WS_HEADER4', 41],
            ['공익직불제', 'GONGIK_WS_HEADER2', 'GONGIK_WS_HEADER3', 40],
        ])('20. %s 양식의 분할 주소 조각이 지번주소를 차지하지 않는다', (_l, h3, h4, cols) => {
            const merged = fns.mergeHeaderRows(toArr(objOf(h3), cols), toArr(objOf(h4), cols))
            const mapping = fns.computeAutoMapping(merged)

            // 이 양식에 '대상지' 계열이 실제로 있는지부터 — 없으면 검사가 빈 것이다
            const targets = merged.filter((h) => fns.normalizeHeader(h).includes('대상지'))
            expect(targets.length, `${_l}: '대상지' 열이 없다 — 이 테스트가 아무것도 검사하지 않았다`)
                .toBeGreaterThan(0)

            const lotHeader = mapping.lotAddress != null ? String(merged[mapping.lotAddress]) : ''
            expect(
                fns.normalizeHeader(lotHeader),
                `${_l}: 분할 주소 조각 '${lotHeader}'이 지번주소를 차지했다 — denylist에 없는 새 조각이다`
            ).not.toMatch(/(시도|시군구|읍면동|리|일반산)$/)

            // 면적도 함께 — '대상지면적'이 주소로 끌려가지 않았는가
            if (mapping.area != null) {
                expect(String(merged[mapping.area]), `${_l}: 면적 열이 엉뚱하다`).toMatch(/면적/)
            }
        })
    })
})

describe('채취년월일', () => {
    // 기존 '채취일'·'채취일자'는 '채취년월일'의 부분 문자열이 아니라 안 잡혔다
    it('7. 채취년월일 → 접수일자', () => {
        for (const h of ['채취년월일', '채취연월일', '시료채취년월일']) {
            expect(mapOne(h), `'${h}'를 못 읽는다`).toBe('date')
        }
    })

    it('기존 날짜 키워드는 그대로', () => {
        for (const h of ['접수일자', '채취일', '채취일자', '분석의뢰일']) {
            expect(mapOne(h)).toBe('date')
        }
    })
})

describe('제외는 자동 추정에만 적용된다', () => {
    // 사용자가 직접 고르는 수동 매핑까지 막으면 우회로가 없어진다
    it('8. buildRecord는 제외 헤더 열도 매핑해 주면 읽는다', () => {
        const rec = fns.buildRecord(['논'], { subCategory: 0 }, '농가의뢰')
        expect(rec.subCategory, '수동 매핑까지 막혔다').toBe('논')
    })
})

describe('날짜 셀 정규화 (기존 동작 고정)', () => {
    // ⚠️ 지금 맞게 동작한다. 고정해 두지 않으면 나중에 toISOString()으로 바뀌어도 안 죽는다.
    //    SheetJS는 Date를 Date.UTC로 만들어 KST 자정이 전날 15:00Z로 보인다 —
    //    UTC로 자르면 **하루가 밀린다.**
    const norm = (v) => Object.getPrototypeOf(window.SoilResultImporter)._normalizeCell.call({}, v)

    it('9. Date → YYYY-MM-DD', () => {
        expect(norm(new Date(2026, 3, 3, 0, 0, 0))).toBe('2026-04-03')
    })

    it('10. 자정 경계에서 하루가 밀리지 않는다', () => {
        // Date.UTC(2026,3,2,15,0) === KST 2026-04-03 00:00
        const d = new Date(Date.UTC(2026, 3, 2, 15, 0, 0))
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        expect(norm(d), 'UTC 기준으로 잘라 하루가 밀렸다').toBe(local)
    })

    it('11. 문자열·숫자·빈 값은 그대로', () => {
        expect(norm('2026-04-03')).toBe('2026-04-03')
        expect(norm(46115), '숫자 일련번호를 날짜로 바꿔 면적·접수번호를 오염시켰다').toBe('46115')
        expect(norm(null)).toBe('')
        expect(norm(undefined)).toBe('')
    })

    it('12. 잘못된 Date는 문자열로 흘리지 않는다', () => {
        expect(norm(new Date('말도 안 되는 값'))).not.toMatch(/NaN/)
    })
})
