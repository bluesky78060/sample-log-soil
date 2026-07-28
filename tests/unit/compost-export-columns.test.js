import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 퇴비 접수목록 엑셀 내보내기 컬럼 계약 (SLS-1-203 / SLS-1-200 MINOR-6)
//
// SLS-1-200에서 폼에 채취일자·사업자번호·농가여부·비료관리법 4항목을 추가했는데
// 접수목록 내보내기에는 반영하지 않았다. 폼에 입력한 값이 내보낸 파일에 없다.
//
// ⚠️ !cols 길이가 컬럼 수와 어긋나면 뒤쪽 열의 폭이 지정되지 않아 내용이 잘려 보인다.
//    컬럼만 늘리고 폭을 안 늘리는 것이 정확히 그 실수다 — 소스에서 직접 센다.
//
// 소스 텍스트를 읽는 이유: exportToExcel은 DOM·XLSX·FileAPI에 얽혀 있어 유닛에서
// 호출할 수 없다. 컬럼 목록과 폭 배열은 리터럴이라 텍스트 대조로 계약을 고정할 수 있다.

// jsdom 환경에서는 import.meta.url이 file: 스킴이 아니라 new URL()이 던진다.
// vitest는 프로젝트 루트에서 실행되므로 cwd 기준 경로를 쓴다.
const SRC = readFileSync(resolve(process.cwd(), 'src/compost/compost-script.js'), 'utf8')

/** 접수목록 내보내기의 행 객체 키를 순서대로 뽑는다 */
function exportColumns() {
    const m = SRC.match(/'접수번호': log\.receptionNumber[\s\S]*?'등록일시':[^\n]*\n/)
    expect(m, '접수목록 내보내기 행 객체를 찾지 못했다').toBeTruthy()
    return m[0].match(/'[^']+':/g).map(k => k.slice(1, -2))
}

/** 접수목록 시트의 !cols 폭 개수 */
function colWidthCount() {
    const anchor = SRC.indexOf('퇴액비 접수목록')
    const start = SRC.lastIndexOf("ws['!cols'] = [", anchor)
    expect(start, "접수목록 시트의 !cols를 찾지 못했다").toBeGreaterThan(-1)
    return (SRC.slice(start, SRC.indexOf('];', start)).match(/wch:/g) || []).length
}

describe('퇴비 접수목록 내보내기 컬럼', () => {
    it('1. SLS-1-200 신규 4항목이 포함된다', () => {
        const cols = exportColumns()
        expect(cols).toContain('채취일')
        expect(cols).toContain('사업자번호')
        expect(cols).toContain('농가여부')
        expect(cols).toContain('비료관리법')
    })

    it('2. 채취일이 생산일과 별개 컬럼이다', () => {
        // 흙토람 양식은 채취일자(T열)와 생산일자(U열)가 별도다. 한 칸에 합치면
        // 내보낸 파일로 양식을 채울 때 두 날짜를 되살릴 수 없다.
        const cols = exportColumns()
        expect(cols).toContain('생산일')
        expect(cols.indexOf('채취일')).not.toBe(cols.indexOf('생산일'))
    })

    it('3. !cols 길이가 컬럼 수와 정확히 같다', () => {
        // 🚨 컬럼만 늘리고 여기를 두면 뒤쪽 열 폭이 지정되지 않는다
        expect(colWidthCount()).toBe(exportColumns().length)
    })

    it('4. 컬럼 이름이 중복되지 않는다', () => {
        // json_to_sheet는 객체 키를 쓰므로 중복이 있으면 조용히 하나가 사라진다
        const cols = exportColumns()
        expect(new Set(cols).size).toBe(cols.length)
    })

    it('5. 사용자 지시대로 판정 컬럼은 넣지 않는다', () => {
        // 2026-07-28 "엑셀 내보내기에는 판정이 필요가 없고"
        // 나중에 무심코 추가되지 않도록 고정한다.
        expect(exportColumns()).not.toContain('판정')
    })
})
