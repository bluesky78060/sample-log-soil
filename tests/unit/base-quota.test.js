import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

// SLS-1-198: localStorage 용량 초과(QuotaExceededError) 시 저장 도미노 중단 회귀 가드
//
// 수정 전에는 saveLogs의 quota 분기가 return하여 Firebase batchSave·자동저장 파일·
// 카운트·onAfterSave 훅이 전부 함께 죽었다(soil 오버라이드도 동일 버그 복제 보유).
// 이 파일은 "quota가 나도 나머지 경로는 계속 진행된다"를 양쪽 구현체에 대해 고정한다.
//
// 환경 주의:
// - setup.js가 window.firestoreDb를 isEnabled:false로 고정하므로 클라우드 케이스는
//   테스트 내에서 반드시 오버라이드해야 한다 (안 하면 batchSave 케이스는 구조적으로 통과 불가).
// - utils.js를 import하지 않는다 — _warnIfStorageNearFull이 SampleUtils 옵셔널 체이닝으로
//   자연 스킵되어 setup.js의 localStorage 목(for-in 열거 불가)과 충돌하지 않는 것까지가 계약.

beforeAll(async () => {
    await import('../../src/shared/BaseSampleManager.js')
    await import('../../src/soil/soil-script.js')
})

const quotaError = () => {
    const e = new Error('quota')
    e.name = 'QuotaExceededError'
    return e
}

function createBaseManager() {
    const m = new window.BaseSampleManager({
        moduleKey: 'compost',
        moduleName: '퇴비테스트',
        storageKey: 'compostSampleLogs',
        autoSaveFile: 'compost-autosave.json'
    })
    m.selectedYear = '2026'
    m.sampleLogs = [{ id: 'c1', receptionNumber: '101', name: '홍길동' }]
    m.showToast = vi.fn()
    m.log = () => {}
    m.onBeforeSave = () => null
    m.onAfterSave = vi.fn()
    m.triggerAutoSave = vi.fn()
    m.updateRecordCount = vi.fn()
    return m
}

function createSoilManager() {
    const m = new window.SoilSampleManager()
    m.selectedYear = '2026'
    m.sampleLogs = [{ id: 's1', receptionNumber: '503', name: '홍길동' }]
    m.showToast = vi.fn()
    m.log = () => {}
    m.onBeforeSave = () => null
    m.autoSaveToFile = vi.fn()
    m.updateRecordCount = vi.fn()
    return m
}

beforeEach(() => {
    localStorage.clear()
    sessionStorage.removeItem('storageQuotaWarned')
})
afterEach(() => {
    vi.restoreAllMocks()
    delete window.firestoreDb
    delete window.isElectron
})

describe('base saveLogs — quota에도 나머지 경로 진행 (퇴비 경로)', () => {
    it('1. quota에도 Firebase batchSave가 호출된다', async () => {
        const batchSave = vi.fn().mockResolvedValue(true)
        window.firestoreDb = { isEnabled: () => true, batchSave }
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })

        const m = createBaseManager()
        await m.saveLogs()

        expect(batchSave).toHaveBeenCalledTimes(1)
        expect(batchSave.mock.calls[0][2]).toHaveLength(1)   // 메모리 최신 상태가 올라감
    })

    it('2. quota에도 triggerAutoSave·onAfterSave·updateRecordCount가 호출된다', async () => {
        window.firestoreDb = { isEnabled: () => false }
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })

        const m = createBaseManager()
        await m.saveLogs()

        expect(m.triggerAutoSave).toHaveBeenCalledTimes(1)
        expect(m.onAfterSave).toHaveBeenCalledTimes(1)
        expect(m.updateRecordCount).toHaveBeenCalledTimes(1)
        expect(m._localSaveFailed).toBe(true)
    })

    it('6. quota가 아닌 예외는 여전히 throw된다 (기존 계약 보존)', async () => {
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('disk on fire') })
        const m = createBaseManager()
        await expect(m.saveLogs()).rejects.toThrow('disk on fire')
    })

    it('7. 정상 경로 동작 불변 — 저장되고 플래그는 false', async () => {
        const m = createBaseManager()
        await m.saveLogs()
        expect(JSON.parse(localStorage.getItem('compostSampleLogs_2026'))).toHaveLength(1)
        expect(m._localSaveFailed).toBe(false)
        expect(m.triggerAutoSave).toHaveBeenCalledTimes(1)
    })
})

describe('soil saveLogs 오버라이드 — quota에도 파일 자동저장 진행 (토양 경로)', () => {
    it('3. quota에도 autoSaveToFile·updateRecordCount가 호출된다', async () => {
        // 자동저장 활성 조건을 spy 설치 전에 세팅 (getItem은 스파이 대상 아님)
        localStorage.setItem('soilAutoSaveEnabled', 'true')
        const m = createSoilManager()
        m.autoSaveFileHandle = {}   // 웹 File System Access 경로
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })

        await m.saveLogs()

        expect(m.autoSaveToFile).toHaveBeenCalledTimes(1)
        expect(m.updateRecordCount).toHaveBeenCalledTimes(1)
        expect(m._localSaveFailed).toBe(true)
    })

    it('3b. soil 경로의 quota 토스트는 클라우드 문구를 쓰지 않는다 (업로드는 호출부 담당)', async () => {
        window.firestoreDb = { isEnabled: () => true, batchSave: vi.fn() }   // 활성이어도
        localStorage.setItem('soilAutoSaveEnabled', 'true')
        const m = createSoilManager()
        m.autoSaveFileHandle = {}
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })

        await m.saveLogs()

        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).not.toContain('클라우드')
        expect(messages).toContain('자동저장 파일')
    })
})

describe('토스트 정직성', () => {
    it('4. 로컬+클라우드 동시 실패 시 "이 컴퓨터에 저장되어 있습니다"가 나오지 않는다', async () => {
        const batchSave = vi.fn().mockRejectedValue(new Error('network down'))
        window.firestoreDb = { isEnabled: () => true, batchSave }
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })

        const m = createBaseManager()
        await m.saveLogs()
        await new Promise(r => setTimeout(r, 0))   // batchSave .catch 정착 대기

        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).not.toContain('이 컴퓨터에 저장되어 있습니다')
        expect(messages).toContain('어디에도 저장되지 않았습니다')
    })

    it('4b. 레이스: 저장#2가 성공해도 저장#1의 실패 콜백은 캡처된 상황으로 판단한다', async () => {
        let rejectFirst
        const batchSave = vi.fn()
            .mockImplementationOnce(() => new Promise((_, rej) => { rejectFirst = rej }))
            .mockResolvedValue(true)
        window.firestoreDb = { isEnabled: () => true, batchSave }

        const m = createBaseManager()
        // 저장#1: quota 실패 + 클라우드 in-flight
        const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })
        await m.saveLogs()
        // 저장#2: 로컬 성공 → 인스턴스 플래그 리셋
        spy.mockRestore()
        await m.saveLogs()
        expect(m._localSaveFailed).toBe(false)
        // 이제 저장#1의 클라우드가 실패 정착
        rejectFirst(new Error('late failure'))
        await new Promise(r => setTimeout(r, 0))

        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        // 캡처된 localSaveFailed=true가 전달됐으므로 강한 경고여야 한다
        expect(messages).toContain('어디에도 저장되지 않았습니다')
    })

    it('4c. 선행 클라우드 장애 후 quota — 클라우드를 백업으로 세지 않고, 전면 유실 경고로 승격된다 (MAJOR-1 회귀)', async () => {
        // 저장#1: 로컬 성공 + 클라우드 실패 → 완만한 경고, _cloudSyncFailed = true
        const batchSave = vi.fn().mockRejectedValue(new Error('network down'))
        window.firestoreDb = { isEnabled: () => true, batchSave }
        const m = createBaseManager()
        await m.saveLogs()
        await new Promise(r => setTimeout(r, 0))
        expect(m._cloudSyncFailed).toBe(true)

        // 저장#2: 로컬도 quota 실패 = 어디에도 저장되지 않음
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })
        await m.saveLogs()
        await new Promise(r => setTimeout(r, 0))

        const after = m.showToast.mock.calls.map(c => c[0])
        // quota 토스트가 장애 중인 클라우드를 백업이라고 말하면 안 된다
        const quotaToast = after.find(t => t.includes('가득 찼') || t.includes('저장되지 않습니다'))
        expect(quotaToast).toBeDefined()
        expect(quotaToast).not.toContain('클라우드')
        // 중복 방지 가드가 전면 유실 경고를 삼키면 안 된다 (심각도 승격 1회 허용)
        expect(after.join('\n')).toContain('어디에도 저장되지 않았습니다')
    })

    // 코드리뷰 MINOR-9: online 복귀 핸들러가 _cloudSyncFailed만 되돌리고 severe를 남기면,
    // stale severe가 다음 장애 사이클의 전면 유실 경고를 삼킨다.
    it('4d. 온라인 복귀 뒤 새 장애 사이클에서 전면 유실 경고가 다시 나온다 (MINOR-9 회귀)', async () => {
        const m = createBaseManager()
        m._retryCloudSyncAction = vi.fn()
        const severeCount = () =>
            m.showToast.mock.calls.filter(c => c[0].includes('어디에도 저장되지 않았습니다')).length

        m._handleCloudSyncFailure(true)          // 사이클1: 전면 유실
        expect(severeCount()).toBe(1)
        m._handleCloudSyncFailure(true)          // 같은 사이클 중복은 여전히 억제
        expect(severeCount()).toBe(1)

        window.dispatchEvent(new Event('online')) // 복귀 → 새 장애 사이클 시작
        expect(m._cloudSyncFailedSevere).toBe(false)

        m._handleCloudSyncFailure(false)         // 사이클2: 클라우드만 실패(완만)
        m._handleCloudSyncFailure(true)          // 사이클2: 다시 전면 유실 → 승격 재허용
        expect(severeCount()).toBe(2)
    })

    it('5. Electron이지만 자동저장 비활성이면 "기록됩니다" 안심 문구가 나오지 않는다', async () => {
        window.isElectron = true
        window.firestoreDb = { isEnabled: () => false }
        // soilAutoSaveEnabled / compostAutoSaveEnabled 미설정 = 자동저장 꺼짐
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })

        const m = createBaseManager()
        await m.saveLogs()

        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).not.toContain('기록됩니다')
        expect(messages).toContain('저장되지 않습니다')
    })

    it('5b. 웹 + base(퇴비): 파일 핸들이 있어도 base는 웹 파일 기록 경로가 없다 — 안심 문구 금지 (MAJOR-2 회귀)', async () => {
        // base의 triggerAutoSave는 Electron 전용. 핸들 보유 + 자동저장 ON이어도
        // 웹에서는 실제로 아무것도 기록되지 않으므로 "기록됩니다"는 거짓 안심이다.
        window.firestoreDb = { isEnabled: () => false }
        localStorage.setItem('compostAutoSaveEnabled', 'true')
        const m = createBaseManager()
        m.autoSaveFileHandle = {}   // 핸들만 있는 상태 (window.isElectron 미설정 = 웹)
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })

        await m.saveLogs()

        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).not.toContain('기록됩니다')
        expect(messages).toContain('저장되지 않습니다')
    })

    it('5c. 웹 + soil: 저장 시 파일 기록을 자체 수행하므로(_webAutoSaveOnSave) 파일 백업으로 인정된다', async () => {
        window.firestoreDb = { isEnabled: () => false }
        localStorage.setItem('soilAutoSaveEnabled', 'true')
        const m = createSoilManager()
        m.autoSaveFileHandle = {}
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })

        await m.saveLogs()

        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).toContain('자동저장 파일')
        expect(messages).not.toContain('저장되지 않습니다')
    })
})

describe('deleteSample — quota 시에도 클라우드 삭제는 수행, success 토스트는 억제', () => {
    it('8. base: firestoreDb.delete 호출됨 + "삭제되었습니다" 미출력', async () => {
        const del = vi.fn().mockResolvedValue(true)
        window.firestoreDb = { isEnabled: () => true, batchSave: vi.fn().mockResolvedValue(true), delete: del }
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })

        const m = createBaseManager()
        m.filterAndRenderLogs = vi.fn()
        await m.deleteSample('c1')

        expect(del).toHaveBeenCalledWith('compost', 2026, 'c1')
        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).not.toContain('삭제되었습니다')
    })

    it('8b. soil: success 토스트 억제 (오버라이드 경로)', async () => {
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })
        const m = createSoilManager()
        m.filterAndRenderLogs = vi.fn()
        m.firebaseDeleteRecords = vi.fn()
        m.cancelEditMode = vi.fn()
        await m.deleteSample('s1')

        expect(m.firebaseDeleteRecords).toHaveBeenCalledWith('s1')
        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).not.toContain('삭제되었습니다')
    })

    it('8c. soil deleteGroup: success 토스트 억제 (세 번째 삭제 경로)', async () => {
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })
        const m = createSoilManager()
        m.sampleLogs = [
            { id: 's1', receptionNumber: '503', groupId: 'g1' },
            { id: 's2', receptionNumber: '503-1', groupId: 'g1' }
        ]
        m.filterAndRenderLogs = vi.fn()
        m.firebaseDeleteRecords = vi.fn()
        m.cancelEditMode = vi.fn()
        await m.deleteGroup('g1', '503')

        expect(m.firebaseDeleteRecords).toHaveBeenCalledWith(['s1', 's2'])
        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).not.toContain('삭제되었습니다')
    })
})

describe('핸드오프 setItem 가드 (라벨 인쇄)', () => {
    it('9. quota 시 라벨 데이터 전달 실패를 알리고 throw하지 않는다', async () => {
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })
        const m = createBaseManager()
        m.getLabelAddressParts = (log) => ({ address: log.addressRoad || '', postalCode: '' })

        expect(() => m.openLabelPrintWithData([{ name: '홍길동', addressRoad: '행복로 12' }]))
            .not.toThrow()
        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).toContain('라벨 데이터를 전달하지 못했습니다')
    })

    // 코드리뷰 MINOR-10: 라벨(케이스 9)과 구조가 동일한 흙토람 가드가 무보호였다.
    // "쌍 중 한쪽만 챙기는" 패턴이 테스트 층에서 재현되지 않도록 함께 고정한다.
    it('9b. quota 시 흙토람 데이터 전달 실패를 알리고 창을 열지 않는다', async () => {
        document.body.innerHTML = '<button id="heuktoramBtn"></button>'
        const prevUtils = window.SampleUtils
        // utils.js는 의도적으로 import하지 않는다(파일 상단 주석 참조) — 바인딩에 필요한
        // 셋업 헬퍼만 no-op으로 세우고, getLocalStorageUsage는 두지 않아 옵셔널 체이닝 스킵을 유지한다.
        window.SampleUtils = {
            setupJSONSaveHandler: () => {},
            setupJSONLoadHandler: () => {},
            setupAutoSaveFolderButton: () => {},
            setupAutoSaveToggle: () => {}
        }
        const openHeuktoram = vi.fn()
        window.electronAPI = { isElectron: true, openHeuktoram }
        const m = createSoilManager()
        m.getSelectedIds = () => ['s1']
        try {
            m._bindExportImportAndIO()
            vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw quotaError() })
            document.getElementById('heuktoramBtn').click()
        } finally {
            window.SampleUtils = prevUtils
            delete window.electronAPI
            document.body.innerHTML = ''
        }

        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).toContain('흙토람 데이터를 전달하지 못했습니다')
        // 가드가 return하지 않고 흘러가면 빈 데이터로 창이 열린다
        expect(openHeuktoram).not.toHaveBeenCalled()
    })
})

describe('_warnIfStorageNearFull — 사전 경고', () => {
    // 코드리뷰 MINOR-10: Number.isFinite 가드를 !usage로 되돌려도 죽지 않던 구멍을 막는다.
    it('10. usage.percent가 유한값이 아니면 "NaN%" 경고가 새어 나오지 않는다', async () => {
        const prevUtils = window.SampleUtils
        window.SampleUtils = { getLocalStorageUsage: () => ({ percent: NaN }) }
        const m = createBaseManager()
        try {
            await m.saveLogs()
        } finally {
            window.SampleUtils = prevUtils
        }

        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).not.toContain('NaN')
        expect(messages).not.toContain('저장 공간의')
        // fail-open이 아니라 "판정 불가 시 침묵"이므로 스로틀 플래그도 서지 않는다
        expect(sessionStorage.getItem('storageQuotaWarned')).toBeNull()
    })

    it('10b. 정상적으로 80%를 넘으면 경고가 나온다 (10의 대조군)', async () => {
        const prevUtils = window.SampleUtils
        window.SampleUtils = { getLocalStorageUsage: () => ({ percent: 85 }) }
        const m = createBaseManager()
        try {
            await m.saveLogs()
        } finally {
            window.SampleUtils = prevUtils
        }

        const messages = m.showToast.mock.calls.map(c => c[0]).join('\n')
        expect(messages).toContain('저장 공간의 85%')
    })
})
