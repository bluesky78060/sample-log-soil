/**
 * @fileoverview 통합 스토리지 매니저
 * @description Firebase 초기화 + 마이그레이션 + 동기화 상태 제공 모듈
 *
 * 동작 방식:
 * 1. Firebase 설정이 있으면 → CLOUD_SYNC 모드 (Firestore 활성화)
 * 2. Firebase 설정이 없으면 → LOCAL_ONLY 모드 (localStorage만 사용)
 *
 * ⚠️ 데이터 CRUD는 이 모듈이 아니라 BaseSampleManager(loadYearData/saveToStorage)와
 *    firestore-db.js를 통해 수행한다. 과거 이 모듈에 있던 save/saveItem/load/delete/
 *    subscribe 등 CRUD API는 호출처가 없어 제거됨(SLS-1-105). 남은 책임은
 *    초기화(init)·클라우드 마이그레이션(migrate)·동기화 상태 조회(getStatus)뿐이다.
 */

// 스토리지 모드
const STORAGE_MODE = {
    LOCAL_ONLY: 'local',      // localStorage만 사용
    CLOUD_SYNC: 'cloud'       // Firestore + localStorage 동기화
};

// 현재 모드
let currentMode = STORAGE_MODE.LOCAL_ONLY;

/** @type {boolean} 디버그 모드 (프로덕션에서는 false) */
const DEBUG_STORAGE = false;

/** 조건부 로깅 */
const logStorage = (...args) => DEBUG_STORAGE && console.log('[Storage]', ...args);

// 동기화 상태 (getStatus로 노출 — main-init.js의 상태 UI가 소비)
let syncStatus = {
    lastSyncTime: null,
    pendingChanges: 0,
    isOnline: navigator.onLine
};

// 온라인/오프라인 상태 추적 (isOnline은 getSyncStatus가 사용)
window.addEventListener('online', () => {
    syncStatus.isOnline = true;
    logStorage('네트워크 연결됨');
});

window.addEventListener('offline', () => {
    syncStatus.isOnline = false;
    logStorage('오프라인 모드 - 로컬 저장소 사용');
});

/**
 * 스토리지 매니저 초기화
 * @returns {Promise<string>} 현재 스토리지 모드
 */
async function initStorageManager() {
    // Firebase 초기화 시도 (인증 파일에서 설정을 로드함)
    if (window.firebaseConfig?.initialize) {
        try {
            const initialized = await window.firebaseConfig.initialize();
            if (initialized) {
                await window.firestoreDb?.init();
                currentMode = STORAGE_MODE.CLOUD_SYNC;
                logStorage('클라우드 동기화 모드');
            }
        } catch (err) {
            (window.logger?.warn || console.warn)('[Storage] Firebase 초기화 실패:', err);
        }
    }

    if (currentMode === STORAGE_MODE.LOCAL_ONLY) {
        logStorage('로컬 전용 모드');
    }

    return currentMode;
}

/**
 * localStorage에서 Firestore로 마이그레이션
 * @param {string} sampleType - 시료 타입
 * @param {number} year - 연도
 * @param {string} localStorageKey - localStorage 키
 * @returns {Promise<{success: boolean, count: number}>} 결과
 */
async function migrateToCloud(sampleType, year, localStorageKey) {
    if (currentMode !== STORAGE_MODE.CLOUD_SYNC) {
        return { success: false, count: 0, message: '클라우드 동기화 모드가 아닙니다.' };
    }

    return await window.firestoreDb.migrate(sampleType, year, localStorageKey);
}

/**
 * 동기화 상태 반환
 * @returns {Object} 동기화 상태
 */
function getSyncStatus() {
    return {
        ...syncStatus,
        mode: currentMode,
        isCloudEnabled: window.firestoreDb?.isEnabled() || false,
        isOfflineSupported: window.firestoreDb?.isOfflineEnabled() || false
    };
}

/**
 * 클라우드 동기화 활성화 여부
 * @returns {boolean}
 */
function isCloudSyncEnabled() {
    return currentMode === STORAGE_MODE.CLOUD_SYNC;
}

// 전역으로 내보내기
window.storageManager = {
    init: initStorageManager,
    migrate: migrateToCloud,
    getStatus: getSyncStatus,
    isCloudEnabled: isCloudSyncEnabled
};
