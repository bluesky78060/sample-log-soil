import { describe, it, expect, beforeAll } from 'vitest'

// sanitize.js를 jsdom 환경에서 import → window.escapeHTML 등 설정됨
beforeAll(async () => {
    await import('../../src/shared/sanitize.js')
})

describe('escapeHTML', () => {
    it('script 태그 이스케이프', () => {
        expect(escapeHTML('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    })

    it('꺽쇠 괄호 이스케이프 (XSS 방지 핵심)', () => {
        expect(escapeHTML('<img src=x onerror=alert(1)>')).toContain('&lt;')
        expect(escapeHTML('<img src=x onerror=alert(1)>')).toContain('&gt;')
    })

    it('null/undefined → 빈 문자열', () => {
        expect(escapeHTML(null)).toBe('')
        expect(escapeHTML(undefined)).toBe('')
    })

    it('일반 텍스트 그대로 반환', () => {
        expect(escapeHTML('봉화군 농업기술센터')).toBe('봉화군 농업기술센터')
    })

    it('숫자를 문자열로 변환', () => {
        expect(escapeHTML(42)).toBe('42')
    })

    it('& 이스케이프', () => {
        expect(escapeHTML('a & b')).toBe('a &amp; b')
    })

    // ══════════════════════════════════════════════════════════════
    // 🚨 SLS-1-249 — 따옴표를 안 막으면 속성 문맥에서 값이 잘린다
    // ══════════════════════════════════════════════════════════════

    it('큰따옴표 이스케이프 — 이게 없으면 value="..." 가 잘린다', () => {
        expect(escapeHTML('1"동')).toBe('1&quot;동')
    })

    it('작은따옴표 이스케이프', () => {
        expect(escapeHTML("1'동")).toBe('1&#39;동')
    })

    // 🚨 & 치환이 뒤로 밀리면 &lt; 가 &amp;lt; 가 된다
    it('이중 이스케이프가 없다', () => {
        expect(escapeHTML('<a>')).toBe('&lt;a&gt;')
        expect(escapeHTML('a"b&c')).toBe('a&quot;b&amp;c')
        expect(escapeHTML('a & b')).not.toContain('&amp;amp;')
        expect(escapeHTML('1"동')).not.toContain('&amp;quot;')
    })

    // ══════════════════════════════════════════════════════════════
    // 🚨 이 파일에서 가장 중요한 단언.
    //    위의 1·2번은 "치환했다"만 본다. 이건 **실제로 안 잘리는가**를 본다 —
    //    HTML 파서에 진짜로 통과시켜 속성값을 되읽는다.
    // ══════════════════════════════════════════════════════════════
    describe('속성 문맥 왕복 (파서로 실제 확인)', () => {
        const roundTrip = (value) => {
            const host = document.createElement('div')
            host.innerHTML = `<input value="${escapeHTML(value)}">`
            return host.querySelector('input')?.getAttribute('value')
        }

        // 사용자가 실제로 겪은 값 + 경계값
        const cases = [
            '1"동 옆 창고',   // 티켓의 증상 그 자체
            '가로 3" 배관',
            "1'동",
            'a & b',
            '<b>강조</b>',
            '따옴표 " 와 & 와 < 가 함께',
            '정상 입력 1동',
        ]

        for (const v of cases) {
            it(`온전히 왕복: ${JSON.stringify(v)}`, () => {
                expect(roundTrip(v), '속성이 잘렸다').toBe(v)
            })
        }

        it('속성 탈출로 없던 속성이 생기지 않는다', () => {
            const host = document.createElement('div')
            host.innerHTML = `<input value="${escapeHTML('" data-injected="yes" x="')}">`
            const el = host.querySelector('input')
            expect(el?.getAttribute('data-injected'), '속성 문맥을 탈출했다').toBeNull()
        })
    })
})

// ══════════════════════════════════════════════════════════════
// 🚨 safeTemplate — String.replace의 문자열 치환은 $&·$`·$'·$1·$$ 를 특수 해석한다.
//    값에 `$&`가 들어오면 매치된 `{{key}}` 자체로 바뀐다 (SLS-1-249 계획 리뷰가 잡음).
// ══════════════════════════════════════════════════════════════
describe('safeTemplate', () => {
    const render = (v) => safeTemplate('[{{val}}]', { val: v })

    it('일반 값을 치환한다', () => {
        expect(render('봉화')).toBe('[봉화]')
    })

    it('$& 가 매치 문자열로 해석되지 않는다', () => {
        expect(render('$&'), '$&가 {{val}}로 치환됐다').toBe('[$&amp;]')
    })

    it('$1 · $` · $\' 도 그대로 남는다', () => {
        expect(render('$1')).toBe('[$1]')
        expect(render('$`')).toBe('[$`]')
        expect(render("$'")).toBe('[$&#39;]')
    })

    it('$$ 가 하나로 줄지 않는다', () => {
        expect(render('$$')).toBe('[$$]')
    })

    it('따옴표가 든 값도 이스케이프된다', () => {
        expect(render('1"동')).toBe('[1&quot;동]')
    })

    // 🚨 코드리뷰 MINOR — key를 정규식에 그대로 넣으면 메타문자가 해석된다
    it('키에 정규식 메타문자가 있어도 그 자리만 치환한다', () => {
        expect(safeTemplate('[{{a.b}}]|[{{axb}}]', { 'a.b': 'X' }),
            "'.'가 임의문자로 해석돼 {{axb}}까지 먹었다").toBe('[X]|[{{axb}}]')
    })

    it('키에 괄호가 있어도 던지지 않는다', () => {
        expect(() => safeTemplate('{{가격(원)}}', { '가격(원)': '1000' }),
            '메타문자로 정규식이 깨졌다').not.toThrow()
        expect(safeTemplate('{{가격(원)}}', { '가격(원)': '1000' })).toBe('1000')
    })
})
