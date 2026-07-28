// ========================================
// 캐시 관리 모듈
// localStorage 캐시 주기적 클리어 및 수동 클리어 기능
// ========================================

/**
 * CacheManager - localStorage 캐시 관리
 * - 매주 금요일 자동 클리어
 * - 수동 클리어 기능
 * - 설정 및 중요 데이터 보존
 */
const CacheManager = (function() {
    // 보존해야 할 키 패턴 (시료 데이터는 클리어, 설정은 유지)
    const KEYS_TO_PRESERVE = [
        'firebase_config',        // Firebase 설정
        'autoSavePath',           // 자동 저장 경로
        'settings',               // 일반 설정
        'theme',                  // 테마 설정
        'lastCacheClear',         // 마지막 클리어 시간
        'cacheAutoCleared'        // 자동 클리어 기록
    ];

    // 시료 데이터 키 패턴 (이 패턴의 데이터가 클리어 대상)
    // 연도 포함 키(예: soilSampleLogs_2026)와 레거시 키(예: waterSampleLogs) 모두 매칭
    //
    // ⚠️ compostSampleLogs는 목록에서 제외됨 (SLS-1-192)
    //    퇴비는 이 저장소의 **정식 지원 시료 종**이 되었다. 여기에 남겨두면 금요일 자동 캐시
    //    클리어가 사용자의 신규 퇴비 데이터를 삭제한다. 절대 다시 추가하지 말 것.
    //    같은 이유로 compostTestResults(퇴비 검정결과, SLS-1-195)도 추가 금지. 현재는 위 패턴
    //    어느 것과도 startsWith 매칭되지 않아 우연히 보호되고 있을 뿐이므로 명시해 둔다.
    //
    // ⚠️ 나머지 3종(water/pesticide/heavyMetal)은 의도적 유지 (SLS-1-134): 5종 통합본
    //    (sample-log-electron)에서 넘어온 사용자의 localStorage 잔존 키를 캐시 정리 때 함께
    //    지워주는 정리 로직. 제거하면 그 레거시 키들이 영구 잔존하므로 삭제 금지.
    //    (퇴비 제외로 인해 통합본 출신 레거시 compostSampleLogs_* 키는 영구 보존되지만,
    //     퇴비가 정식 기능인 이상 그것은 부작용이 아니라 유실 방지다.)
    //
    // TODO(후속 티켓): clearCache()는 여전히 soilSampleLogs*를 지우며, 삭제 후 안내가
    //    "새로고침하면 Firebase에서 다시 불러옵니다"인 데서 보듯 Firebase가 진실의 원천이라는
    //    전제 위에 있다. 그러나 firebase-auth.json은 빈 placeholder가 기본이라 미설정 센터에는
    //    복구 경로가 없다. 시료 데이터 삭제를 window.firestoreDb?.isEnabled() 게이트 뒤로
    //    옮길 것. (이 결함은 SLS-1-192 이전부터 존재)
    const SAMPLE_DATA_PATTERNS = [
        'soilSampleLogs',
        'waterSampleLogs',
        'pesticideSampleLogs',
        'heavyMetalSampleLogs'
    ];

    /**
     * 현재 요일이 금요일인지 확인
     * @returns {boolean}
     */
    function isFriday() {
        return new Date().getDay() === 5; // 0: 일요일, 5: 금요일
    }

    /**
     * 이번 주 금요일에 이미 클리어했는지 확인
     * @returns {boolean}
     */
    function wasAlreadyClearedThisWeek() {
        const lastClear = localStorage.getItem('lastCacheClear');
        if (!lastClear) return false;

        const lastClearDate = new Date(parseInt(lastClear, 10));
        const now = new Date();

        // 같은 주인지 확인 (ISO 주 기준)
        const getWeekNumber = (date) => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + 4 - (d.getDay() || 7));
            const yearStart = new Date(d.getFullYear(), 0, 1);
            return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        };

        return lastClearDate.getFullYear() === now.getFullYear() &&
               getWeekNumber(lastClearDate) === getWeekNumber(now);
    }

    /**
     * 키가 시료 데이터인지 확인
     * @param {string} key - localStorage 키
     * @returns {boolean}
     */
    function isSampleData(key) {
        return SAMPLE_DATA_PATTERNS.some(pattern => key.startsWith(pattern));
    }

    /**
     * 캐시 클리어 (시료 데이터만 삭제)
     * @param {boolean} showAlert - 알림 표시 여부
     * @returns {Object} 삭제 결과
     */
    function clearCache(showAlert = true) {
        // 보존할 데이터 백업
        const preserved = {};
        KEYS_TO_PRESERVE.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) preserved[key] = value;
        });

        // 삭제할 키 수집 (시료 데이터만)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && isSampleData(key)) {
                keysToRemove.push(key);
            }
        }

        // 삭제 실행
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // 보존 데이터 복원
        Object.entries(preserved).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });

        // 클리어 시간 기록
        localStorage.setItem('lastCacheClear', Date.now().toString());

        const result = {
            success: true,
            clearedCount: keysToRemove.length,
            clearedKeys: keysToRemove
        };

        if (showAlert && keysToRemove.length > 0) {
            const message = `캐시가 삭제되었습니다.\n삭제된 항목: ${keysToRemove.length}건\n\n앱을 새로고침하면 클라우드에서 데이터를 다시 불러옵니다.`;
            alert(message);
        }

        (window.logger?.info || console.log)('캐시 클리어 완료:', result);

        return result;
    }

    /**
     * 매주 금요일 자동 클리어 체크 및 실행
     * 앱 시작 시 호출
     */
    function checkAndAutoClean() {
        if (!isFriday()) {
            (window.logger?.debug || console.log)('금요일이 아님 - 자동 클리어 스킵');
            return;
        }

        if (wasAlreadyClearedThisWeek()) {
            (window.logger?.debug || console.log)('이번 주 이미 클리어됨 - 스킵');
            return;
        }

        (window.logger?.info || console.log)('금요일 자동 캐시 클리어 실행');

        const result = clearCache(false); // 자동 클리어는 알림 없이

        // 자동 클리어 기록
        const record = {
            timestamp: Date.now(),
            date: new Date().toISOString(),
            clearedCount: result.clearedCount
        };
        localStorage.setItem('cacheAutoCleared', JSON.stringify(record));

        // 토스트 알림 (있는 경우)
        if (result.clearedCount > 0 && window.showToast) {
            window.showToast(`금요일 자동 캐시 정리: ${result.clearedCount}건 삭제`, 'info');
        }
    }

    /**
     * 마지막 클리어 정보 조회
     * @returns {Object|null}
     */
    function getLastClearInfo() {
        const lastClear = localStorage.getItem('lastCacheClear');
        const autoCleared = localStorage.getItem('cacheAutoCleared');

        return {
            lastClear: lastClear ? new Date(parseInt(lastClear, 10)) : null,
            lastAutoClear: autoCleared ? JSON.parse(autoCleared) : null
        };
    }

    /**
     * 현재 캐시 상태 조회
     * @returns {Object}
     */
    function getCacheStatus() {
        let sampleDataCount = 0;
        let sampleDataSize = 0;
        const details = {};

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && isSampleData(key)) {
                const value = localStorage.getItem(key);
                sampleDataCount++;
                sampleDataSize += value ? value.length : 0;

                // 타입별 집계
                const type = key.split('_')[0];
                if (!details[type]) {
                    details[type] = { count: 0, size: 0 };
                }
                details[type].count++;
                details[type].size += value ? value.length : 0;
            }
        }

        return {
            totalKeys: sampleDataCount,
            totalSize: sampleDataSize,
            totalSizeMB: (sampleDataSize / 1024 / 1024).toFixed(2),
            details,
            lastClear: getLastClearInfo()
        };
    }

    // Public API
    return {
        clearCache,
        checkAndAutoClean,
        getLastClearInfo,
        getCacheStatus,
        isFriday,
        wasAlreadyClearedThisWeek
    };
})();

// 전역 노출
window.CacheManager = CacheManager;
