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
})
