import { describe, it, expect, beforeAll } from 'vitest'

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
