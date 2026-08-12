import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SLS-1-226: 라벨 주소·우편번호 추출
//
// 🚨 이 파일이 막는 것: 엑셀로 가져온 건의 라벨이 **이름만 나오고 주소가 비던** 결함.
//
// 원인은 가져오기가 아니라 **라벨 함수 쪽이었다.** _extractLabelAddress의 이전 버전은
// log.address만 재파싱했는데, 가져오기는 addressRoad만 채우고 address는 비워둔다.
// address 규약(address.js:340)이 "우편번호 없으면 빈 문자열"이라 주소까지 통째로 사라졌다.
//
// ⚠️ 이 파일의 다른 소비처는 전부 addressRoad를 먼저 본다(목록 :3732, 등록결과 :3315,
//    공익직불제 :4997). Base에도 같은 훅이 있고 퇴비는 그걸 쓴다. 라벨만 달랐다.
//
// ⚠️ 1번이 핵심이다. 이게 없으면 "address만 읽기"로 되돌려도 아무 테스트가 안 죽는다.

const SRC = readFileSync(resolve(process.cwd(), 'src/soil/soil-script.js'), 'utf8')

let extractFn
beforeAll(async () => {
    await import('../../src/shared/BaseSampleManager.js')
    await import('../../src/soil/soil-script.js')
    // ⚠️ window.soilManager는 DOMContentLoaded에서 만들어져 유닛 환경엔 없다.
    //    클래스 프로토타입에서 직접 뽑는다 — 이 메서드는 this를 쓰지 않는 순수 로직이다.
    const Cls = window.SoilSampleManager
    expect(Cls, 'SoilSampleManager가 전역에 없다').toBeTruthy()
    extractFn = Cls.prototype._extractLabelAddress
    expect(extractFn, '_extractLabelAddress가 프로토타입에 없다').toBeTypeOf('function')
})

const extract = (log) => extractFn.call({}, log)

describe('분리 필드를 우선한다 (엑셀 가져오기 경로)', () => {
    // 🚨 CRITICAL 회귀 가드 — 이 케이스가 실제 신고 증상이다
    it('1. address가 비어도 addressRoad만 있으면 주소가 나온다', () => {
        const r = extract({
            name: '이제식',
            addressRoad: '경상북도 봉화군 봉화읍 내성리 100',
            address: '',            // ← 가져오기가 채우지 않던 칸
            addressPostcode: '',
        })
        expect(r.address, 'addressRoad를 안 읽어 주소가 비었다').toBe('경상북도 봉화군 봉화읍 내성리 100')
    })

    it('2. addressPostcode가 우편번호로 쓰인다', () => {
        const r = extract({
            addressRoad: '경상북도 봉화군 봉화읍 내성리 100',
            addressPostcode: '36628',
        })
        expect(r.postalCode).toBe('36628')
        // 주소에는 우편번호가 섞이지 않는다
        expect(r.address).not.toMatch(/36628/)
    })

    it('3. addressDetail이 주소에 붙는다', () => {
        const r = extract({
            addressRoad: '경상북도 봉화군 봉화읍 내성리 100',
            addressDetail: '2층 201호',
            addressPostcode: '36628',
        })
        expect(r.address).toBe('경상북도 봉화군 봉화읍 내성리 100 2층 201호')
    })

    // 🚨 codex 리뷰 MAJOR — addressRoad는 있는데 우편번호가 레거시 address에만 남은 혼합 레코드.
    //    분리 필드만 보면 주소는 나오는데 우편번호만 조용히 사라진다.
    it('4-b. 혼합: addressPostcode가 비면 address 접두에서 우편번호를 보완한다', () => {
        const r = extract({
            addressRoad: '경상북도 봉화군 봉화읍 내성리 100',
            addressPostcode: '',
            address: '(36628) 경상북도 봉화군 봉화읍 내성리 100',
        })
        expect(r.address).toBe('경상북도 봉화군 봉화읍 내성리 100')
        expect(r.postalCode, '혼합 레코드에서 우편번호가 유실됐다').toBe('36628')
    })

    it('4. 분리 필드가 레거시 address보다 우선한다', () => {
        const r = extract({
            addressRoad: '새 도로명 100',
            addressPostcode: '11111',
            address: '(99999) 옛날 주소 999',
        })
        expect(r.address).toBe('새 도로명 100')
        expect(r.postalCode).toBe('11111')
    })
})

describe('레거시 데이터 호환', () => {
    it('5. addressRoad가 없으면 address를 재파싱한다', () => {
        const r = extract({ address: '(36628) 경상북도 봉화군 봉화읍 내성리 100' })
        expect(r.address).toBe('경상북도 봉화군 봉화읍 내성리 100')
        expect(r.postalCode).toBe('36628')
    })

    it('6. 접두 없는 레거시 address도 주소는 나온다', () => {
        const r = extract({ address: '경상북도 봉화군 봉화읍 내성리 100' })
        expect(r.address).toBe('경상북도 봉화군 봉화읍 내성리 100')
        expect(r.postalCode).toBe('')
    })

    it('7. 아무것도 없으면 빈 값', () => {
        const r = extract({})
        expect(r.address).toBe('')
        expect(r.postalCode).toBe('')
    })
})

describe('이 파일의 다른 소비처와 일관된다', () => {
    // 목록·등록결과·공익직불제가 전부 addressRoad를 먼저 본다.
    // 라벨만 다시 어긋나면 같은 결함이 재발한다.
    it('8. 라벨 추출이 addressRoad를 참조한다', () => {
        const fnSrc = SRC.slice(SRC.indexOf('_extractLabelAddress(log) {'))
            .slice(0, 900)
        expect(fnSrc, '_extractLabelAddress가 addressRoad를 안 본다').toContain('addressRoad')
        expect(fnSrc, 'addressPostcode를 안 본다').toContain('addressPostcode')
    })
})
