import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// SLS-1-192 백포트 검증
// 기존 soil base의 filterAndRenderLogs는 필터 없이 전건을 렌더했다(무력화).
// 크래시가 없어 수동 스모크로는 절대 탐지되지 않는 유형이므로, 이 테스트가
// 백포트된 필터 계층이 실제로 동작하는지 보증하는 유일한 자산이다.

beforeAll(async () => {
    await import('../../src/shared/BaseSampleManager.js')
})

function createManager() {
    return new window.BaseSampleManager({
        moduleKey: 'test',
        moduleName: '테스트',
        storageKey: 'testSampleLogs',
        autoSaveFile: 'test-autosave.json'
    })
}

describe('생성자 필터 상태 기본값', () => {
    it('currentSearchFilter가 6개 키로 초기화된다', () => {
        const m = createManager()
        expect(m.currentSearchFilter).toEqual({
            dateFrom: '', dateTo: '', name: '',
            receptionFrom: '', receptionTo: '', completed: ''
        })
    })
})

describe('matchesNameFilter', () => {
    let m
    beforeEach(() => { m = createManager() })

    it('필터가 비어 있으면 전건 통과', () => {
        expect(m.matchesNameFilter({ name: '홍길동' })).toBe(true)
    })

    it('부분 일치를 허용한다', () => {
        m.currentSearchFilter.name = '길동'
        expect(m.matchesNameFilter({ name: '홍길동' })).toBe(true)
        expect(m.matchesNameFilter({ name: '김철수' })).toBe(false)
    })

    it('name이 없는 레코드도 예외 없이 처리', () => {
        m.currentSearchFilter.name = '홍'
        expect(m.matchesNameFilter({})).toBe(false)
    })
})

describe('extractReceptionNumber', () => {
    let m
    beforeEach(() => { m = createManager() })

    it('끝의 숫자를 추출한다', () => {
        expect(m.extractReceptionNumber('503')).toBe(503)
        expect(m.extractReceptionNumber('F503')).toBe(503)
    })

    it('하이픈 뒤 인덱스가 있으면 그 숫자를 반환한다', () => {
        expect(m.extractReceptionNumber('503-2')).toBe(2)
    })

    it('숫자가 없거나 빈 값이면 0', () => {
        expect(m.extractReceptionNumber('')).toBe(0)
        expect(m.extractReceptionNumber(null)).toBe(0)
        expect(m.extractReceptionNumber('abc')).toBe(0)
    })
})

describe('matchesReceptionFilter', () => {
    let m
    beforeEach(() => { m = createManager() })

    it('범위 미지정이면 전건 통과', () => {
        expect(m.matchesReceptionFilter({ receptionNumber: '999' })).toBe(true)
    })

    it('from만 지정하면 이상만 통과', () => {
        m.currentSearchFilter.receptionFrom = '100'
        expect(m.matchesReceptionFilter({ receptionNumber: '150' })).toBe(true)
        expect(m.matchesReceptionFilter({ receptionNumber: '50' })).toBe(false)
    })

    it('to만 지정하면 이하만 통과', () => {
        m.currentSearchFilter.receptionTo = '100'
        expect(m.matchesReceptionFilter({ receptionNumber: '50' })).toBe(true)
        expect(m.matchesReceptionFilter({ receptionNumber: '150' })).toBe(false)
    })

    it('양쪽 지정 시 경계 포함', () => {
        m.currentSearchFilter.receptionFrom = '100'
        m.currentSearchFilter.receptionTo = '200'
        expect(m.matchesReceptionFilter({ receptionNumber: '100' })).toBe(true)
        expect(m.matchesReceptionFilter({ receptionNumber: '200' })).toBe(true)
        expect(m.matchesReceptionFilter({ receptionNumber: '201' })).toBe(false)
    })
})

describe('matchesDateFilter', () => {
    let m
    beforeEach(() => { m = createManager() })

    it('범위 미지정이면 전건 통과', () => {
        expect(m.matchesDateFilter({ date: '2026-07-26' })).toBe(true)
    })

    it('dateFrom 이후만 통과', () => {
        m.currentSearchFilter.dateFrom = '2026-07-01'
        expect(m.matchesDateFilter({ date: '2026-07-26' })).toBe(true)
        expect(m.matchesDateFilter({ date: '2026-06-30' })).toBe(false)
    })

    it('dateTo 이전만 통과 (경계 포함)', () => {
        m.currentSearchFilter.dateTo = '2026-07-26'
        expect(m.matchesDateFilter({ date: '2026-07-26' })).toBe(true)
        expect(m.matchesDateFilter({ date: '2026-07-27' })).toBe(false)
    })
})

describe('matchesCompletedFilter', () => {
    let m
    beforeEach(() => { m = createManager() })

    it("기본값('')은 전건 통과", () => {
        expect(m.matchesCompletedFilter({ isComplete: true })).toBe(true)
        expect(m.matchesCompletedFilter({ isComplete: false })).toBe(true)
    })

    it("'completed'는 isComplete === true만", () => {
        m.currentSearchFilter.completed = 'completed'
        expect(m.matchesCompletedFilter({ isComplete: true })).toBe(true)
        expect(m.matchesCompletedFilter({ isComplete: false })).toBe(false)
        expect(m.matchesCompletedFilter({})).toBe(false)
    })

    it("'incomplete'는 미완료만 (필드 부재 포함)", () => {
        m.currentSearchFilter.completed = 'incomplete'
        expect(m.matchesCompletedFilter({ isComplete: false })).toBe(true)
        expect(m.matchesCompletedFilter({})).toBe(true)
        expect(m.matchesCompletedFilter({ isComplete: true })).toBe(false)
    })

    it('completed가 아닌 isComplete 필드를 본다 (퇴비 규약과 일치)', () => {
        m.currentSearchFilter.completed = 'completed'
        // completed:true만 있고 isComplete가 없으면 완료로 보지 않는다
        expect(m.matchesCompletedFilter({ completed: true })).toBe(false)
    })
})

describe('getFilterKeys 기본값', () => {
    it('completed를 제외한 5개 키를 반환한다', () => {
        const m = createManager()
        expect(m.getFilterKeys()).toEqual(
            ['dateFrom', 'dateTo', 'name', 'receptionFrom', 'receptionTo']
        )
    })

    it('completed는 목록에 없다 (updateSearchButtonState에서 별도 판정)', () => {
        const m = createManager()
        expect(m.getFilterKeys()).not.toContain('completed')
    })
})

describe('matchesTypeSpecificFilters 훅', () => {
    it('기본 구현은 항상 통과시킨다', () => {
        const m = createManager()
        expect(m.matchesTypeSpecificFilters({})).toBe(true)
    })
})

describe('filterAndRenderLogs 결선', () => {
    let m
    beforeEach(() => {
        m = createManager()
        m.sampleLogs = [
            { id: '1', name: '홍길동', receptionNumber: '100', date: '2026-07-01', isComplete: true },
            { id: '2', name: '김철수', receptionNumber: '200', date: '2026-07-15', isComplete: false },
            { id: '3', name: '홍길순', receptionNumber: '300', date: '2026-07-30', isComplete: false }
        ]
    })

    it('필터가 비어 있으면 전건을 렌더한다', () => {
        let rendered = null
        m.renderLogs = (logs) => { rendered = logs }
        m.filterAndRenderLogs()
        expect(rendered).toHaveLength(3)
    })

    it('성명 필터가 실제로 적용된다 (백포트 전에는 무시되던 경로)', () => {
        let rendered = null
        m.renderLogs = (logs) => { rendered = logs }
        m.currentSearchFilter.name = '홍'
        m.filterAndRenderLogs()
        expect(rendered.map(l => l.id)).toEqual(['1', '3'])
    })

    it('완료 필터가 실제로 적용된다', () => {
        let rendered = null
        m.renderLogs = (logs) => { rendered = logs }
        m.currentSearchFilter.completed = 'incomplete'
        m.filterAndRenderLogs()
        expect(rendered.map(l => l.id)).toEqual(['2', '3'])
    })

    it('복수 조건이 AND로 결합된다', () => {
        let rendered = null
        m.renderLogs = (logs) => { rendered = logs }
        m.currentSearchFilter.name = '홍'
        m.currentSearchFilter.completed = 'incomplete'
        m.filterAndRenderLogs()
        expect(rendered.map(l => l.id)).toEqual(['3'])
    })

    it('접수번호 범위와 날짜 범위가 함께 적용된다', () => {
        let rendered = null
        m.renderLogs = (logs) => { rendered = logs }
        m.currentSearchFilter.receptionFrom = '150'
        m.currentSearchFilter.dateTo = '2026-07-20'
        m.filterAndRenderLogs()
        expect(rendered.map(l => l.id)).toEqual(['2'])
    })
})
