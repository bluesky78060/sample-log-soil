import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-231: 엑셀 기본 서식 (사용자 제공 업무 서식 기준)
//
// 구조: 1행 제목 / 2행 안내문 / 3행 헤더(한 줄) / 4행 예시
//
// 🚨 이 파일의 중심은 **2번**이다 — 모든 시트의 모든 열에 대해
//    "매핑돼야 할 열이 올바른 필드에 붙는가"와 "붙으면 안 되는 열이 안 붙는가"를 함께 본다.
//    한쪽만 보면 반쪽이다. 필드 개수만 세면 엉뚱한 필드에 붙어도 통과하고,
//    매핑만 확인하면 화학성분값이 접수 필드로 새어 들어가도 모른다.
//
// ⚠️ 헤더가 **한 줄**이라는 게 이 서식의 핵심이다. 원본은 '경지구분'을 1차/2차로 병합한
//    2단 헤더였는데, 그러면 병합 아래 칸이 빈 채로 읽혀 구분(논/밭/과수)을 매번 손으로
//    지정해야 한다. 우리가 배포하는 서식이 우리 앱에서 그러면 안 된다.

let fns
beforeAll(async () => {
    await import('../../src/shared/sanitize.js')
    await import('../../src/soil/soil-result-importer.js')
    fns = window.SoilResultImporter?._fns
    expect(fns, '_fns가 노출되지 않았다').toBeTruthy()
})

const sheets = () => fns.buildTemplateSheets()
const sheet = (name) => sheets().find((s) => s.name === name)

const PII_LABELS = ['성명', '전화번호', '농가 주소', '경작자명', '경작자 주소', '신청자 전화번호']

describe('시트 구성', () => {
    it('1. 시트 3개가 정확한 이름·제목으로 만들어진다', () => {
        expect(sheets().map((s) => s.name)).toEqual(['자체, 대표필지', '시료접수대장', '일괄등록양식'])
        expect(sheet('자체, 대표필지').title).toBe('자체, 대표필지 기본 서식')
        expect(sheet('시료접수대장').title).toBe('농가의뢰 입력 서식')
        expect(sheet('일괄등록양식').title).toBe('공익직불제 기본 서식')
    })

    it('예시 행 길이가 헤더 길이와 같다', () => {
        for (const s of sheets()) {
            expect(s.sample, `${s.name}: 예시 열 수가 헤더와 다르다`).toHaveLength(s.headers.length)
        }
    })

    it('헤더에 빈 칸이 없다 (2단 헤더의 잔재)', () => {
        for (const s of sheets()) {
            for (const [i, h] of s.headers.entries()) {
                expect(String(h).trim(), `${s.name} ${i}열 헤더가 비었다`).not.toBe('')
            }
        }
    })
})

// ══════════════════════════════════════════════════════════════
// 이 파일의 핵심
// ══════════════════════════════════════════════════════════════
describe('서식 ↔ 자동매핑 계약', () => {
    it('2. 모든 열이 의도한 필드에 붙고, 아닌 열은 어디에도 안 붙는다', () => {
        for (const s of sheets()) {
            const mapping = fns.computeAutoMapping(s.headers)
            const usedCols = new Set(Object.values(mapping))

            s.columns.forEach((col, i) => {
                if (col.key) {
                    expect(mapping[col.key], `${s.name}: '${col.label}'(${i}열)이 ${col.key}에 안 붙었다`)
                        .toBe(i)
                } else {
                    // key가 null인 열은 **의도적으로** 가져오기 대상이 아니다
                    expect(usedCols.has(i), `${s.name}: '${col.label}'(${i}열)이 매핑되면 안 되는데 붙었다`)
                        .toBe(false)
                }
            })
        }
    })

    it('3. 화학성분값 열은 하나도 매핑되지 않는다', () => {
        for (const s of sheets()) {
            const mapping = fns.computeAutoMapping(s.headers)
            const used = new Set(Object.values(mapping))
            s.columns.forEach((c, i) => {
                if (/점토함량|^pH$|유기물|유효인산|교환성|유효규산|전기전도도|석회소요량|질산태|양이온|암모니아/.test(c.label)) {
                    expect(used.has(i), `${s.name}: 검정 항목 '${c.label}'이 접수 필드에 붙었다`).toBe(false)
                }
            })
        }
    })

    it('4. 각 시트에 식별 필드가 있다 (없으면 미리보기가 아예 안 뜬다)', () => {
        for (const s of sheets()) {
            const mapping = fns.computeAutoMapping(s.headers)
            const hasIdentity = mapping.name != null || mapping.lotAddress != null || mapping.receptionNumber != null
            expect(hasIdentity, `${s.name}: 성명·지번주소·접수번호가 하나도 없다`).toBe(true)
        }
    })

    // 🚨 '대상지'만으로는 어디에도 안 붙고, 키워드로 추가하면 '대상지면적'이 면적 열을 뺏는다
    it('5. 공익직불제의 대상지·대상지면적이 서로를 뺏지 않는다', () => {
        const s = sheet('일괄등록양식')
        const mapping = fns.computeAutoMapping(s.headers)
        expect(s.headers[mapping.lotAddress]).toBe('대상지(필지 주소)')
        expect(s.headers[mapping.area]).toBe('대상지면적(㎡)')
    })

    // 라벨 우회가 아니라 키워드 추가로 고쳤다면 여기서 죽는다
    it("5-b. '대상지' 단독은 여전히 지번주소로 안 붙는다", () => {
        const m = fns.computeAutoMapping(['대상지', '대상지면적(㎡)'])
        expect(m.lotAddress, "'대상지' 키워드를 넣어 면적을 뺏을 위험을 만들었다").toBeUndefined()
        expect(m.area).toBe(1)
    })
})

describe('개인정보 (기존 4시트가 보장하던 것)', () => {
    // 열이 없으면 실수로 채울 자리도 없다 — 규칙이 아니라 구조로 막는다
    it('6. 자체·대표필지 시트에 개인정보 열이 없다', () => {
        const s = sheet('자체, 대표필지')
        for (const label of PII_LABELS) {
            expect(s.headers, `자체·대표필지에 '${label}' 열이 생겼다`).not.toContain(label)
        }
    })

    it('7. 농가의뢰에 성명·전화번호·농가 주소가 있다', () => {
        const h = sheet('시료접수대장').headers
        for (const label of ['성명', '전화번호', '농가 주소']) {
            expect(h, `농가의뢰에 '${label}'이 없다`).toContain(label)
        }
    })

    it('8. 공익직불제에 경영체등록번호가 있다', () => {
        expect(sheet('일괄등록양식').headers).toContain('경영체등록번호')
    })
})

describe('예시 행 방어', () => {
    // 🚨 식별 검사는 성명·지번주소 하나만 있어도 통과한다 —
    //    예시 행을 지우지 않고 가져오면 그대로 저장된다.
    //    안내를 비고에만 두면 가장 안 보는 칸이라 소용없다. 식별 필드 자체를 눈에 띄게 한다.
    it('9. 예시의 지번주소 계열 칸에 경고 표시가 있다', () => {
        for (const s of sheets()) {
            const i = s.columns.findIndex((c) => c.key === 'lotAddress')
            expect(i, `${s.name}에 지번주소 열이 없다`).toBeGreaterThan(-1)
            expect(s.sample[i], `${s.name} 예시 주소가 진짜 주소처럼 보인다`).toMatch(/예시|삭제/)
        }
    })

    // 🚨 경고 문구는 눈에 띄게 할 뿐 막지는 못한다 (codex 코드리뷰 MAJOR).
    //    안내에 "지우고 입력"이라 적어도 잊는 사람이 있고, 그러면 가짜 접수가 저장된다.
    it('9-b. 예시 행은 가져오기에서 오류로 빠진다', () => {
        for (const s of sheets()) {
            const mapping = fns.computeAutoMapping(s.headers)
            const p = fns.computePreview({
                rows: [s.sample], mapping, landClass1: '자체', logs: [],
            })
            expect(p, `${s.name}: 미리보기가 안 만들어졌다`).toBeTruthy()
            expect(p.stats.err, `${s.name}: 예시 행이 오류로 안 빠졌다`).toBe(1)
            expect(p.willImport, `${s.name}: 예시 행이 저장 대상에 남았다`).toBe(0)
            expect(p.items[0].reason).toMatch(/예시/)
        }
    })

    it('9-c. 평범한 주소는 예시로 오인되지 않는다', () => {
        expect(fns.isTemplateSampleRow({ lotAddress: '경상북도 봉화군 봉화읍 문단리 699' })).toBe(false)
        expect(fns.isTemplateSampleRow({ lotAddress: '' })).toBe(false)
        expect(fns.isTemplateSampleRow({})).toBe(false)
    })

    it('10. 예시 접수번호가 비어 있다 (도구 권장값 "자동부여"와 일치)', () => {
        for (const s of sheets()) {
            const i = s.columns.findIndex((c) => c.key === 'receptionNumber')
            expect(i).toBeGreaterThan(-1)
            expect(s.sample[i], `${s.name} 예시에 접수번호가 들어 있다`).toBe('')
        }
    })
})

describe('안내문', () => {
    it('11. 예시 행 위치(4행)를 정확히 안내한다', () => {
        for (const s of sheets()) {
            expect(s.guide.join('\n'), `${s.name} 안내문에 4행 안내가 없다`).toMatch(/4행/)
        }
    })

    // 🚨 4시트로 나눴던 이유 — 경지구분은 행 단위로 넣을 열이 없다.
    //    한 시트에 섞이면 어느 행이 어느 구분인지 가져오기가 알 수 없다.
    it('12. 자체·대표필지 시트는 나누어 올리라고 안내한다', () => {
        expect(sheet('자체, 대표필지').guide.join('\n'), '혼재 시 한 번에 못 가져온다는 안내가 없다')
            .toMatch(/나누어|한 종류씩/)
    })

    it('13. 안내문이 수식 문자로 시작하지 않는다 (sanitizeExcelAoa가 앞에 \' 를 붙인다)', () => {
        for (const s of sheets()) {
            for (const line of s.guide) {
                expect('=+-@|'.includes(line[0]), `${s.name}: '${line}'`).toBe(false)
            }
        }
    })
})

describe('헤더 행 자동 감지', () => {
    const ROWS = [
        ['자체, 대표필지 기본 서식'],
        ['1. 안내문'],
        ['접수번호', '성명', '지번주소', '작물'],
        ['', '홍길동', '봉화읍 내성리 100', '고추'],
    ]

    it('14. 제목·안내문이 위에 있어도 헤더 행을 찾는다', () => {
        expect(fns.detectHeaderRow(ROWS), '헤더를 못 찾아 제목을 헤더로 썼다').toBe(2)
    })

    // 🚨 데이터 행에 '성명'·'주소' 같은 값이 우연히 있으면 헤더보다 많이 매핑돼 헤더가 밀린다.
    //    지금까지 잘 되던 평범한 파일을 깨뜨리는 쪽이 더 나쁘다 — 1행을 우선한다.
    it('15-b. 첫 행이 헤더 같으면 뒤 행이 더 많이 붙어도 1행을 쓴다', () => {
        const risky = [
            ['성명', '지번주소'],                    // 2건
            ['홍길동', '소재지', '연락처', '작물'],   // 3건 — 더 많다
        ]
        expect(fns.detectHeaderRow(risky), '데이터 행이 헤더를 밀어냈다').toBe(0)
    })

    it('15. 첫 행이 헤더면 그대로 0을 쓴다', () => {
        expect(fns.detectHeaderRow([['접수번호', '성명', '지번주소'], ['1', '홍길동', '가나리 1']])).toBe(0)
    })

    // 🚨 동점일 때 뒤 행이 이기면 헤더가 한 줄씩 밀린다.
    //    ⚠️ 두 행이 **같은 개수로 매핑되어야** 동점이다. 데이터 행은 보통 0건이라
    //    아무 데이터나 넣으면 동점이 안 만들어지고, 이 단언은 아무것도 구분하지 못한다.
    it('16. 동점이면 앞선 행을 고른다', () => {
        const tie = [
            ['성명', '지번주소'],   // 2건
            ['이름', '소재지'],     // 2건 — 같은 개수
        ]
        expect(fns.detectHeaderRow(tie), '동점에서 뒤 행이 헤더를 이겼다').toBe(0)
    })

    // 아무것도 못 알아본 상태에서 헤더를 옮기면 평범한 파일이 이상해진다.
    // ⚠️ 전부 0건인 입력으로는 검증이 안 된다 — 하한이 없어도 0이 나온다.
    //    **1건만 붙는 행**이 뒤에 있어야 하한이 실제로 일한다.
    it('17. 알아본 게 1개뿐이면 헤더를 옮기지 않는다', () => {
        const weak = [
            ['제목', '설명'],       // 0건
            ['성명', 'zzz'],        // 1건 — 하한(2) 미만
        ]
        expect(fns.detectHeaderRow(weak), '근거가 1건뿐인데 헤더를 옮겼다').toBe(0)
    })

    it('17-b. 아무것도 못 알아보면 1행을 그대로 둔다', () => {
        expect(fns.detectHeaderRow([['a', 'b'], ['c', 'd']])).toBe(0)
        expect(fns.detectHeaderRow([])).toBe(0)
    })

    it('18. 실제 서식 헤더를 3행에서 찾아낸다', () => {
        for (const s of sheets()) {
            const rows = [[s.title], [s.guide.join('\n')], s.headers, s.sample]
            expect(fns.detectHeaderRow(rows), `${s.name}: 헤더 행을 3행으로 못 찾았다`).toBe(2)
        }
    })
})
