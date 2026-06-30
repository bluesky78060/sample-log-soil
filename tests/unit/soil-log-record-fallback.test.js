import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-164: parcels[0] stub 폴백 헬퍼 — window.SoilLogRecord에 노출
let resolveParcelCategory, resolveParcelPurpose, cropsFromDisplay

beforeAll(async () => {
    await import('../../src/soil/soil-log-record.js')
    resolveParcelCategory = window.SoilLogRecord.resolveParcelCategory
    resolveParcelPurpose = window.SoilLogRecord.resolveParcelPurpose
    cropsFromDisplay = window.SoilLogRecord.cropsFromDisplay
})

describe('resolveParcelCategory (SLS-1-164)', () => {
    it('필지값이 있으면 그대로 우선', () => {
        expect(resolveParcelCategory('논', { subCategory: '밭' })).toBe('논')
    })
    it('필지값이 비면 최상위 subCategory로 폴백', () => {
        expect(resolveParcelCategory('', { subCategory: '과수' })).toBe('과수')
        expect(resolveParcelCategory(undefined, { subCategory: '시설' })).toBe('시설')
    })
    it('공백만 있는 필지값은 폴백 발동', () => {
        expect(resolveParcelCategory('   ', { subCategory: '임야' })).toBe('임야')
    })
    it("최상위가 '-' 센티넬이면 무시하고 빈 문자열", () => {
        expect(resolveParcelCategory('', { subCategory: '-' })).toBe('')
    })
    it('양쪽 다 비면 빈 문자열', () => {
        expect(resolveParcelCategory('', {})).toBe('')
        expect(resolveParcelCategory('', null)).toBe('')
    })
})

describe('resolveParcelPurpose (SLS-1-164)', () => {
    it('필지값 우선, 없으면 최상위 purpose 폴백', () => {
        expect(resolveParcelPurpose('자가소비', { purpose: '판매' })).toBe('자가소비')
        expect(resolveParcelPurpose('', { purpose: '판매' })).toBe('판매')
    })
    it("'-' 및 빈 값 가드", () => {
        expect(resolveParcelPurpose('', { purpose: '-' })).toBe('')
        expect(resolveParcelPurpose(undefined, undefined)).toBe('')
    })
})

describe('cropsFromDisplay (SLS-1-164, 방어적)', () => {
    it("cropsDisplay가 '-'거나 비면 빈 배열", () => {
        expect(cropsFromDisplay({ cropsDisplay: '-', area: '100' })).toEqual([])
        expect(cropsFromDisplay({ cropsDisplay: '', area: '100' })).toEqual([])
        expect(cropsFromDisplay({})).toEqual([])
        expect(cropsFromDisplay(null)).toEqual([])
    })
    it('단일 작물 — area를 첫 작물에 부여', () => {
        expect(cropsFromDisplay({ cropsDisplay: '벼', area: '300' }))
            .toEqual([{ name: '벼', area: '300' }])
    })
    it('다작물 — 첫 작물에만 area 집중(best-effort), 나머지 빈 area', () => {
        expect(cropsFromDisplay({ cropsDisplay: '벼, 콩, 배추', area: '500' }))
            .toEqual([
                { name: '벼', area: '500' },
                { name: '콩', area: '' },
                { name: '배추', area: '' }
            ])
    })
    it('공백·빈 토큰 제거', () => {
        expect(cropsFromDisplay({ cropsDisplay: ' 벼 ,  , 콩 ', area: '' }))
            .toEqual([{ name: '벼', area: '' }, { name: '콩', area: '' }])
    })
})
