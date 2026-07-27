import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-199: 엑셀 시트명 정규화 순수 로직
// 실무 값 12종은 안전하지만 엑셀 가져오기로 임의 값이 유입될 수 있어 방어를 고정한다.

beforeAll(async () => {
    await import('../../src/soil/sheet-name.js')
})

const sanitize = (name, used = new Set()) => window.SheetName.sanitizeSheetName(name, used)

describe('sanitizeSheetName', () => {
    it('금지 문자를 공백으로 치환한다', () => {
        expect(sanitize('전략/직불')).toBe('전략 직불')
        expect(sanitize('a[b]c:d*e?f\\g')).toBe('a b c d e f g')
    })

    it('제어문자를 공백으로 치환한다 (후행 공백·아포스트로피는 함께 제거됨)', () => {
        expect(sanitize('농가\x00의뢰\x1F')).toBe('농가 의뢰')
    })

    it('선행·후행 아포스트로피를 제거한다', () => {
        expect(sanitize("'농가의뢰'")).toBe('농가의뢰')
        expect(sanitize("''양쪽''")).toBe('양쪽')
    })

    it('절단면에 드러난 아포스트로피도 제거한다 (xlsx check_ws_name throw 방지)', () => {
        // 아포스트로피 제거를 절단보다 먼저 하면 31번째가 내부 '였을 때
        // 새 후행 아포스트로피가 생겨 book_append_sheet가 throw한다
        expect(sanitize('a'.repeat(30) + "'" + 'b')).not.toMatch(/'$/)
        expect(sanitize('a'.repeat(29) + "'" + ' b')).not.toMatch(/'$/)
    })

    it('31자 초과를 절단하고, 절단면의 후행 공백·아포스트로피를 제거한다', () => {
        const long = 'a'.repeat(40)
        expect(sanitize(long)).toHaveLength(31)
        // 30자 + 공백 + 이어지는 글자 → slice(0,31) 끝이 공백 → [\s']+$ 로 제거
        const spaceAt31 = 'b'.repeat(30) + ' ' + 'tail'
        const out = sanitize(spaceAt31)
        expect(out).toBe('b'.repeat(30))
        expect(out.endsWith(' ')).toBe(false)
    })

    it('빈 값·금지문자만 있는 값은 미지정이 된다', () => {
        expect(sanitize('')).toBe('미지정')
        expect(sanitize(null)).toBe('미지정')
        expect(sanitize('///')).toBe('미지정')   // 공백만 남아 제거 후 빈 문자열
    })

    it("Excel 예약 이름 'History'를 회피한다 (대소문자 무시)", () => {
        expect(sanitize('History')).toBe('History_')
        expect(sanitize('history')).toBe('history_')
        expect(sanitize('HISTORY')).toBe('HISTORY_')
    })

    it('중복 시 접미사를 붙이고, 판정은 대소문자 무시다 (Excel 규칙)', () => {
        const used = new Set()
        expect(sanitize('GAP', used)).toBe('GAP')
        expect(sanitize('gap', used)).toBe('gap (2)')   // Excel은 GAP=gap
        expect(sanitize('GAP', used)).toBe('GAP (3)')
    })

    it('첫 시트명(시료접수대장)과 충돌하는 구분 값도 접미사 처리된다', () => {
        const used = new Set()
        expect(sanitize('시료접수대장', used)).toBe('시료접수대장')
        expect(sanitize('시료접수대장', used)).toBe('시료접수대장 (2)')
    })

    it('접미사 포함 31자를 준수한다', () => {
        const used = new Set()
        const long = 'c'.repeat(31)
        expect(sanitize(long, used)).toHaveLength(31)
        const second = sanitize(long, used)
        expect(second.length).toBeLessThanOrEqual(31)
        expect(second.endsWith(' (2)')).toBe(true)
    })

    it('실무 값 12종은 원형 그대로 통과한다', () => {
        const options = ['개량제', '전략', '직불', '자체', '기타', '친환경', '유기농', '무농약', 'GAP', '농가의뢰', '대표필지', '공익직불제']
        const used = new Set()
        options.forEach(v => expect(sanitize(v, used)).toBe(v))
    })
})
