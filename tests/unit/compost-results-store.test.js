import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

// SLS-1-204: 퇴·액비 검정결과 저장소 단일 진실원
//
// 배경: 검정결과 페이지(src/compost-analysis/)가 별도 창에서 같은 데이터를 읽고 쓴다.
// 양쪽이 각자 localStorage를 만지면 어긋나는 순간 데이터가 갈라진다.
//
// 이 파일은 (1) 저장소 자체의 계약과 (2) 매니저 래퍼가 저장소에 위임하는지를 고정한다.
// 삭제된 compost-sync-guard.spec.js가 검증하던 Firestore 동기화 계약 중,
// 동기화와 무관하게 유효한 것(judgment ''가 1급 상태)도 여기서 이어받는다.

beforeAll(async () => {
    await import('../../src/shared/compost-results-store.js')
    await import('../../src/shared/BaseSampleManager.js')
    await import('../../src/compost/compost-script.js')
})

const S = () => window.CompostResultsStore

function createManager(year = '2026') {
    const m = new window.CompostSampleManager()
    m.selectedYear = year
    m.sampleLogs = []
    m.log = () => {}
    m.showToast = vi.fn()
    return m
}

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.restoreAllMocks() })

describe('CompostResultsStore — 저장소 계약', () => {
    it('1. 저장한 값을 그대로 읽는다 (왕복)', () => {
        S().save('2026', { c1: { moisture: '62.1', maturity: '부숙완료' } })
        expect(S().load('2026')).toEqual({ c1: { moisture: '62.1', maturity: '부숙완료' } })
    })

    it('2. 값이 없으면 빈 객체를 준다 (null/undefined 아님)', () => {
        expect(S().load('2026')).toEqual({})
    })

    it('3. 연도별로 분리된다', () => {
        S().save('2025', { c1: { moisture: '50' } })
        S().save('2026', { c1: { moisture: '70' } })
        expect(S().load('2025').c1.moisture).toBe('50')
        expect(S().load('2026').c1.moisture).toBe('70')
    })

    it("4. judgment ''(미판정)이 1급 상태로 보존된다", () => {
        // '' 자체가 "미판정"이라는 유효 상태다. falsy라고 흘리면 판정을 지운 것이 사라진다.
        S().save('2026', { c1: { judgment: '' } })
        expect(S().load('2026').c1.judgment).toBe('')
        expect('judgment' in S().load('2026').c1).toBe(true)
    })

    it('5. 손상된 JSON이면 빈 객체로 폴백하고 throw하지 않는다', () => {
        localStorage.setItem(S().key('2026'), '{깨진 JSON')
        expect(() => S().load('2026')).not.toThrow()
        expect(S().load('2026')).toEqual({})
    })

    it('6. quota 초과 시 false를 반환하고 throw하지 않는다', () => {
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e
        })
        expect(S().save('2026', { c1: {} })).toBe(false)
    })

    it('7. 정상 저장은 true를 반환한다 (6의 대조군)', () => {
        expect(S().save('2026', { c1: {} })).toBe(true)
    })
})

describe('매니저 래퍼 — 저장소에 위임한다', () => {
    it('8. loadAllCompostTestResults가 저장소를 읽는다', () => {
        S().save('2026', { c1: { moisture: '62.1' } })
        expect(createManager('2026').loadAllCompostTestResults()).toEqual({ c1: { moisture: '62.1' } })
    })

    it('9. saveAllCompostTestResults가 저장소에 쓴다 — 다른 화면이 읽을 수 있다', () => {
        createManager('2026').saveAllCompostTestResults({ c1: { maturity: '부숙후기' } })
        // 매니저를 거치지 않고 저장소로 직접 읽는다 = 별도 창이 보는 경로
        expect(S().load('2026').c1.maturity).toBe('부숙후기')
    })

    it('10. 저장 실패(quota)에도 캐시는 갱신된다 — 방금 입력한 값이 사라져 보이지 않도록', () => {
        const m = createManager('2026')
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e
        })
        m.saveAllCompostTestResults({ c1: { moisture: '99' } })
        expect(m._cachedCompostResults.c1.moisture).toBe('99')
    })

    // 코드리뷰 MAJOR-1: 반환값을 버리면 quota 실패에도 "저장되었습니다"가 뜬다.
    // 검정결과 저장소에만 있는 검사일자·구리·아연·염분은 어디에도 안 남는데 성공이라 알린다.
    it('10b. 저장 성공/실패를 boolean으로 호출부에 전달한다', () => {
        const m = createManager('2026')
        expect(m.saveAllCompostTestResults({ c1: {} })).toBe(true)

        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e
        })
        expect(m.saveAllCompostTestResults({ c1: {} })).toBe(false)
    })

    it('11. 연도를 바꾸면 캐시가 비워진다', () => {
        const m = createManager('2026')
        m._cachedCompostResults = { c1: {} }
        m.updateListViewTitle = () => {}
        m.onYearChange('2025')
        expect(m._cachedCompostResults).toBeNull()
    })
})

describe('Firestore 동기화 제거 확인 (SLS-1-204)', () => {
    it('12. 검정결과 동기화 메서드가 존재하지 않는다', () => {
        const m = createManager()
        expect(m.syncCompostTestResultsToFirestore).toBeUndefined()
        expect(m.syncCompostTestResultsFromFirestore).toBeUndefined()
    })

    it('13. 저장이 firestoreDb를 건드리지 않는다', () => {
        const batchSave = vi.fn()
        window.firestoreDb = { isEnabled: () => true, batchSave }
        try {
            createManager('2026').saveAllCompostTestResults({ c1: { moisture: '62' } })
        } finally {
            window.firestoreDb = { isEnabled: () => false }
        }
        expect(batchSave).not.toHaveBeenCalled()
    })
})
