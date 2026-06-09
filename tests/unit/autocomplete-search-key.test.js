import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// autocomplete-manager.js를 import → window.AddressAutocomplete 노출 (IIFE)
// 테스트 대상: 리 단독 입력 시 기본 시·도 prefix 검색 키 생성 (SLS-1-117)
beforeAll(async () => {
    await import('../../src/shared/autocomplete-manager.js')
})

beforeEach(() => {
    localStorage.clear()
})

const extract = (v) => window.AddressAutocomplete._extractVillageAndLot(v)
const buildKey = (parsed, region) => window.AddressAutocomplete._buildJusoSearchKey(parsed, region)

describe('extractVillageAndLot — isBareVillage 판별', () => {
    it('리 단독 입력은 isBareVillage=true', () => {
        expect(extract('삼계리')).toMatchObject({ village: '삼계리', isBareVillage: true })
        expect(extract('문단리')).toMatchObject({ village: '문단리', isBareVillage: true })
    })
    it('리 + 지번/산도 isBareVillage=true', () => {
        expect(extract('삼계리 123')).toMatchObject({ village: '삼계리', lotNumber: '123', isBareVillage: true })
        expect(extract('삼계리 산 12-3')).toMatchObject({ village: '삼계리', hasMountainKeyword: true, lotNumber: '12-3', isBareVillage: true })
    })
    it('시·도/시·군 포함 복합 입력은 isBareVillage=false', () => {
        expect(extract('봉화읍 삼계리')).toMatchObject({ isBareVillage: false })
        expect(extract('경상북도 봉화군 삼계리')).toMatchObject({ isBareVillage: false })
    })
    it('동(洞) 단독도 isBareVillage=true', () => {
        expect(extract('내성동')).toMatchObject({ village: '내성동', isBareVillage: true })
    })
})

describe('buildJusoSearchKey — 기본 시·도 prefix', () => {
    it('리 단독 + 기본 시·도 설정 → "시·도 리"로 prefix', () => {
        expect(buildKey(extract('삼계리'), '경상북도')).toBe('경상북도 삼계리')
    })
    it('리 단독 + 기본 시·도 미설정(빈 문자열) → 리만', () => {
        expect(buildKey(extract('삼계리'), '')).toBe('삼계리')
    })
    it('시·도 포함 복합 입력 → prefix 안 함(중복 방지)', () => {
        // isBareVillage=false 이므로 village(=전체 trimmed) 그대로
        expect(buildKey(extract('봉화읍 삼계리'), '경상북도')).toBe('봉화읍 삼계리')
    })
    it('정식 시·도+시·군 포함 입력 → 이중 prefix 안 됨', () => {
        expect(buildKey(extract('경상북도 봉화군 삼계리'), '경상북도')).toBe('경상북도 봉화군 삼계리')
    })
    it('region 인자 생략 시 localStorage app_default_sido 조회', () => {
        localStorage.setItem('app_default_sido', '충청남도')
        expect(buildKey(extract('삼계리'))).toBe('충청남도 삼계리')
    })
    it('localStorage 미설정이면 리만', () => {
        expect(buildKey(extract('삼계리'))).toBe('삼계리')
    })
    it('지번 포함 리 단독도 village만 prefix(지번은 JUSO 검색에서 제외)', () => {
        expect(buildKey(extract('삼계리 123'), '경상북도')).toBe('경상북도 삼계리')
    })
})
