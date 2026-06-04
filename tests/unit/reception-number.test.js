import { describe, it, expect, beforeAll } from 'vitest'

// reception-number.js를 import → window.ReceptionNumber 노출
let RN
beforeAll(async () => {
    await import('../../src/soil/reception-number.js')
    RN = window.ReceptionNumber
})

const log = (receptionNumber, landClass1, subCategory) => ({ receptionNumber, landClass1, subCategory })

describe('computeNextNumber — 일반(성토 아님) 채번', () => {
    const next = (logs, target, opts) => RN.computeNextNumber(logs, target, opts)

    it('빈 배열이면 1', () => {
        expect(next([], '농가의뢰')).toBe(1)
        expect(next(null, '농가의뢰')).toBe(1)
        expect(next(undefined, '농가의뢰')).toBe(1)
    })

    it('같은 경지구분 내 max+1', () => {
        const logs = [log('1', '농가의뢰'), log('3', '농가의뢰'), log('2', '농가의뢰')]
        expect(next(logs, '농가의뢰')).toBe(4)
    })

    it('경지구분 1차별로 독립 채번', () => {
        const logs = [log('5', '개량제'), log('2', '농가의뢰'), log('1', '개량제')]
        expect(next(logs, '농가의뢰')).toBe(3)  // 농가의뢰 max=2 → 3
        expect(next(logs, '개량제')).toBe(6)    // 개량제 max=5 → 6
        expect(next(logs, '직불')).toBe(1)      // 없음 → 1
    })

    it('landClass1 누락 로그는 defaultClass(농가의뢰)로 간주', () => {
        const logs = [log('2', undefined), log('4', null)]
        expect(next(logs, '농가의뢰')).toBe(5)
    })

    it('가지번호(12-3)는 본번(12)만 인식', () => {
        const logs = [log('5-2', '농가의뢰'), log('5-3', '농가의뢰')]
        expect(next(logs, '농가의뢰')).toBe(6)
    })

    it('성토(F) 번호는 일반 채번에서 제외', () => {
        const logs = [log('1', '농가의뢰'), log('F3', '농가의뢰', '성토')]
        expect(next(logs, '농가의뢰')).toBe(2)  // F3 무시 → max=1 → 2
    })

    it('receptionNumber 없는 로그는 무시', () => {
        const logs = [log('', '농가의뢰'), log(null, '농가의뢰'), log('3', '농가의뢰')]
        expect(next(logs, '농가의뢰')).toBe(4)
    })

    it('비숫자 본번은 무시', () => {
        const logs = [log('abc', '농가의뢰')]
        expect(next(logs, '농가의뢰')).toBe(1)
    })

    it('targetClass 미지정 시 defaultClass 기준', () => {
        const logs = [log('7', '농가의뢰')]
        expect(next(logs)).toBe(8)  // target 생략 → 농가의뢰
    })

    it('opts.defaultClass 지정 시 누락 로그를 그 분류로 간주', () => {
        const logs = [log('3', undefined)]
        expect(next(logs, '개량제', { defaultClass: '개량제' })).toBe(4)
    })
})

describe('computeNextNumber — 성토(F) 채번', () => {
    const nextFill = (logs, target) => RN.computeNextNumber(logs, target, { fill: true })

    it('성토만 집계하여 max+1 (F 접두 제거 후 숫자)', () => {
        const logs = [log('F2', '농가의뢰', '성토'), log('F5', '농가의뢰', '성토'), log('3', '농가의뢰')]
        expect(nextFill(logs, '농가의뢰')).toBe(6)  // 성토 max=5 → 6 (일반 3 무시)
    })

    it('성토 없으면 1', () => {
        const logs = [log('3', '농가의뢰')]
        expect(nextFill(logs, '농가의뢰')).toBe(1)
    })

    it('성토도 경지구분 1차별 독립', () => {
        const logs = [log('F4', '개량제', '성토'), log('F1', '농가의뢰', '성토')]
        expect(nextFill(logs, '농가의뢰')).toBe(2)
        expect(nextFill(logs, '개량제')).toBe(5)
    })

    it('fill + defaultClass 조합: 누락 로그를 커스텀 기본분류로 간주', () => {
        const logs = [log('F3', undefined, '성토')] // landClass1 누락 성토
        expect(RN.computeNextNumber(logs, '개량제', { fill: true, defaultClass: '개량제' })).toBe(4)
        // 기본분류가 다르면 매칭 안 됨 → 1
        expect(RN.computeNextNumber(logs, '개량제', { fill: true })).toBe(1)
    })
})
