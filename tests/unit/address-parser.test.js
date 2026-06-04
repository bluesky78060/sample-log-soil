import { describe, it, expect, beforeAll } from 'vitest'

// address-parser.js를 import → window.expandSido / SIDO_LIST / SIDO_SHORT_MAP / parseAddressParts 노출 (SSOT)
beforeAll(async () => {
    await import('../../src/shared/address-parser.js')
})

describe('expandSido — 시도 약어→표준 전체명', () => {
    it('2023 개편 신명칭으로 통일 (강원/전북 불일치 해소)', () => {
        expect(window.expandSido('강원')).toBe('강원특별자치도')
        expect(window.expandSido('전북')).toBe('전북특별자치도')
    })
    it('일반 도 약어', () => {
        expect(window.expandSido('경북')).toBe('경상북도')
        expect(window.expandSido('경남')).toBe('경상남도')
        expect(window.expandSido('충북')).toBe('충청북도')
        expect(window.expandSido('경기')).toBe('경기도')
    })
    it('광역시 약어', () => {
        expect(window.expandSido('서울')).toBe('서울특별시')
        expect(window.expandSido('부산')).toBe('부산광역시')
        expect(window.expandSido('세종')).toBe('세종특별자치시')
    })
    it('이미 전체명이면 그대로(no-op)', () => {
        expect(window.expandSido('경상북도')).toBe('경상북도')
        expect(window.expandSido('강원특별자치도')).toBe('강원특별자치도')
        expect(window.expandSido('강원도')).toBe('강원도') // 구명칭도 보존(기존 데이터 안전)
    })
    it('매칭 없으면 원본 반환', () => {
        expect(window.expandSido('서울시')).toBe('서울시')
        expect(window.expandSido('봉화군')).toBe('봉화군')
    })
    it('falsy → 빈 문자열', () => {
        expect(window.expandSido('')).toBe('')
        expect(window.expandSido(null)).toBe('')
        expect(window.expandSido(undefined)).toBe('')
    })
})

describe('SIDO 상수 불변식', () => {
    it('SIDO_SHORT_MAP의 모든 전체명이 SIDO_LIST에 포함', () => {
        const missing = Object.values(window.SIDO_SHORT_MAP).filter(v => !window.SIDO_LIST.includes(v))
        expect(missing).toEqual([])
    })
    it('SIDO_LIST는 17개 시도 + 강원/전북 구명칭 포함(19개)', () => {
        expect(window.SIDO_LIST.length).toBe(19)
        expect(window.SIDO_LIST).toContain('강원특별자치도')
        expect(window.SIDO_LIST).toContain('강원도')
    })
})

describe('parseAddressParts — 주소 분해', () => {
    it('약어 시도 + 시군구 + 읍면동 + 나머지', () => {
        expect(window.parseAddressParts('경북 봉화군 봉화읍 내성리 123')).toEqual({
            sido: '경상북도', sigungu: '봉화군', eupmyeondong: '봉화읍', rest: '내성리 123',
        })
    })
    it('전체명 시도', () => {
        const r = window.parseAddressParts('강원특별자치도 춘천시 효자동 1-2')
        expect(r.sido).toBe('강원특별자치도')
        expect(r.sigungu).toBe('춘천시')
    })
    it('약어 강원 → 강원특별자치도로 정규화', () => {
        expect(window.parseAddressParts('강원 춘천시 효자동').sido).toBe('강원특별자치도')
    })
    it('성남시 분당구 (2단 시군구)', () => {
        const r = window.parseAddressParts('경기 성남시 분당구 정자동')
        expect(r.sido).toBe('경기도')
        expect(r.sigungu).toBe('성남시 분당구')
        expect(r.eupmyeondong).toBe('정자동')
    })
    it('우편번호 접두 제거', () => {
        expect(window.parseAddressParts('(12345) 경북 봉화군 봉화읍').sido).toBe('경상북도')
    })
    it('시도 없이 시군구로 시작', () => {
        const r = window.parseAddressParts('봉화군 봉화읍 내성리')
        expect(r.sido).toBe('')
        expect(r.sigungu).toBe('봉화군')
    })
    it('빈 입력/하이픈', () => {
        expect(window.parseAddressParts('')).toEqual({ sido: '', sigungu: '', eupmyeondong: '', rest: '' })
        expect(window.parseAddressParts('-')).toEqual({ sido: '', sigungu: '', eupmyeondong: '', rest: '' })
    })
})
