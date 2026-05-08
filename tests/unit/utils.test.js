import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(async () => {
    await import('../../src/shared/utils.js')
})

describe('formatArea / formatNumber', () => {
    it('정수 포맷', () => {
        expect(window.SampleUtils.formatArea(1000)).toBe('1,000')
    })

    it('0 반환', () => {
        expect(window.SampleUtils.formatArea(0)).toBe('0')
    })

    it('숫자 아닌 값 → "0"', () => {
        expect(window.SampleUtils.formatArea('abc')).toBe('0')
        expect(window.SampleUtils.formatArea(null)).toBe('0')
        expect(window.SampleUtils.formatArea(undefined)).toBe('0')
    })

    it('문자열 숫자 처리', () => {
        expect(window.SampleUtils.formatArea('500')).toBe('500')
    })
})

describe('formatAreaWithUnit', () => {
    it('m2 단위', () => {
        expect(window.SampleUtils.formatAreaWithUnit(100, 'm2')).toBe('100 ㎡')
    })

    it('pyeong 단위', () => {
        expect(window.SampleUtils.formatAreaWithUnit(100, 'pyeong')).toBe('100 평')
    })
})

describe('getUnitLabel', () => {
    it('pyeong → 평', () => {
        expect(window.SampleUtils.getUnitLabel('pyeong')).toBe('평')
    })

    it('m2 → ㎡', () => {
        expect(window.SampleUtils.getUnitLabel('m2')).toBe('㎡')
    })

    it('기본값 → ㎡', () => {
        expect(window.SampleUtils.getUnitLabel('')).toBe('㎡')
        expect(window.SampleUtils.getUnitLabel(undefined)).toBe('㎡')
    })
})

describe('generateUUID', () => {
    it('UUID 형식 반환', () => {
        const uuid = window.SampleUtils.generateUUID()
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })

    it('매번 다른 UUID 생성', () => {
        const a = window.SampleUtils.generateUUID()
        const b = window.SampleUtils.generateUUID()
        expect(a).not.toBe(b)
    })
})
