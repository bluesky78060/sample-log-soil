import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'

let realSyncUtils

beforeAll(async () => {
    // 실제 SyncUtils.smartMerge를 window에 노출시켜 loadYearData 결선 테스트가
    // 진짜 병합 로직을 거치도록 한다 (폴백 테스트는 별도로 window.SyncUtils=undefined 설정)
    await import('../../src/shared/sync-utils.js')
    await import('../../src/shared/BaseSampleManager.js')
    realSyncUtils = window.SyncUtils  // 폴백 테스트가 undefined로 덮은 뒤 복원용
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

describe('loadYearData smartMerge 결선(wiring)', () => {
    let manager

    beforeEach(() => {
        localStorage.clear()
        window.SyncUtils = realSyncUtils  // 폴백 테스트가 덮은 실제 SyncUtils 복원
        manager = createManager()
        // loadYearData가 의존하는 부수효과 메서드는 스텁 (DOM/파일 I/O 회피)
        manager.filterAndRenderLogs = () => {}
        manager.updateRecordCount = () => {}
        manager.triggerAutoSave = () => {}
        // Firebase 캐시 비활성(TTL 0) → 매번 loadFromFirebase 경유
        manager._firebaseCache = new Map()
        manager._firebaseCacheTTL = 0
        manager._firebaseCacheMax = 10
    })

    afterEach(() => {
        delete window.firebaseConfig
    })

    function wire(firebaseLogs, fromCache = false) {
        window.firebaseConfig = { isEnabled: () => true }
        // 실제 loadFromFirebase(year)와 시그니처를 맞춰 둠
        // SLS-1-121: loadFromFirebase는 { data, fromCache } 객체를 반환한다
        manager.loadFromFirebase = async (_year) => ({ data: firebaseLogs, fromCache })
    }

    const ids = (arr) => arr.map(r => r.id).sort()

    it('오프라인 로컬 추가분(syncedAt 없음) 보존 + 클라우드 신규 병합', async () => {
        const year = 2026
        const key = manager.getStorageKey(year)
        // 로컬: A=오프라인 신규(syncedAt 없음), B=동기화됨(클라우드에도 존재)
        const local = [
            { id: 'A', receptionNumber: '1', updatedAt: '2026-01-01' },
            { id: 'B', receptionNumber: '2', syncedAt: '2026-01-01', updatedAt: '2026-01-01' },
        ]
        localStorage.setItem(key, JSON.stringify(local))
        // 클라우드: B(최신), C(신규)
        wire([
            { id: 'B', receptionNumber: '2', updatedAt: '2026-02-01' },
            { id: 'C', receptionNumber: '3', updatedAt: '2026-02-01' },
        ])

        await manager.loadYearData(year)

        // 통째 교체가 아니라 smartMerge 경유 → A 보존, C 병합
        expect(ids(manager.sampleLogs)).toEqual(['A', 'B', 'C'])
        // B는 클라우드가 더 최신 → 클라우드 버전 채택
        const b = manager.sampleLogs.find(r => r.id === 'B')
        expect(b.updatedAt).toBe('2026-02-01')
    })

    it('클라우드에서 삭제된(syncedAt 있는데 클라우드에 없음) 레코드 전파 삭제', async () => {
        const year = 2026
        const key = manager.getStorageKey(year)
        // 로컬: D=과거 동기화됨(syncedAt) 그러나 클라우드에 없음 → 삭제 대상
        const local = [
            { id: 'D', receptionNumber: '4', syncedAt: '2026-01-01', updatedAt: '2026-01-01' },
            { id: 'E', receptionNumber: '5', updatedAt: '2026-01-01' }, // 오프라인 신규 → 보존
        ]
        localStorage.setItem(key, JSON.stringify(local))
        // 클라우드는 비어있지 않아야 smartMerge가 동작(빈 응답이면 로컬 유지 안전가드).
        // D는 클라우드 목록에 없음 → 삭제 전파 대상.
        wire([{ id: 'F', receptionNumber: '6', updatedAt: '2026-02-01' }])

        await manager.loadYearData(year)

        const resultIds = ids(manager.sampleLogs)
        expect(resultIds).not.toContain('D') // 삭제 전파
        expect(resultIds).toContain('E')     // 오프라인 신규 보존
        expect(resultIds).toContain('F')     // 클라우드 신규 병합
    })

    it('SLS-1-121: fromCache=true면 cross-device 삭제 보류 (캐시 읽기 데이터 보존)', async () => {
        const year = 2026
        const key = manager.getStorageKey(year)
        // 로컬: D=과거 동기화됨(syncedAt) 그러나 캐시 응답에 없음 → 평소라면 삭제 대상
        const local = [
            { id: 'D', receptionNumber: '4', syncedAt: '2026-01-01', updatedAt: '2026-01-01' },
            { id: 'E', receptionNumber: '5', updatedAt: '2026-01-01' },
        ]
        localStorage.setItem(key, JSON.stringify(local))
        // 클라우드(캐시) 응답: F만. fromCache=true → D 삭제 보류해야 함
        wire([{ id: 'F', receptionNumber: '6', updatedAt: '2026-02-01' }], true)

        await manager.loadYearData(year)

        const resultIds = ids(manager.sampleLogs)
        expect(resultIds).toContain('D') // 캐시 읽기 → 삭제 보류(보존)
        expect(resultIds).toContain('E') // 오프라인 신규 보존
        expect(resultIds).toContain('F') // 클라우드 신규 병합
    })

    it('클라우드 빈 응답이면 로컬 유지(전멸 방지 안전가드 — smartMerge 미경유)', async () => {
        const year = 2026
        const key = manager.getStorageKey(year)
        const local = [
            { id: 'D', receptionNumber: '4', syncedAt: '2026-01-01', updatedAt: '2026-01-01' },
            { id: 'E', receptionNumber: '5', updatedAt: '2026-01-01' },
        ]
        localStorage.setItem(key, JSON.stringify(local))
        wire([]) // 빈 클라우드 → loadYearData는 length>0이 아니면 로컬 그대로 사용

        await manager.loadYearData(year)

        // 삭제 전파하지 않고 로컬 보존 (트랜션트 빈 응답으로 인한 데이터 유실 방지)
        expect(ids(manager.sampleLogs)).toEqual(['D', 'E'])
    })

    it('병합 결과를 localStorage(연도 키)에 저장', async () => {
        const year = 2026
        const key = manager.getStorageKey(year)
        localStorage.setItem(key, JSON.stringify([
            { id: 'A', receptionNumber: '1', updatedAt: '2026-01-01' },
        ]))
        wire([{ id: 'C', receptionNumber: '3', updatedAt: '2026-02-01' }])

        await manager.loadYearData(year)

        const persisted = JSON.parse(localStorage.getItem(key))
        expect(ids(persisted)).toEqual(['A', 'C'])
    })
})
