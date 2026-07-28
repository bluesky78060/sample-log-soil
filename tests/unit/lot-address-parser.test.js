import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-200: 지번 주소 파서 공유 모듈
//
// 토양 흙토람(41열)과 퇴·액비 검정결과(36열)가 같은 규칙으로 주소를 쪼개야 한다.
// 두 벌을 쓰면 같은 주소가 페이지마다 다르게 나뉜다.
//
// shared/address-parser.js의 parseAddressParts와 다르다:
//   parseAddressParts → { sido, sigungu, eupmyeondong, rest }
//   parseLotAddress   → + ri, isMountain, jibun1, jibun2
// 흙토람 양식이 리·산·지번1·지번2를 별도 열로 요구한다.

beforeAll(async () => {
    await import('../../src/shared/address-parser.js')   // SIDO_LIST 선행
    await import('../../src/shared/lot-address-parser.js')
})

const P = (s) => window.parseLotAddress(s)

describe('parseLotAddress', () => {
    it('1. 시도·시군구·읍면동·리·지번을 분해한다', () => {
        expect(P('경상북도 봉화군 봉화읍 문단리 699-2')).toEqual({
            sido: '경상북도', sigungu: '봉화군', eupmyeondong: '봉화읍', ri: '문단리',
            isMountain: false, jibun1: '699', jibun2: '2'
        })
    })

    it('2. 지번2가 없으면 빈 문자열이다', () => {
        expect(P('경상북도 봉화군 봉화읍 문단리 699').jibun2).toBe('')
        expect(P('경상북도 봉화군 봉화읍 문단리 699').jibun1).toBe('699')
    })

    it('3. 산 지번을 표시한다 (양식의 지번구분 열)', () => {
        const r = P('경상북도 봉화군 봉화읍 문단리 산 12-3')
        expect(r.isMountain).toBe(true)
        expect(r.jibun1).toBe('12')
        expect(r.jibun2).toBe('3')
    })

    it('4. 시도가 없으면 시군구로 추론한다', () => {
        const r = P('봉화군 봉화읍 문단리 699')
        expect(r.sido).toBe('경상북도')
        expect(r.sigungu).toBe('봉화군')
    })

    it('5. 이중 구를 합쳐 인식한다 (성남시 분당구)', () => {
        const r = P('경기도 성남시 분당구 정자동 178')
        expect(r.sigungu).toBe('성남시 분당구')
        expect(r.eupmyeondong).toBe('정자동')
    })

    it('6. 리가 없는 주소도 처리한다', () => {
        const r = P('경기도 성남시 분당구 정자동 178')
        expect(r.ri).toBe('')
        expect(r.jibun1).toBe('178')
    })

    it('7. "읍-리" 형식에서 실제 리명만 뽑는다', () => {
        expect(P('경상북도 봉화군 봉화읍 봉화읍-문단리 699').ri).toBe('문단리')
    })

    it('8. 빈 값·하이픈은 빈 결과를 준다 (throw하지 않는다)', () => {
        const empty = {
            sido: '', sigungu: '', eupmyeondong: '', ri: '',
            isMountain: false, jibun1: '', jibun2: ''
        }
        expect(P('')).toEqual(empty)
        expect(P(null)).toEqual(empty)
        expect(P('-')).toEqual(empty)
    })

    it('9. 전국 시군구 매핑이 동작한다 (시도 없는 주소 추론)', () => {
        // SIGUNGU_TO_SIDO는 모듈 내부에 둔다(전역 노출 없음 — 소비처가 없다).
        // 매핑 자체는 파서 동작으로 검증한다.
        expect(P('봉화군 봉화읍 문단리 699').sido).toBe('경상북도')
        expect(P('창원시 의창구 북면 감계리 100').sido).toBe('경상남도')
        expect(P('완주군 이서면 금평리 4000').sido).toBe('전북특별자치도')
    })
})
