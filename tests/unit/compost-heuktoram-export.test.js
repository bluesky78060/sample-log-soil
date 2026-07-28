import { describe, it, expect, beforeAll } from 'vitest'
import * as XLSX from 'xlsx'
import path from 'node:path'
import fs from 'node:fs'

// SLS-1-200: 흙토람 「성분검사결과 일괄입력 양식」 36열 내보내기
//
// ⚠️ 실물 양식과 직접 대조한다.
//   "병합 34개" 같은 개수 비교는 34개가 전부 엉뚱한 위치여도 통과한다.
//   하드코딩 골든은 처음에 잘못 옮겨 적으면 영원히 통과한다.
//   그래서 수령한 실물 파일을 fixture로 커밋하고 구조를 집합 비교한다.

const FIXTURE = path.join(__dirname, '../fixtures/heuktoram-compost-form.xlsx')

let real, E

beforeAll(async () => {
    // jsdom 환경에서는 XLSX.readFile의 fs 접근이 막히므로 버퍼로 읽는다.
    // cellStyles 없으면 !cols가 undefined로 나온다.
    const wb = XLSX.read(fs.readFileSync(FIXTURE), { type: 'buffer', cellStyles: true })
    real = wb.Sheets['검정정보일괄입력']

    global.XLSX = XLSX
    window.XLSX = XLSX
    await import('../../src/shared/sanitize.js')
    await import('../../src/shared/address-parser.js')
    await import('../../src/shared/lot-address-parser.js')
    await import('../../src/shared/compost-fields.js')
    await import('../../src/compost-analysis/compost-heuktoram-export.js')
    E = window.CompostHeuktoramExport
})

const log = (over = {}) => ({
    id: 'c1', receptionNumber: '101', date: '2026-07-01',
    farmName: '가나농장', farmAddress: '경상북도 봉화군 봉화읍 문단리 699-2',
    farmArea: '2000', farmAreaUnit: 'm2',
    sampleType: '가축분퇴비', animalType: '돼지',
    productionDate: '2026-06-01', samplingDate: '2026-06-15',
    businessNumber: '111-11-11111', isFarm: '해당', fertilizerLawApplies: '미해당',
    note: '비고내용', purpose: '성분검사',
    ...over
})

const result = (over = {}) => ({
    testDate: '2026-07-20', maturity: '부숙완료',
    moisture: '62.1', copper: '210', zinc: '880',
    nitrogen: '1.2', phosphorus: '0.8', potassium: '0.5',
    finalOpinion: '적합', ...over
})

const build = (logs, results) =>
    E.buildWorkbook(logs.map(l => ({ key: l.id, log: l })), results)

describe('실물 양식 구조 대조', () => {
    it('1. 시트명·열수가 실물과 같다', () => {
        const ws = build([log()], { c1: result() }).Sheets[E.SHEET_NAME]
        expect(E.SHEET_NAME).toBe(Object.keys({ '검정정보일괄입력': 1 })[0])
        expect(XLSX.utils.decode_range(ws['!ref']).e.c + 1).toBe(36)
        expect(XLSX.utils.decode_range(real['!ref']).e.c + 1).toBe(36)
    })

    it('2. 병합이 실물과 집합으로 일치한다 (개수가 아니라 위치)', () => {
        const ws = build([log()], { c1: result() }).Sheets[E.SHEET_NAME]
        const mine = ws['!merges'].map(m => XLSX.utils.encode_range(m)).sort()
        const theirs = real['!merges'].map(m => XLSX.utils.encode_range(m)).sort()
        expect(mine).toEqual(theirs)
        expect(mine).toHaveLength(34)
    })

    it('3. 열 너비가 실물과 일치한다 (36개)', () => {
        const ws = build([log()], { c1: result() }).Sheets[E.SHEET_NAME]
        const mine = ws['!cols'].slice(0, 36).map(c => c.wpx)
        const theirs = real['!cols'].slice(0, 36).map(c => c && c.wpx)
        expect(mine).toEqual(theirs)
    })

    it('4. 행 높이가 실물과 일치한다 (2행 안내문 330.6 포함)', () => {
        const ws = build([log()], { c1: result() }).Sheets[E.SHEET_NAME]
        const mine = ws['!rows'].map(r => r.hpt)
        const theirs = real['!rows'].map(r => r && r.hpt)
        expect(mine).toEqual(theirs)
        expect(mine[1]).toBe(330.6)   // 안내문이 잘리지 않는 높이
    })

    it('5. 3·4행 헤더 문자열이 실물과 일치한다', () => {
        const ws = build([log()], { c1: result() }).Sheets[E.SHEET_NAME]
        const rowOf = (sheet, r) => {
            const out = []
            for (let c = 0; c < 36; c++) {
                const cell = sheet[XLSX.utils.encode_cell({ r, c })]
                // 병합에 덮인 셀은 v가 undefined다 — 빈 값으로 본다
                out.push(cell && cell.v !== undefined ? String(cell.v) : '')
            }
            return out
        }
        expect(rowOf(ws, 2)).toEqual(rowOf(real, 2))
        expect(rowOf(ws, 3)).toEqual(rowOf(real, 3))
    })

    it('6. 제목이 실물과 같다', () => {
        const ws = build([log()], { c1: result() }).Sheets[E.SHEET_NAME]
        expect(ws['A1'].v).toBe(real['A1'].v)
    })
})

describe('값 매핑', () => {
    const rowFor = (l, r) => E.buildRow(l, r)

    it('7. 용도구분은 검사결과통보용 고정, 전자인계 열은 공란', () => {
        const row = rowFor(log(), result())
        expect(row[0]).toBe('검사결과통보용')
        expect(row[14]).toBe('')   // 업체명
        expect(row[15]).toBe('')   // 업체번호
        expect(row[17]).toBe('')   // 연계구분
    })

    it('8. 주소가 7열로 분해된다', () => {
        const row = rowFor(log(), result())
        expect(row.slice(2, 9)).toEqual(['경상북도', '봉화군', '봉화읍', '문단리', '', '699', '2'])
    })

    it('9. 산 지번은 지번구분에 "산"이 들어간다', () => {
        const row = rowFor(log({ farmAddress: '경상북도 봉화군 봉화읍 문단리 산 12-3' }), result())
        expect(row[6]).toBe('산')
        expect(row[7]).toBe('12')
        expect(row[8]).toBe('3')
    })

    it('10. 축종 소 → 소·젖소로 매핑된다', () => {
        expect(rowFor(log({ animalType: '소' }), result())[24]).toBe('소·젖소')
        expect(rowFor(log({ animalType: '돼지' }), result())[24]).toBe('돼지')
    })

    it('11. 매핑에 없는 축종은 기타 + 원문을 비고로', () => {
        const row = rowFor(log({ animalType: '메추리' }), result())
        expect(row[24]).toBe('기타')
        expect(row[25]).toBe('메추리')
    })

    it('12. 알려진 축종은 축종_비고를 비운다 (양식: 기타일 때만 입력)', () => {
        expect(rowFor(log({ animalType: '돼지' }), result())[25]).toBe('')
    })

    it('13. 완전부숙은 부숙완료로 정규화된다', () => {
        expect(rowFor(log(), result({ maturity: '완전부숙' }))[27]).toBe('부숙완료')
        expect(rowFor(log(), result({ maturity: '부숙후기' }))[27]).toBe('부숙후기')
    })

    it('14. 면적은 getAreaInSqm 재사용 — 평도 ㎡로 환산된다', () => {
        // 실물이 전 셀을 텍스트로 저장하므로 문자열로 낸다
        expect(rowFor(log({ farmArea: '2000', farmAreaUnit: 'm2' }), result())[13]).toBe('2000')
        expect(rowFor(log({ farmArea: '454', farmAreaUnit: 'pyeong' }), result())[13]).toBe('1501')
    })

    it('15. 신규 폼 항목이 해당 열에 실린다', () => {
        const row = rowFor(log(), result())
        expect(row[11]).toBe('111-11-11111')   // 사업자등록번호
        expect(row[16]).toBe('해당')            // 농가여부
        expect(row[19]).toBe('2026-06-15')      // 채취일자
        expect(row[20]).toBe('2026-06-01')      // 생산일자
        expect(row[22]).toBe('미해당')          // 비료관리법
    })

    it('16. 검정결과 8종 + 최종검토의견이 실린다', () => {
        const row = rowFor(log(), result())
        expect(row[21]).toBe('2026-07-20')   // 검사일자
        expect(row.slice(28, 32)).toEqual(['62.1', '210', '880', ''])  // 함수율·구리·아연·염분
        expect(row.slice(32, 35)).toEqual(['1.2', '0.8', '0.5'])       // 질소·인산·칼리
        expect(row[35]).toBe('적합')
    })

    it('17. 법인이 아니면 법인명을 비운다', () => {
        expect(rowFor(log(), result())[12]).toBe('')
        expect(rowFor(log({ applicantType: '법인' }), result())[12]).toBe('가나농장')
    })
})

describe('보안·구조', () => {
    it('18. 수식 인젝션이 무력화된다 (sanitizeExcelAoa)', () => {
        const ws = build([log({ note: '=1+1' })], { c1: result({ finalOpinion: '=cmd|calc' }) })
            .Sheets[E.SHEET_NAME]
        // 데이터는 5행(인덱스 4)
        expect(String(ws[XLSX.utils.encode_cell({ r: 4, c: 18 })].v)).not.toMatch(/^=/)
        expect(String(ws[XLSX.utils.encode_cell({ r: 4, c: 35 })].v)).not.toMatch(/^=/)
    })

    it('19. 데이터가 5행부터 시작한다 (헤더 4행)', () => {
        const aoa = E.buildAoa([{ key: 'c1', log: log() }], { c1: result() })
        expect(aoa).toHaveLength(5)
        expect(aoa[4][10]).toBe('101')   // 시료번호
    })

    it('20. 모든 행이 정확히 36열이다', () => {
        const aoa = E.buildAoa(
            [{ key: 'c1', log: log() }, { key: 'c2', log: log({ id: 'c2' }) }],
            { c1: result(), c2: result() }
        )
        for (const [i, row] of aoa.entries()) {
            expect(row, `행 ${i}`).toHaveLength(36)
        }
    })
})

describe('데이터 유효성 주입 (Q·W열 드롭다운)', () => {
    it('21. 실물 양식과 같은 sqref·목록을 만든다', () => {
        const dv = E.buildDataValidations()
        expect(dv).toEqual([
            { sqref: 'Q5:Q1048576', options: ['해당', '미해당', 'Y', 'N'] },
            { sqref: 'W5:W1048576', options: ['해당', '미해당', 'Y', 'N'] },
        ])
    })

    it('22. 실물 파일의 유효성과 일치한다', async () => {
        // 실물에서 뽑은 sqref·목록과 대조 — 하드코딩 골든이 아니라 파일 대조다
        const zip = await (await import('jszip')).default.loadAsync(fs.readFileSync(FIXTURE))
        const xml = await zip.file('xl/worksheets/sheet1.xml').async('string')
        const m = xml.match(/<dataValidation [^>]*sqref="([^"]+)"[^>]*>[\s\S]*?<formula1>(.*?)<\/formula1>/)
        expect(m[1]).toBe('W5:W1048576 Q5:Q1048576')          // 실물은 한 선언에 두 범위
        expect(m[2].replace(/&quot;/g, '"')).toBe('"해당,미해당,Y,N"')
    })

    it('23. XML이 Excel 스펙대로 생성된다', () => {
        const xml = E.buildDataValidationsXml(E.buildDataValidations())
        expect(xml).toContain('<dataValidations count="2">')
        expect(xml).toContain('type="list"')
        expect(xml).toContain('&quot;해당,미해당,Y,N&quot;')
    })

    it('24. JSZip이 있으면 mergeCells 뒤에 주입된다', async () => {
        window.JSZip = (await import('jszip')).default
        const wb = build([log()], { c1: result() })
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
        const patched = await E.injectDataValidations(buf, E.buildDataValidations())

        const zip = await window.JSZip.loadAsync(patched)
        const xml = await zip.file('xl/worksheets/sheet1.xml').async('string')
        expect(xml).toContain('Q5:Q1048576')
        expect(xml).toContain('W5:W1048576')
        // Excel 스펙: dataValidations는 mergeCells 다음
        expect(xml.indexOf('</mergeCells>')).toBeLessThan(xml.indexOf('<dataValidations'))
    })

    it('25. JSZip이 없으면 원본을 그대로 돌려준다 (throw하지 않음)', async () => {
        const saved = window.JSZip
        delete window.JSZip
        try {
            const buf = XLSX.write(build([log()], { c1: result() }), { type: 'array', bookType: 'xlsx' })
            const out = await E.injectDataValidations(buf, E.buildDataValidations())
            expect(out).toBe(buf)
        } finally {
            window.JSZip = saved
        }
    })
})

describe('안내문·셀 서식 (구조 대조에서 발견)', () => {
    it('26. A2 안내문이 실물과 완전히 같다 (20줄)', () => {
        // 처음 손으로 옮겨 적었을 때 4줄이 누락되고 1줄이 잘렸다.
        // 안내문은 검사자가 읽는 입력 규칙이라 누락되면 안 된다.
        const ws = build([log()], { c1: result() }).Sheets[E.SHEET_NAME]
        expect(ws['A2'].v).toBe(real['A2'].v)
        expect(ws['A2'].v.split('\n')).toHaveLength(20)
    })

    it('27. 안내문에 전자인계·연계구분 안내가 들어 있다 (누락됐던 4줄)', () => {
        const ws = build([log()], { c1: result() }).Sheets[E.SHEET_NAME]
        const g = ws['A2'].v
        expect(g).toContain('용도구분이 액비처방용인 경우')
        expect(g).toContain('가축분뇨전자인계시스템에 액비처방서를 연계할 경우')
        expect(g).toContain('연계구분은 자가액비, 가축분뇨연계액비')
        expect(g).toContain('시료종류를 가축분퇴비 혹은 01로 입력하였을 경우')
        // 잘렸던 부분
        expect(g).toContain("해당일 경우에는 '비료관리법'에 따른 기준 적용")
    })

    it('28. A2에 wrapText가 있다 (없으면 20줄이 뭉개진다)', () => {
        const ws = build([log()], { c1: result() }).Sheets[E.SHEET_NAME]
        expect(ws['A2'].s.alignment.wrapText).toBe(true)
    })

    // 코드리뷰 MINOR-2: 위 28·30은 **메모리 객체**를 본다.
    //   테스트가 쓰는 xlsx는 write 시 .s를 버리므로, 런타임 라이브러리가 바뀌어도
    //   테스트는 계속 초록이다 — A2 wrapText 소실이 침묵 회귀한다.
    //   실제 파일(styles.xml)까지 도달하는지는 런타임과 같은 xlsx-js-style로 확인한다.
    it('28b. 스타일이 실제 xlsx 파일까지 도달한다', async () => {
        const XLSXStyle = await import('xlsx-js-style')
        const saved = window.XLSX
        window.XLSX = XLSXStyle.default || XLSXStyle
        let buf
        try {
            const wb = E.buildWorkbook([{ key: 'c1', log: log() }], { c1: result() })
            buf = window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
        } finally {
            window.XLSX = saved
        }
        const zip = await (await import('jszip')).default.loadAsync(buf)
        const styles = await zip.file('xl/styles.xml').async('string')
        // xlsx-js-style은 wrapText="true"로 쓴다("1"이 아니다)
        expect(styles).toContain('wrapText="true"')   // A2 안내문이 줄바꿈된다
        expect(styles).toContain('FFD9D9D9')           // 헤더 회색 채움
    })

    it('29. 데이터 셀이 전부 텍스트다 (실물과 동일 — 앞자리 0·지번 보존)', () => {
        const ws = build([log({ receptionNumber: '0101' })], { c1: result() }).Sheets[E.SHEET_NAME]
        // 면적·성적은 숫자로 보이지만 실물은 텍스트로 저장한다
        for (const c of [10, 13, 28, 29, 30, 32, 33, 34]) {
            const cell = ws[XLSX.utils.encode_cell({ r: 4, c })]
            expect(cell.t, `열 ${c} 타입`).toBe('s')
            // 서식까지 텍스트여야 Excel이 열 때 숫자로 재해석하지 않는다.
            // t만 보면 buildRow가 이미 문자열을 내므로 강제 없이도 통과한다.
            expect(cell.z, `열 ${c} 서식`).toBe('@')
        }
        expect(ws[XLSX.utils.encode_cell({ r: 4, c: 10 })].v).toBe('0101')
    })

    it('30. 헤더 행에 서식이 붙는다', () => {
        const ws = build([log()], { c1: result() }).Sheets[E.SHEET_NAME]
        const h = ws[XLSX.utils.encode_cell({ r: 2, c: 0 })]
        expect(h.s.font.bold).toBe(true)
        expect(h.s.fill.patternType).toBe('solid')
        expect(h.s.border.top.style).toBe('thin')
    })
})
