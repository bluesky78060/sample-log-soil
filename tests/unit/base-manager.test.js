import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

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

describe('safeParseArray', () => {
    let manager

    beforeEach(() => {
        manager = createManager()
        localStorage.clear()
    })

    it('유효한 배열 파싱', () => {
        localStorage.setItem('key', JSON.stringify([{ id: 1 }, { id: 2 }]))
        expect(manager.safeParseArray('key')).toEqual([{ id: 1 }, { id: 2 }])
    })

    it('키 없으면 빈 배열', () => {
        expect(manager.safeParseArray('nonexistent')).toEqual([])
    })

    it('빈 문자열이면 빈 배열', () => {
        localStorage.setItem('key', '')
        expect(manager.safeParseArray('key')).toEqual([])
    })

    it('배열이 아닌 값이면 빈 배열', () => {
        localStorage.setItem('key', JSON.stringify({ foo: 'bar' }))
        expect(manager.safeParseArray('key')).toEqual([])
    })

    it('잘못된 JSON이면 빈 배열', () => {
        localStorage.setItem('key', 'not-json{{{')
        expect(manager.safeParseArray('key')).toEqual([])
    })

    it('null 저장값이면 빈 배열', () => {
        localStorage.setItem('key', JSON.stringify(null))
        expect(manager.safeParseArray('key')).toEqual([])
    })
})

describe('smartMerge 폴백 (SyncUtils 없을 때)', () => {
    let manager

    beforeEach(() => {
        manager = createManager()
        // SyncUtils 없음 → 폴백 로직 사용
        window.SyncUtils = undefined
    })

    it('로컬이 Firebase를 덮어씀 (같은 id)', () => {
        const local = [{ id: '1', value: 'local', updatedAt: '2026-01-02' }]
        const firebase = [{ id: '1', value: 'firebase', updatedAt: '2026-01-01' }]
        const result = manager.smartMerge(local, firebase)
        expect(result).toHaveLength(1)
        expect(result[0].value).toBe('local')
    })

    it('로컬과 Firebase 합쳐짐 (다른 id)', () => {
        const local = [{ id: '1', value: 'a' }]
        const firebase = [{ id: '2', value: 'b' }]
        const result = manager.smartMerge(local, firebase)
        expect(result).toHaveLength(2)
        const ids = result.map(r => r.id)
        expect(ids).toContain('1')
        expect(ids).toContain('2')
    })

    it('id 없는 항목도 보존', () => {
        const local = [{ id: '1', value: 'a' }, { value: 'no-id' }]
        const firebase = []
        const result = manager.smartMerge(local, firebase)
        expect(result).toHaveLength(2)
        expect(result.some(r => r.value === 'no-id')).toBe(true)
    })

    it('null/undefined 입력 안전 처리', () => {
        expect(manager.smartMerge(null, null)).toEqual([])
        expect(manager.smartMerge([], [])).toEqual([])
        expect(manager.smartMerge([{ id: '1' }], null)).toHaveLength(1)
    })
})

describe('updateRecordCount', () => {
    it('미완료 있으면 건수+미완료 표시', () => {
        const manager = createManager()
        const el = document.createElement('span')
        manager.recordCountEl = el
        manager.sampleLogs = [
            { isComplete: true },
            { isComplete: false },
            { isComplete: false }
        ]
        manager.updateRecordCount()
        expect(el.textContent).toBe('3건 (미완료 2건)')
    })

    it('전원 완료면 "총 N건"', () => {
        const manager = createManager()
        const el = document.createElement('span')
        manager.recordCountEl = el
        manager.sampleLogs = [{ isComplete: true }, { isComplete: true }]
        manager.updateRecordCount()
        expect(el.textContent).toBe('총 2건')
    })

    it('빈 목록이면 "총 0건"', () => {
        const manager = createManager()
        const el = document.createElement('span')
        manager.recordCountEl = el
        manager.sampleLogs = []
        manager.updateRecordCount()
        expect(el.textContent).toBe('총 0건')
    })
})
