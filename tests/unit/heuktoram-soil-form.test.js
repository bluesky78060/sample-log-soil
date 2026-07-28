import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as XLSX from 'xlsx'

// 흙토람 토양 일괄입력 서식(41열) 계약 (SLS-1-210)
//
// 사용자가 흙토람에서 받은 실물 서식을 fixture로 커밋했다. 우리 산출물이 실물과
// 어긋나면 사용자가 받은 파일을 흙토람에 그대로 올릴 수 없다.
//
// ⚠️ 개수 비교로는 안 된다. SLS-1-200에서 퇴비 서식을 "병합 34개 일치"로 넘겼다가
//    안내문 4줄 누락·헤더 줄바꿈 소실·셀 타입 3건을 놓쳤다. **문자열 전문을 대조한다.**
//
// ⚠️ 이번에도 조사 범위를 좁게 잡아 데이터 검증 열이 어긋난 것을 놓칠 뻔했다.
//    실물의 sqref·getColumnWidths() 주석·5행 예시값 셋이 F/G/U로 일치하는데
//    우리만 G/H/AH였다. showErrorMessage="1"이라 Excel이 목록 밖 값을 거부하므로
//    **시료번호(H)에 숫자를, 암모니아태질소(AH)에 수치를 넣을 수 없었다.**

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const SRC = read('src/heuktoram/heuktoram-script.js')

let ws
beforeAll(() => {
    // jsdom에서는 XLSX.readFile의 fs 접근이 막히므로 버퍼로 읽는다.
    const buf = readFileSync(resolve(process.cwd(), 'tests/fixtures/heuktoram-soil-form.xlsx'))
    ws = XLSX.read(buf, { type: 'buffer' }).Sheets['검정정보일괄입력']
    expect(ws, 'fixture에 검정정보일괄입력 시트가 없다').toBeTruthy()
})

/** 소스의 상수 리터럴을 꺼낸다 (export가 없는 파일이라 텍스트로 읽는다) */
const constOf = (name, re) => eval(SRC.match(re)[1])
const GUIDE = () => constOf('GUIDE', /const HEUKTORAM_WS_GUIDE = ([\s\S]*?);\n/)
const TITLE = () => constOf('TITLE', /const HEUKTORAM_WS_TITLE = ('[^']*');/)
const H3 = () => eval('(' + SRC.match(/const HEUKTORAM_WS_HEADER3 = (\{[\s\S]*?\});/)[1] + ')')
const H4 = () => eval('(' + SRC.match(/const HEUKTORAM_WS_HEADER4 = (\{[\s\S]*?\});/)[1] + ')')

const col = (c) => XLSX.utils.encode_col(c)

describe('흙토람 토양 서식 — 실물 대조', () => {
    it('1. A1 제목이 실물과 같다', () => {
        expect(TITLE()).toBe(ws['A1'].v)
    })

    // 🚨 실물을 그대로 복사하면 안 되는 유일한 지점
    it('2. A2 안내문이 실물과 같다 — 예시행 문장 2개만 뺀다', () => {
        // 실물은 사용자가 채우는 빈 템플릿이라 5행에 예시가 있다.
        // 우리 파일은 **5행부터 사용자의 실제 시료**다(1~4행이 제목·안내·헤더).
        // "5번 행은 예시…삭제 후 작성"을 그대로 두면 안내를 따른 사용자가
        // 자기 첫 시료를 지운다.
        const real = ws['A2'].v.split('\n')
            .filter(l => !l.startsWith('5번 행은 예시'))
            .map(l => l.replace('5번 행의 예시내용을 삭제 후 작성하시기 바라며, 원활한', '원활한'))
            .join('\n')
        expect(GUIDE()).toBe(real)
        expect(GUIDE().split('\n')).toHaveLength(18)
        expect(GUIDE(), '예시행 안내가 남으면 사용자가 자기 데이터를 지운다')
            .not.toContain('5번 행')
    })

    it('3. 3·4행 헤더 41열이 실물과 전부 일치한다', () => {
        const h3 = H3(), h4 = H4()
        const diffs = []
        for (const [row, ours] of [[3, h3], [4, h4]]) {
            for (let c = 0; c < 41; c++) {
                const real = ws[col(c) + row]?.v
                if ((real || '') !== (ours[c] || '')) {
                    diffs.push(`${row}행 ${col(c)}: 실물=${JSON.stringify(real)} 우리=${JSON.stringify(ours[c])}`)
                }
            }
        }
        expect(diffs, diffs.join(' | ')).toEqual([])
    })

    it('4. 필수 항목 * 표시가 12건이다', () => {
        // 실물이 필수 항목에 *를 붙인다. 줄바꿈까지 실물 그대로다.
        const starred = Object.values(H3()).filter(v => v.includes('*'))
        expect(starred).toHaveLength(12)
        expect(H3()[2], '분석의뢰일 뒤 줄바꿈').toBe('*분석의뢰일\n(접수일자)')
    })

    it('5. 시트명이 실물과 같다', () => {
        expect(SRC, '흙토람 내보내기 시트명').toContain("book_append_sheet(wb, ws, '검정정보일괄입력')")
    })

    // 🚨 과잉 치환 방어 — 공익직불제는 완전히 다른 서식이다
    it('6. 공익직불제 시트명은 그대로다', () => {
        expect(SRC, '공익직불제까지 바꾸면 그 기능이 깨진다')
            .toContain("book_append_sheet(wb, ws, '일괄등록양식')")
    })

    // 🚨 이번 티켓의 핵심 — 실제 사용자 입력을 막던 버그
    it('7. 데이터 검증이 F·G·U에 걸린다', () => {
        const body = SRC.match(/buildDataValidations\(dataRowCount\)[\s\S]*?\n    \}/)[0]
        expect(body, '용도구분').toContain('sqref: `F${startRow}:F${endRow}`')
        expect(body, '시행(재배)전후').toContain('sqref: `G${startRow}:G${endRow}`')
        expect(body, '성토여부').toContain('sqref: `U${startRow}:U${endRow}`')
        // H는 시료번호, AH는 암모니아태질소다 — 검증이 걸리면 숫자를 못 넣는다
        expect(body, 'H(시료번호)에 걸리면 안 된다').not.toContain('sqref: `H${startRow}')
        expect(body, 'AH(암모니아태질소)에 걸리면 안 된다').not.toContain('sqref: `AH${startRow}')
    })

    it('8. 검증 목록이 실물처럼 범례 셀을 참조한다', () => {
        const body = SRC.match(/buildDataValidations\(dataRowCount\)[\s\S]*?\n    \}/)[0]
        expect(body).toContain("formula: '$AJ$3:$AM$3'")
        expect(body).toContain("formula: '$AN$3:$AO$3'")
    })

    it('9. 행 높이가 실물과 같다', () => {
        // 이전 값 30 / 369.5는 근거 없이 물려받은 것이었다 (실물은 31.5 / 309.75).
        expect(SRC).toContain('hpt: 31.5')
        expect(SRC).toContain('hpt: 309.75')
        expect(SRC).toContain('hpt: 17.45')
    })

    it('10. 숨김이 스페이서·범례 열에만 걸린다', () => {
        // ⚠️ 개수만 세면 **엉뚱한 7개**를 숨겨도 통과한다. 이 파일 머리말이
        //    경계한 바로 그 함정이라(SLS-1-200) 위치를 본다.
        const widths = SRC.match(/getColumnWidths\(\) \{[\s\S]*?\n    \}/)[0]
        const entries = [...widths.matchAll(/\{[^}]*\},\s*\/\/ \[(\d+)\]/g)]
        const hidden = entries.filter(m => m[0].includes('hidden: true')).map(m => +m[1])
        expect(hidden, '스페이서(34) + 범례(35~40)').toEqual([34, 35, 36, 37, 38, 39, 40])
        // 데이터 열(0~33)은 하나도 숨으면 안 된다
        const dataHidden = entries.filter(m => +m[1] <= 33 && m[0].includes('hidden: true'))
        expect(dataHidden.map(m => +m[1]), '데이터 열이 숨으면 사용자가 입력을 못 한다').toEqual([])
    })

    it('12. 검증 범위가 열 전체다', () => {
        // 데이터 행 수로 끊으면 사용자가 행을 덧붙였을 때 그 행에는
        // 드롭다운도 오입력 차단도 없다. 실물은 F3:F1048576처럼 열 전체다.
        const body = SRC.match(/buildDataValidations\(dataRowCount\)[\s\S]*?\n    \}/)[0]
        expect(body).toContain('const endRow = 1048576')
    })

    it('11. 병합이 실물과 같다 (30개, 범위까지)', () => {
        const merges = SRC.match(/applyHeaderMerges\(ws\) \{[\s\S]*?\n    \}/)[0]
        const ours = [...merges.matchAll(/\{ s: \{ r: (\d+), c: (\d+) \}, e: \{ r: (\d+), c: (\d+) \} \}/g)]
            .map(m => XLSX.utils.encode_range({
                s: { r: +m[1], c: +m[2] }, e: { r: +m[3], c: +m[4] }
            })).sort()
        const real = (ws['!merges'] || []).map(m => XLSX.utils.encode_range(m)).sort()
        expect(ours).toEqual(real)
    })
})
