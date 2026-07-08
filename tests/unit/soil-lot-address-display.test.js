import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-182: 목록 화면 필지 주소 표시에서 선두 시도(경북 등)를 제거하는 헬퍼 검증.
//   formatLotAddressForDisplay는 this 미참조 순수 메서드 → prototype.call(null, address)로 직접 검증
//   (soil-flatten-fallback.test.js가 이 패턴의 import 안전성을 이미 입증).
//
//   critic MINOR-1: soil-script.js는 address-parser.js를 로드하지 않는다(로드는 soil-entry.js만).
//   window.parseAddressParts가 없으면 헬퍼가 방어 분기로 원본을 그대로 반환하므로,
//   soil-script.js보다 먼저 address-parser.js를 import해야 시도 제거 케이스가 통과한다.
let format

beforeAll(async () => {
    await import('../../src/shared/address-parser.js')
    await import('../../src/shared/BaseSampleManager.js')
    await import('../../src/soil/soil-log-record.js')
    await import('../../src/soil/soil-script.js')
    const fn = window.SoilSampleManager.prototype.formatLotAddressForDisplay
    format = (address) => fn.call(null, address)
})

describe('formatLotAddressForDisplay — 필지 주소 표시용 시도 제거 (SLS-1-182)', () => {
    it('단축형 시도 제거: 경북 → 제거', () => {
        expect(format('경북 봉화군 소천면 두음리 123-4')).toBe('봉화군 소천면 두음리 123-4')
    })

    it('전체형 시도 제거: 경상북도 → 제거', () => {
        expect(format('경상북도 봉화군 소천면 두음리 123-4')).toBe('봉화군 소천면 두음리 123-4')
    })

    it('(산) 접미가 있어도 나머지 텍스트 보존', () => {
        expect(format('경북 봉화군 소천면 산123-4 (산)')).toBe('봉화군 소천면 산123-4 (산)')
    })

    it('시도로 시작하지 않으면 원본 그대로(무변경)', () => {
        expect(format('봉화군 소천면 두음리 123-4')).toBe('봉화군 소천면 두음리 123-4')
    })

    it("빈 값/'-'는 '-' 반환", () => {
        expect(format('')).toBe('-')
        expect(format(null)).toBe('-')
        expect(format('-')).toBe('-')
    })

    it('시도만 있고 나머지가 없으면 원본 그대로(방어)', () => {
        expect(format('경북')).toBe('경북')
    })
})

describe('formatLotAddressForDisplay — window.parseAddressParts 미로드 시 방어', () => {
    it('파서가 없으면 원본을 그대로 반환', () => {
        const saved = window.parseAddressParts
        delete window.parseAddressParts
        try {
            expect(format('경북 봉화군 소천면 두음리 123-4')).toBe('경북 봉화군 소천면 두음리 123-4')
        } finally {
            window.parseAddressParts = saved
        }
    })
})
