import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-237: 2단 병합 머리글을 합쳐 읽는다
//
// 🚨 사용자 지적: "2차는 구분하고 같은 뜻이야."
//    맞고, **그 정보는 이미 서식에 있다** — 4행에 '2차'라고 적혀 있다.
//    앱이 3행만 읽어서 못 볼 뿐이라, 사람에게 매번 연결하라고 시킬 일이 아니었다.
//
// ⚠️ 위험은 반대쪽이다 — **데이터 행을 머리글로 오인해 합치면** 엉뚱한 이름이 생긴다.
//    그래서 "합쳐서 매핑이 늘어날 때만" 채택한다. 자기검증적이다.
//
// ⚠️ 머리글 높이를 **상태로 들지 않는다.** 파일에서 2단으로 잡은 뒤 붙여넣기로
//    전환하거나 머리글 행을 바꾸면 그 상태가 남아 첫 데이터 행이 사라진다.

let fns
beforeAll(async () => {
    await import('../../src/shared/sanitize.js')
    await import('../../src/soil/reception-number.js')
    await import('../../src/shared/soil-template-data.js')
    await import('../../src/soil/soil-result-importer.js')
    fns = window.SoilResultImporter?._fns
    expect(fns, '_fns가 노출되지 않았다').toBeTruthy()
})

describe('합치기 규칙', () => {
    it('1. 가로 병합이 부모+자식으로 합쳐진다', () => {
        const a = ['성명', '경지구분', '', '시료번호']
        const b = ['', '1차', '2차', '']
        expect(fns.mergeHeaderRows(a, b)).toEqual(['성명', '경지구분 1차', '경지구분 2차', '시료번호'])
    })

    // 🚨 오른쪽으로 계속 전파하면 '경지구분 시료번호'가 된다
    it('2. 부모는 왼쪽으로만 전파된다', () => {
        const out = fns.mergeHeaderRows(['경지구분', '', '시료번호', ''], ['1차', '2차', '', ''])
        expect(out[2], '부모가 오른쪽으로 새어 나갔다').toBe('시료번호')
        expect(out[3]).toBe('시료번호')   // 시료번호의 세로 병합
    })

    it('3. 아래 칸이 비면 부모를 그대로 쓴다 (세로 병합)', () => {
        expect(fns.mergeHeaderRows(['접수번호'], [''])).toEqual(['접수번호'])
    })

    it('빈 입력에도 죽지 않는다', () => {
        expect(fns.mergeHeaderRows(null, null)).toEqual([])
        expect(fns.mergeHeaderRows(['가'], null)).toEqual(['가'])
    })
})

describe('채택 조건', () => {
    // 🚨 이 조건이 방어의 전부다
    it('4. 합쳐서 매핑이 늘지 않으면 2단으로 보지 않는다', () => {
        // 1줄 머리글 + 데이터 행
        const header = ['성명', '지번주소', '작물']
        const data = ['홍길동', '봉화읍 내성리 100', '고추']
        expect(fns.isTwoRowHeader(header, data), '데이터 행을 머리글로 합쳤다').toBe(false)
    })

    it('4-b. 늘어나면 2단으로 본다', () => {
        expect(fns.isTwoRowHeader(['성명', '경지구분', ''], ['', '1차', '2차'])).toBe(true)
    })

    // 🚨 codex 코드리뷰 MAJOR — 데이터 행의 값이 머리글 낱말과 겹치면
    //    합쳐서 매핑이 늘어나 2단으로 오인하고 **첫 데이터 행을 통째로 삼킨다.**
    //    조용한 유실이라 아무도 모른다.
    //    판별 근거: **그 줄을 데이터로 읽어 접수 레코드가 되면 데이터다.**
    //    하위 머리글은 그 자체로 성명·주소가 될 수 없다.
    it('4-c. 데이터 행이 머리글 낱말을 품고 있어도 삼키지 않는다', () => {
        // 합치면 ['성명 홍길동', '성명 주소', '성명'] → '주소'가 새로 매핑되어 늘어난다
        expect(
            fns.isTwoRowHeader(['성명', '', ''], ['홍길동', '주소', '']),
            '첫 데이터 행을 머리글로 삼켰다'
        ).toBe(false)

        expect(fns.isTwoRowHeader(['성명', '지번주소'], ['홍길동', '봉화읍 내성리 100'])).toBe(false)
        // 지번주소만 있어도 데이터다 (식별 조건이 OR이다)
        expect(fns.isTwoRowHeader(['지번주소', ''], ['봉화읍 내성리 100', '기타'])).toBe(false)
    })

    it('5. 둘째 줄이 통째로 비면 2단이 아니다', () => {
        expect(fns.isTwoRowHeader(['성명', '경지구분', ''], ['', '', ''])).toBe(false)
        expect(fns.isTwoRowHeader(['성명'], undefined)).toBe(false)
    })
})

describe('실물 서식 (세 시트)', () => {
    const sheets = async () => {
        const XLSX = await import('xlsx')
        const buf = Buffer.from(window.SOIL_TEMPLATE.base64, 'base64')
        const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
        return wb.SheetNames.map((name) => ({
            name,
            aoa: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false }),
        }))
    }

    it('6. 머리글 3행·2단으로 읽히고 구분·1차가 각각 제자리에 붙는다', async () => {
        for (const { name, aoa } of await sheets()) {
            const h = fns.detectHeaderRow(aoa)
            expect(h, `${name}: 머리글을 3행으로 못 찾았다`).toBe(2)
            expect(fns.isTwoRowHeader(aoa[h], aoa[h + 1]), `${name}: 2단으로 인식 못 했다`).toBe(true)

            const headers = fns.mergeHeaderRows(aoa[h], aoa[h + 1])
            const m = fns.computeAutoMapping(headers)
            expect(headers[m.subCategory], `${name}: 구분이 안 붙었다`).toBe('경지구분 2차')
            expect(headers[m.landClass1], `${name}: 1차가 안 붙었다`).toBe('경지구분 1차')
        }
    })

    // 🚨 데이터 시작을 같이 안 옮기면 '1차'·'2차' 줄이 데이터로 섞인다
    it('7. 데이터가 5행부터다 — 1차/2차 줄이 데이터로 안 들어간다', async () => {
        for (const { name, aoa } of await sheets()) {
            const h = fns.detectHeaderRow(aoa)
            const rows = aoa.slice(h + 2)
            expect(rows[0]?.[0], `${name}: 첫 데이터가 예시 행이 아니다`).toMatch(/^예\)/)
            const flat = rows.flat().map(String)
            expect(flat, `${name}: '1차'가 데이터로 들어갔다`).not.toContain('1차')
            expect(flat, `${name}: '2차'가 데이터로 들어갔다`).not.toContain('2차')
        }
    })

    it('7-b. 그 예시 행은 오류로 빠진다', async () => {
        for (const { name, aoa } of await sheets()) {
            const h = fns.detectHeaderRow(aoa)
            const headers = fns.mergeHeaderRows(aoa[h], aoa[h + 1])
            const p = fns.computePreview({
                rows: aoa.slice(h + 2), mapping: fns.computeAutoMapping(headers),
                landClass1: '농가의뢰', logs: [],
            })
            expect(p.stats.err, `${name}: 예시 행이 안 걸렸다`).toBe(1)
            expect(p.items[0].reason).toMatch(/예시/)
            expect(p.willImport).toBe(0)
        }
    })
})
