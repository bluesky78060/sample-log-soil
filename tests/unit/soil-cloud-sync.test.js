import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

// SLS-1-122: 클라우드 동기화 직렬화 락(cloudSyncPromise) + 삭제 실패 재시도 큐 테스트
//   - firebaseBatchSync: 동시 호출 시 batchSave가 직렬로 실행되는지
//   - firebaseDeleteRecords: 삭제 실패 id가 _pendingCloudDeletes에 적재되는지
//   - _retryCloudSyncAction: 보류 삭제를 먼저 재시도하고 성공분만 큐에서 제거하는지

beforeAll(async () => {
    // soil-script.js의 extends 대상이 먼저 window에 노출돼야 한다
    await import('../../src/shared/BaseSampleManager.js')
    // 채번/레코드/그룹 순수 로직 (soil-script 평가 시 직접 참조하진 않지만 안전하게 선로딩)
    await import('../../src/soil/soil-script.js')
})

function createSoilManager() {
    // 생성자는 필드 초기화만 수행 (createFileAPI 미정의 → FileAPI undefined) — jsdom 안전
    const m = new window.SoilSampleManager()
    m.selectedYear = '2026'
    // 부수효과 스텁 (DOM/토스트 회피)
    m.showToast = () => {}
    m.log = () => {}
    return m
}

// 지정한 지연 후 resolve/reject 하는 deferred 헬퍼
function deferred() {
    let resolve, reject
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
}

describe('firebaseBatchSync 직렬화 락 (cloudSyncPromise)', () => {
    let manager
    afterEach(() => { delete window.firestoreDb })

    beforeEach(() => {
        manager = createSoilManager()
        manager.sampleLogs = [{ id: 'A', receptionNumber: '1' }]
    })

    it('비활성(firestore disabled)이면 batchSave 미호출 + 락 미설정', async () => {
        window.firestoreDb = { isEnabled: () => false, batchSave: vi.fn() }
        await manager.firebaseBatchSync()
        expect(window.firestoreDb.batchSave).not.toHaveBeenCalled()
        expect(manager.cloudSyncPromise).toBe(null)
    })

    it('동시 2회 호출 시 batchSave가 직렬(겹치지 않게) 실행된다', async () => {
        const d1 = deferred()
        const d2 = deferred()
        let active = 0
        let maxActive = 0
        const calls = []
        window.firestoreDb = {
            isEnabled: () => true,
            batchSave: vi.fn((_m, _y, snapshot) => {
                calls.push(snapshot.map(r => r.id))
                active++
                maxActive = Math.max(maxActive, active)
                const d = calls.length === 1 ? d1 : d2
                return d.promise.then(() => { active-- })
            })
        }

        const p1 = manager.firebaseBatchSync()
        const p2 = manager.firebaseBatchSync()  // 첫 작업 완료 전 진입 → 대기해야 함

        // 두 번째는 아직 batchSave를 호출하지 않았어야 한다 (직렬화)
        await Promise.resolve()
        expect(window.firestoreDb.batchSave).toHaveBeenCalledTimes(1)

        d1.resolve()
        await p1
        // p2의 continuation(두 번째 batchSave 진입)이 별도 마이크로태스크에서 돌므로 한 틱 양보
        await new Promise(r => setTimeout(r, 0))
        // 첫 작업 종료 후 두 번째 batchSave 시작
        expect(window.firestoreDb.batchSave).toHaveBeenCalledTimes(2)

        d2.resolve()
        await p2

        // 두 batchSave가 동시에 active였던 적이 없어야 한다 (락 보장)
        expect(maxActive).toBe(1)
        // 마지막 작업 종료 후 락 해제
        expect(manager.cloudSyncPromise).toBe(null)
    })

    it('batchSave 거부 시에도 직렬성 유지 + 락 해제', async () => {
        window.firestoreDb = {
            isEnabled: () => true,
            batchSave: vi.fn(() => Promise.reject(new Error('network')))
        }
        await manager.firebaseBatchSync()
        // 실패해도 락은 해제되어 다음 호출 가능
        expect(manager.cloudSyncPromise).toBe(null)
        await manager.firebaseBatchSync()
        expect(window.firestoreDb.batchSave).toHaveBeenCalledTimes(2)
    })
})

describe('firebaseDeleteRecords 실패 큐잉 (_pendingCloudDeletes)', () => {
    let manager
    afterEach(() => { delete window.firestoreDb })

    beforeEach(() => {
        manager = createSoilManager()
    })

    it('삭제 성공 시 큐가 비어있다', async () => {
        window.firestoreDb = { isEnabled: () => true, delete: vi.fn(() => Promise.resolve()) }
        manager.firebaseDeleteRecords(['X', 'Y'])
        await new Promise(r => setTimeout(r, 0))
        expect(manager._pendingCloudDeletes.size).toBe(0)
    })

    it('일부 삭제 실패 시 실패 id만 큐에 적재 + 실패 핸들러 호출', async () => {
        window.firestoreDb = {
            isEnabled: () => true,
            delete: vi.fn((_m, _y, id) => id === 'BAD' ? Promise.reject(new Error('fail')) : Promise.resolve())
        }
        const spy = vi.spyOn(manager, '_handleCloudSyncFailure')
        manager.firebaseDeleteRecords(['GOOD', 'BAD'])
        await new Promise(r => setTimeout(r, 0))
        expect(manager._pendingCloudDeletes.has('BAD')).toBe(true)
        expect(manager._pendingCloudDeletes.has('GOOD')).toBe(false)
        expect(spy).toHaveBeenCalled()
    })
})

describe('_retryCloudSyncAction 보류 삭제 재시도', () => {
    let manager
    afterEach(() => { delete window.firestoreDb })

    beforeEach(() => {
        manager = createSoilManager()
        manager.sampleLogs = []
    })

    it('보류 삭제 재시도 성공 시 큐에서 제거 후 전체 동기화', async () => {
        const deleteFn = vi.fn(() => Promise.resolve(true))
        const batchSave = vi.fn(() => Promise.resolve(true))
        window.firestoreDb = { isEnabled: () => true, delete: deleteFn, batchSave }
        manager.sampleLogs = [{ id: 'R1' }] // 빈 스냅샷이면 batchSave 생략되므로 시드
        manager._pendingCloudDeletes.add('D1')
        manager._pendingCloudDeletes.add('D2')

        manager._retryCloudSyncAction()
        await new Promise(r => setTimeout(r, 0))

        expect(deleteFn).toHaveBeenCalledTimes(2)
        expect(manager._pendingCloudDeletes.size).toBe(0)  // 성공분 전부 제거
        expect(batchSave).toHaveBeenCalled()               // 이후 전체 동기화
    })

    it('재시도 일부 실패 시 실패분은 큐에 남고 실패 핸들러 재무장', async () => {
        window.firestoreDb = {
            isEnabled: () => true,
            delete: vi.fn((_m, _y, id) => id === 'D2' ? Promise.reject(new Error('x')) : Promise.resolve()),
            batchSave: vi.fn(() => Promise.resolve())
        }
        const spy = vi.spyOn(manager, '_handleCloudSyncFailure')
        manager._pendingCloudDeletes.add('D1')
        manager._pendingCloudDeletes.add('D2')

        manager._retryCloudSyncAction()
        await new Promise(r => setTimeout(r, 0))

        expect(manager._pendingCloudDeletes.has('D1')).toBe(false)  // 성공
        expect(manager._pendingCloudDeletes.has('D2')).toBe(true)   // 실패분 잔존
        expect(spy).toHaveBeenCalled()
    })

    it('보류 삭제 없으면 전체 동기화만 수행', () => {
        const batchSave = vi.fn(() => Promise.resolve(true))
        window.firestoreDb = { isEnabled: () => true, delete: vi.fn(), batchSave }
        manager.sampleLogs = [{ id: 'R1' }] // 빈 스냅샷이면 batchSave 생략되므로 시드
        manager._retryCloudSyncAction()
        expect(batchSave).toHaveBeenCalled()
        expect(window.firestoreDb.delete).not.toHaveBeenCalled()
    })

    it('빈 sampleLogs면 batchSave를 호출하지 않음 (거짓 실패→재시도 루프 방지)', async () => {
        const batchSave = vi.fn(() => Promise.resolve(false)) // 빈 배열이면 false 반환하는 실제 의미
        window.firestoreDb = { isEnabled: () => true, delete: vi.fn(), batchSave }
        const spy = vi.spyOn(manager, '_handleCloudSyncFailure')
        manager.sampleLogs = []
        await manager.firebaseBatchSync()
        expect(batchSave).not.toHaveBeenCalled()
        expect(spy).not.toHaveBeenCalled()
    })

    it('delete가 false로 resolve해도 실패로 판정해 큐에 적재 (false-resolve)', async () => {
        window.firestoreDb = {
            isEnabled: () => true,
            delete: vi.fn((_m, _y, id) => Promise.resolve(id !== 'BAD')) // BAD만 false resolve
        }
        const spy = vi.spyOn(manager, '_handleCloudSyncFailure')
        manager.firebaseDeleteRecords(['GOOD', 'BAD'])
        await new Promise(r => setTimeout(r, 0))
        expect(manager._pendingCloudDeletes.has('BAD')).toBe(true)
        expect(manager._pendingCloudDeletes.has('GOOD')).toBe(false)
        expect(spy).toHaveBeenCalled()
    })

    it('batchSave가 false로 resolve하면 실패 핸들러 호출 (false-resolve)', async () => {
        const batchSave = vi.fn(() => Promise.resolve(false))
        window.firestoreDb = { isEnabled: () => true, delete: vi.fn(), batchSave }
        const spy = vi.spyOn(manager, '_handleCloudSyncFailure')
        manager.sampleLogs = [{ id: 'R1' }]
        await manager.firebaseBatchSync()
        expect(batchSave).toHaveBeenCalled()
        expect(spy).toHaveBeenCalled()
    })

    it('firestore 비활성 + 보류 삭제 있으면 실패 상태 재무장 (다음 online 대기)', () => {
        window.firestoreDb = { isEnabled: () => false, delete: vi.fn(), batchSave: vi.fn() }
        const spy = vi.spyOn(manager, '_handleCloudSyncFailure')
        manager._pendingCloudDeletes.add('D1')
        manager._retryCloudSyncAction()
        expect(spy).toHaveBeenCalled()
        expect(window.firestoreDb.batchSave).not.toHaveBeenCalled()
        expect(manager._pendingCloudDeletes.has('D1')).toBe(true)
    })
})
