// ========================================
// Base Sample Manager 클래스
// 모든 시료 타입의 공통 기능을 관리하는 기본 클래스
// ========================================

/**
 * 시료 관리의 기본 클래스
 * 지원 시료 2종(soil, compost)이 공통으로 사용한다.
 * SLS-1-192에서 5종 통합본의 공통 골격 20개를 백포트했다 — 편집/리셋 Template Method,
 * 필터 매처, 폼 데이터 수집, 라벨 인쇄. 시료 종 추가 시 이 계층을 먼저 확인할 것.
 */
class BaseSampleManager {
    /**
     * @param {Object} config - 시료 타입별 설정
     * @param {string} config.moduleKey - 모듈 키 (예: 'soil', 'water')
     * @param {string} config.moduleName - 모듈 표시명 (예: '토양', '수질분석')
     * @param {string} config.storageKey - localStorage 키 (예: 'soilSampleLogs')
     * @param {boolean} config.debug - 디버그 모드 여부
     */
    constructor(config) {
        // 설정
        this.moduleKey = config.moduleKey;
        this.moduleName = config.moduleName;
        this.storageKey = config.storageKey;
        this.sampleType = config.sampleType || config.moduleName;
        this.autoSaveFile = config.autoSaveFile || `${config.moduleKey}-autosave.json`;
        this.debug = config.debug || false;

        // 상태
        this.sampleLogs = [];
        this.selectedYear = new Date().getFullYear().toString();
        this.editingId = null;
        // 그룹 묶음 수정용 멤버 ID 목록 (단건 편집 시 빈 배열)
        // SLS-1-192: 백포트된 editSample/resetForm 본문이 참조하므로 복원
        this.editingGroupIds = [];
        // 검색 필터 상태 (서브클래스가 자체 기본값으로 덮어쓸 수 있음)
        // SLS-1-192: 백포트된 필터 매처(matchesNameFilter 등)가 전제
        this.currentSearchFilter = {
            dateFrom: '', dateTo: '', name: '',
            receptionFrom: '', receptionTo: '', completed: ''
        };
        this.currentPage = 1;
        this.itemsPerPage = 100;
        this.totalPages = 1;
        this.listViewStale = true;  // PER-5: 목록 뷰 리렌더 필요 여부
        this._firebaseCache = new Map();  // PER-9: 연도별 Firebase 데이터 캐시 { data, timestamp }
        this._firebaseCacheTTL = 30000;   // PER-9: 캐시 유효 시간 (30초)
        this._firebaseCacheMax = 5;       // 메모리 누수 방지: 캐시 보관 연도 상한
        this._cloudSyncFailed = false;       // L2: 클라우드 동기화 실패 상태 (중복 토스트 방지)
        this._localSaveFailed = false;       // SLS-1-198: 직전 saveLogs의 localStorage 기록 실패 여부
        this._cloudSyncFailedSevere = false; // SLS-1-198: 동시 실패(전면 유실) 경고를 이미 냈는지
        this._retryCloudSyncHandler = null;  // L2: online 복귀 재시도 리스너 참조
        this.cloudSyncPromise = null;  // Promise-based lock
        this._hashChangeHandler = null;   // destroy()에서 해제하기 위한 핸들러 참조

        // PaginationManager 인스턴스
        this.pagination = null;

        // DOM 참조 (서브클래스에서 설정)
        this.form = null;
        this.tableBody = null;
        this.emptyState = null;
        this.recordCountEl = null;

        // 자동 저장 관련
        this.autoSaveTimer = null;
        this.lastSavedDataHash = null;

        // FileAPI 인스턴스
        if (window.createFileAPI) {
            this.FileAPI = window.createFileAPI(this.moduleKey);
        }
    }

    // ========================================
    // 초기화
    // ========================================

    /**
     * 매니저 초기화
     */
    async init() {
        try {
            this.log('초기화 시작');

            // FileAPI 초기화
            if (this.FileAPI) {
                await this.FileAPI.init(this.getCurrentYear());
            }

            // Firebase + AutoSave 병렬 초기화
            await Promise.all([
                this.initFirebase(),
                this.initAutoSave()
            ]);

            // UI 초기화 (DOM 요소 캐싱)
            this.initUI();

            // 데이터가 있는 연도 찾기
            this.selectedYear = this.findYearWithData();
            this.syncYearSelects(this.selectedYear);
            this.log('선택된 연도:', this.selectedYear);

            // 선택된 연도의 데이터 로드
            await this.loadYearData(this.selectedYear);

            // 이벤트 리스너 설정
            this.setupEventListeners();

            // 타입별 추가 이벤트 (서브클래스 hook)
            this.setupTypeSpecificEvents();

            // hash 기반 뷰 전환
            this.handleHashChange();
            this._hashChangeHandler = () => this.handleHashChange();
            window.addEventListener('hashchange', this._hashChangeHandler);

            this.log('초기화 완료');
        } catch (error) {
            (window.logger?.error || console.error)('매니저 초기화 실패:', error);
        }
    }

    /**
     * Firebase 초기화
     */
    async initFirebase() {
        if (window.firebaseConfig?.initialize && !window.firebaseInitialized) {
            try {
                window.firebaseInitialized = await window.firebaseConfig.initialize();
                this.log('Firebase 초기화 결과:', window.firebaseInitialized);
            } catch (err) {
                (window.logger?.error || console.error)('Firebase 초기화 에러:', err);
            }
        }

        if (window.firebaseInitialized && window.firestoreDb?.init && !window.firestoreInitialized) {
            try {
                window.firestoreInitialized = await window.firestoreDb.init();
                this.log('Firestore 초기화 결과:', window.firestoreInitialized);
            } catch (err) {
                (window.logger?.error || console.error)('Firestore 초기화 에러:', err);
            }
        }
    }

    // ========================================
    // 연도 관리
    // ========================================

    /**
     * 현재 연도 반환
     */
    getCurrentYear() {
        return new Date().getFullYear();
    }

    /**
     * 연도별 스토리지 키 생성
     * @param {string} year - 연도
     */
    getStorageKey(year) {
        return `${this.storageKey}_${year}`;
    }

    /**
     * 데이터가 있는 연도 자동 감지
     */
    findYearWithData() {
        const currentYear = this.getCurrentYear();
        // 현재 연도부터 2020년까지 검색
        for (let year = currentYear; year >= 2020; year--) {
            const key = this.getStorageKey(year);
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return year.toString();
                    }
                } catch (e) {
                    this.log('JSON 파싱 오류 (무시됨):', key, e.message);
                }
            }
        }
        return currentYear.toString();
    }

    /**
     * 연도 선택 드롭다운 동기화
     * @param {string} newYear - 새로운 연도
     */
    syncYearSelects(newYear) {
        const yearSelect = document.getElementById('yearSelect');
        const listYearSelect = document.getElementById('listYearSelect');

        if (yearSelect) yearSelect.value = newYear;
        if (listYearSelect) listYearSelect.value = newYear;

        this.selectedYear = newYear;
        this.onYearChange(newYear);
    }

    // ========================================
    // 데이터 관리
    // ========================================

    /**
     * localStorage에서 JSON 배열을 안전하게 읽기 (M5: 3벌 중복 제거)
     * @param {string} key - localStorage 키
     * @returns {Array}
     */
    safeParseArray(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    /**
     * 데이터 저장
     */
    async saveLogs() {
        this.listViewStale = true;  // PER-5: 데이터 변경 시 목록 리렌더 필요
        this._firebaseCache.delete(this.selectedYear);  // PER-9: 캐시 무효화
        // 저장 전 hook (서브클래스에서 데이터 가공)
        const processed = this.onBeforeSave(this.sampleLogs);
        if (processed) this.sampleLogs = processed;

        const yearStorageKey = this.getStorageKey(this.selectedYear);

        // ID 생성 (없는 경우)
        this.sampleLogs = this.sampleLogs.map(item => ({
            ...item,
            id: item.id || this.generateId()
        }));

        // 로컬 저장 먼저 (UI 블로킹 방지)
        // SLS-1-198: quota 초과 시 return하지 않는다. 여기서 끊으면 아래의
        // Firebase 동기화·자동저장 파일·카운트·onAfterSave 훅이 전부 함께 죽어,
        // 가장 작은 저장소(5~10MB)의 포화가 사실상 무제한인 나머지 경로까지 도미노로 막았다.
        // 메모리상 sampleLogs는 최신이므로 클라우드/파일에 올려도 정합성 문제가 없고,
        // 다음 로드 시 loadYearData의 클라우드 병합이 로컬을 복원한다.
        this._localSaveFailed = false;
        try {
            localStorage.setItem(yearStorageKey, JSON.stringify(this.sampleLogs));
            this.log('💾 로컬 저장 완료:', this.sampleLogs.length, '건');
            this._warnIfStorageNearFull();
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                (window.logger?.warn || console.warn)('localStorage 용량 초과:', e);
                this._localSaveFailed = true;
                this._notifyQuotaExceeded();
            } else {
                throw e;
            }
        }

        // M-2(레이스) 방어: batchSave의 .then/.catch는 saveLogs 반환 후 정착하므로,
        // 그 사이 다음 saveLogs가 인스턴스 플래그를 리셋할 수 있다. 이 호출의 상황을
        // 지역 변수로 캡처해 인자로 전달한다.
        const localSaveFailed = this._localSaveFailed;

        // Firebase 백그라운드 동기화 (UI 비블로킹 — 실패 시 토스트 + online 재시도)
        // 주의: batchSave는 실패 시 throw가 아닌 false 반환 → 반환값 검사 필수
        // 빈 배열은 batchSave가 false를 반환하므로 호출 생략
        if (window.firestoreDb?.isEnabled() && this.sampleLogs.length > 0) {
            window.firestoreDb.batchSave(this.moduleKey, parseInt(this.selectedYear, 10), this.sampleLogs)
                .then(ok => {
                    if (ok) {
                        this._clearCloudSyncFailure();
                        this.log('Firebase 동기화 완료:', this.sampleLogs.length, '건');
                    } else {
                        this._handleCloudSyncFailure(localSaveFailed);
                    }
                })
                .catch(err => {
                    (window.logger?.error || console.error)('Firebase 동기화 실패:', err);
                    this._handleCloudSyncFailure(localSaveFailed);
                });
        }

        // 자동 저장 트리거
        this.triggerAutoSave();

        // 레코드 수 업데이트
        this.updateRecordCount();

        // 저장 후 hook
        this.onAfterSave(this.sampleLogs);
    }

    /**
     * 샘플 삭제 - Firebase 우선
     * @param {string} id - 삭제할 샘플 ID
     */
    async deleteSample(id) {
        this.listViewStale = true;  // PER-5
        this._firebaseCache.delete(this.selectedYear);  // PER-9: 캐시 무효화

        // 로컬 삭제 먼저 (UI 블로킹 방지)
        this.sampleLogs = this.sampleLogs.filter(l => String(l.id) !== String(id));
        await this.saveLogs();
        // SLS-1-198: saveLogs가 동기 구간에서 플래그를 세우므로 직후 캡처가 안전.
        // 비동기 삭제 콜백에는 인스턴스 플래그 대신 이 캡처 값을 전달한다(레이스 방어 — saveLogs와 동일).
        const localSaveFailed = this._localSaveFailed;
        this.filterAndRenderLogs();
        // quota로 로컬 기록이 실패했으면 success 토스트가 quota 경고와 나란히 떠 모순된다
        if (!localSaveFailed) {
            this.showToast('삭제되었습니다.', 'success');
        }

        // Firebase 삭제 (백그라운드 — 실패 시 다음 병합에서 항목이 부활할 수 있으므로 사용자에게 알림)
        if (window.firestoreDb?.isEnabled()) {
            window.firestoreDb.delete(this.moduleKey, parseInt(this.selectedYear, 10), String(id))
                .then(ok => {
                    if (ok) this.log('Firebase 삭제 완료:', id);
                    else this._handleCloudSyncFailure(localSaveFailed);
                })
                .catch(err => {
                    (window.logger?.error || console.error)('Firebase 삭제 실패:', err);
                    this._handleCloudSyncFailure(localSaveFailed);
                });
        }
    }

    /**
     * SLS-1-198: 이 인스턴스에서 실제로 동작 가능한 백업 경로 판정.
     * window.isElectron만으로는 부족하다 — 자동저장이 비활성이거나 폴더/파일 핸들이
     * 없으면 Electron이어도 파일에 아무것도 쓰이지 않아 "파일에 보관됩니다"가 거짓이 된다.
     * 웹도 File System Access(autoSaveFileHandle)로 파일 자동저장이 가능하다.
     * 서브클래스가 autoSaveFileHandle을 선언하지 않아도 !!undefined === false로
     * 보수적(백업 없음) 판정이라 거짓 안심이 나가지 않는다.
     */
    _getBackupAvailability() {
        // 코드리뷰 MAJOR-2: 웹 분기는 "핸들 보유"가 아니라 "저장 시 실제로 파일에 쓰는가"로
        // 판정한다. base의 triggerAutoSave는 Electron 전용이라, base를 그대로 쓰는 서브클래스
        // (퇴비)는 웹에서 파일 자동저장 경로가 없다 — 핸들만 보고 "파일에 기록됩니다"라고 하면
        // 거짓 안심이다. 웹 저장-시-기록을 자체 구현한 서브클래스(soil)만 생성자에서
        // _webAutoSaveOnSave = true를 선언한다. 미선언은 undefined → false (보수적 판정).
        const fileBackupAvailable =
            localStorage.getItem(`${this.moduleKey}AutoSaveEnabled`) === 'true' &&
            (window.isElectron
                ? !!this.FileAPI?.autoSavePath
                : (this._webAutoSaveOnSave === true && !!this.autoSaveFileHandle));
        const cloudBackupAvailable = window.firestoreDb?.isEnabled() === true;
        return { fileBackupAvailable, cloudBackupAvailable };
    }

    /**
     * SLS-1-198: quota 초과 시 실제 상황에 맞는 안내.
     * @param {Object} [opts]
     * @param {boolean} [opts.cloudWritesInThisPath=true] - 이 saveLogs 경로가 클라우드에
     *        직접 올리는지. soil 오버라이드는 업로드를 호출부(firebaseSaveRecords)가 하므로
     *        false를 넘겨 "클라우드에 동기화됩니다" 문구를 억제한다(과대 판정 방지).
     */
    _notifyQuotaExceeded({ cloudWritesInThisPath = true } = {}) {
        const { fileBackupAvailable, cloudBackupAvailable } = this._getBackupAvailability();
        // 코드리뷰 MAJOR-1: 이미 클라우드 장애를 알고 있으면(_cloudSyncFailed) 클라우드를
        // 백업으로 세지 않는다 — 네트워크 다운 + quota 동시 상황에서 "클라우드에 기록됩니다"는
        // 거짓 안심이며, 실제로는 어디에도 저장되지 않는다.
        const cloud = cloudBackupAvailable && cloudWritesInThisPath && !this._cloudSyncFailed;
        if (cloud || fileBackupAvailable) {
            // 파일 자동저장은 3초 지연 기록이므로 미래형으로 쓴다
            const dest = cloud && fileBackupAvailable ? '클라우드와 자동저장 파일에'
                : cloud ? '클라우드에' : '자동저장 파일에';
            this.showToast(
                `브라우저 저장 공간이 가득 찼습니다. 데이터는 ${dest} 기록됩니다. 설정에서 오래된 연도의 데이터를 정리해 주세요.`,
                'warning'
            );
        } else {
            this.showToast(
                '저장 공간이 부족하여 데이터가 저장되지 않습니다. 즉시 JSON 저장으로 백업한 뒤 오래된 연도의 데이터를 정리해 주세요.',
                'error'
            );
        }
    }

    /**
     * SLS-1-198: 임계 도달 전 사전 경고 (세션당 1회).
     * 기존 헬퍼(SampleUtils.getLocalStorageUsage — safeSetJSON도 사용 중)를 재사용한다.
     * 옵셔널 체이닝: 유닛 테스트 환경(utils.js 미로드)에서는 자연히 스킵되어
     * setup.js의 localStorage 목(for-in 열거 불가)과 충돌하지 않는다.
     */
    _warnIfStorageNearFull() {
        try {
            // 스로틀을 사용량 계산 앞에 둔다 — 경고가 발동한 뒤에는 전체 localStorage 순회를
            // 생략한다. 80% 미만 구간에서는 매 저장마다 순회가 그대로 일어나므로,
            // 이 재배치가 없애는 것은 "80%+에서 계속 저장하는" 최악 구간의 비용이다.
            // (대상 사용자가 정확히 "저장소가 큰 사람"이라 체감 비용이 가장 큰 곳)
            if (sessionStorage.getItem('storageQuotaWarned')) return;
            const usage = window.SampleUtils?.getLocalStorageUsage?.();
            // 코드리뷰 MINOR-2: NaN < 80은 false라 계산이 깨지면 경고가 새어 나온다("NaN%").
            // fail-open 대신 유한값일 때만 판정한다.
            if (!Number.isFinite(usage?.percent) || usage.percent < 80) return;
            sessionStorage.setItem('storageQuotaWarned', '1');
            this.showToast(
                `저장 공간의 ${usage.percent}%를 사용 중입니다. 설정에서 오래된 연도의 데이터를 정리해 주세요.`,
                'warning'
            );
        } catch (_) { /* 사전 경고는 실패해도 저장 흐름에 영향 없음 */ }
    }

    /**
     * L2: 클라우드 동기화 실패 처리 — 사용자 알림 + 온라인 복귀 시 1회 자동 재시도
     * batchSave/delete는 실패 시 false를 반환하므로 호출부에서 이 메서드를 호출한다.
     * @param {boolean} [localSaveFailed=false] - 같은 저장 시도에서 localStorage 기록도
     *        실패했는지. SLS-1-198: 인스턴스 플래그가 아니라 **호출 시점에 캡처된 값**을
     *        받는다 — 비동기 콜백에서 인스턴스 상태를 읽으면 다음 saveLogs가 플래그를
     *        리셋한 뒤 옛 실패 콜백이 도착하는 인터리브에서 오판한다.
     */
    _handleCloudSyncFailure(localSaveFailed = false) {
        // 코드리뷰 MAJOR-1: 중복 방지 가드가 "완만한 실패"(클라우드만) 경고 이후에 도착한
        // "동시 실패"(전면 유실) 경고까지 삼키면 안 된다 — 심각도 승격은 1회 허용한다.
        if (this._cloudSyncFailed && !(localSaveFailed && !this._cloudSyncFailedSevere)) return;
        if (localSaveFailed) this._cloudSyncFailedSevere = true;
        this._cloudSyncFailed = true;
        if (localSaveFailed) {
            // 로컬·클라우드 동시 실패 — "이 컴퓨터에 저장되어 있습니다"는 거짓이 된다
            this.showToast(
                '저장에 실패했습니다 — 데이터가 아직 어디에도 저장되지 않았습니다. 즉시 JSON 저장으로 내보내 주세요.',
                'error'
            );
        } else {
            this.showToast(
                '클라우드 동기화 실패 — 데이터는 이 컴퓨터에 저장되어 있습니다. 온라인 연결 시 자동 재시도합니다.',
                'error'
            );
        }
        if (!this._retryCloudSyncHandler) {
            this._retryCloudSyncHandler = () => {
                this._retryCloudSyncHandler = null;
                this._cloudSyncFailed = false;
                // 코드리뷰 MINOR-9: severe도 함께 리셋해야 새 장애 사이클에서 승격이 재허용된다.
                // (여기서 빠뜨리면 stale severe가 다음 전면 유실 경고를 삼킨다)
                this._cloudSyncFailedSevere = false;
                this.log('🔁 온라인 복귀 — 클라우드 동기화 재시도');
                this._retryCloudSyncAction();
            };
            window.addEventListener('online', this._retryCloudSyncHandler, { once: true });
        }
    }

    /**
     * L2: online 복귀 시 실행할 재시도 동작 — 서브클래스 오버라이드 지점
     * (기본: saveLogs가 전체 batchSave를 수행)
     */
    _retryCloudSyncAction() {
        this.saveLogs();
    }

    /**
     * L2: 동기화 성공 시 실패 상태 해제 — 플래그 리셋 + 대기 중 재시도 리스너 정리
     */
    _clearCloudSyncFailure() {
        this._cloudSyncFailed = false;
        this._cloudSyncFailedSevere = false;   // SLS-1-198: 다음 장애 사이클에서 승격 재허용
        if (this._retryCloudSyncHandler) {
            window.removeEventListener('online', this._retryCloudSyncHandler);
            this._retryCloudSyncHandler = null;
        }
    }

    /**
     * 년도별 데이터 로드
     * @param {string} year - 연도
     */
    async loadYearData(year) {
        this.listViewStale = true;  // PER-5
        this.log(`📅 ${year}년 데이터 로드 시작`);

        try {
            const yearStorageKey = this.getStorageKey(year);
            this.log(` loadYearData - storageKey:`, yearStorageKey);

            // Firebase가 활성화되어 있으면 Firebase에서 먼저 데이터 로드
            if (window.firebaseConfig?.isEnabled()) {
                try {
                    // PER-9: TTL 기반 Firebase 캐시 확인
                    const cacheEntry = this._firebaseCache.get(year);
                    const cacheValid = cacheEntry && (Date.now() - cacheEntry.timestamp < this._firebaseCacheTTL);
                    this.log(cacheValid ? ` Firebase 캐시 사용 (${year}년)` : ` Firebase에서 데이터 로드 시작`);
                    // SLS-1-121 (SAMPL-1-80 백포트): firebaseLogs와 함께 fromCache(읽기 신뢰도)도 확보
                    let firebaseLogs, fromCache;
                    if (cacheValid) {
                        firebaseLogs = cacheEntry.data;
                        fromCache = cacheEntry.fromCache === true;  // 캐시된 응답의 원래 신뢰도 보존
                    } else {
                        const res = await this.loadFromFirebase(year);
                        firebaseLogs = res.data;
                        fromCache = res.fromCache === true;
                    }

                    if (firebaseLogs && firebaseLogs.length > 0) {
                        this.log(` Firebase 데이터:`, firebaseLogs.length, '건', `(fromCache=${fromCache})`);

                        // PER-9: TTL 포함 캐시 저장 (Firebase 원본 기준 — 다음 로드에서 재병합)
                        if (!cacheValid) {
                            // 메모리 누수 방지: 상한 초과 시 가장 오래된 항목 제거(LRU 근사)
                            if (this._firebaseCache.size >= this._firebaseCacheMax && !this._firebaseCache.has(year)) {
                                this._firebaseCache.delete(this._firebaseCache.keys().next().value);
                            }
                            this._firebaseCache.set(year, { data: JSON.parse(JSON.stringify(firebaseLogs)), fromCache, timestamp: Date.now() });
                        }

                        // 통째 교체 대신 로컬과 스마트 병합(동기화 경로 단일화):
                        //  - 오프라인에서 로컬에만 추가된(syncedAt 없는) 레코드 → 보존(유실 방지)
                        //  - 클라우드에서 삭제된(과거 동기화되어 syncedAt 있는) 레코드 → 로컬에서도 제거
                        //  - 양쪽 존재 시 updatedAt 최신 우선
                        // SLS-1-121: fromCache(불완전 가능) 읽기에서는 cross-device 삭제를 보류하고,
                        //            클라우드에 없는 localOnly 레코드는 재업로드 대상으로 분리
                        const localLogs = this.safeParseArray(yearStorageKey);
                        const merged = window.SyncUtils?.mergeCloudData
                            ? window.SyncUtils.mergeCloudData(localLogs, firebaseLogs, { fromCache })
                            : { data: this.smartMerge(localLogs, firebaseLogs, { allowDeletions: !fromCache }), localOnly: [] };
                        const mergedLogs = merged.data;
                        this.sampleLogs = mergedLogs;

                        // 병합 결과를 localStorage에 저장 (Quota 보호)
                        try {
                            localStorage.setItem(yearStorageKey, JSON.stringify(mergedLogs));
                        } catch (e) {
                            if (e.name === 'QuotaExceededError' || e.code === 22) {
                                (window.logger?.warn || console.warn)('데이터 캐싱 중 localStorage 용량 초과:', e);
                            } else {
                                throw e;
                            }
                        }
                        this.log(` Firebase+로컬 병합 결과 저장 (${mergedLogs.length}건, 로컬 ${localLogs.length}건, 로컬전용 ${merged.localOnly.length}건)`);

                        // 보존된 로컬 전용 항목을 클라우드로 재업로드 (전체가 아닌 localOnly만 —
                        // 전체 재업로드 시 모든 문서의 updatedAt이 갱신되어 타 기기 병합을 교란함)
                        if (merged.localOnly.length > 0 && window.firestoreDb?.isEnabled()) {
                            window.firestoreDb.batchSave(this.moduleKey, parseInt(year, 10), merged.localOnly)
                                .then(ok => {
                                    if (ok) {
                                        this.log(`☁️ 로컬 전용 ${merged.localOnly.length}건 클라우드 업로드 완료`);
                                        // stale 캐시로 인한 반복 재업로드 방지
                                        this._firebaseCache.delete(year);
                                    }
                                })
                                .catch((err) => (window.logger?.warn || console.warn)('로컬 전용 항목 재업로드 실패:', err));
                        }
                    } else {
                        this.log(` Firebase에 데이터 없음, localStorage 확인`);
                        // Firebase에 데이터가 없으면 localStorage 확인
                        this.sampleLogs = this.safeParseArray(yearStorageKey);
                    }
                } catch (error) {
                    (window.logger?.error || console.error)('Firebase 로드 실패:', error);
                    // Firebase 로드 실패 시 localStorage 폴백
                    this.sampleLogs = this.safeParseArray(yearStorageKey);
                }
            } else {
                this.log(` Firebase 비활성화, localStorage에서 로드`);
                // Firebase가 비활성화되어 있으면 localStorage에서 로드
                this.sampleLogs = this.safeParseArray(yearStorageKey);
            }

            this.log(` 최종 sampleLogs 설정:`, this.sampleLogs.length, '건');
            // 공통 마이그레이션 적용
            this.sampleLogs = this.migrateCompletedField(this.sampleLogs);

            // 추가 마이그레이션 (서브클래스 hook)
            const migrations = this.getAdditionalMigrations();
            for (const migrate of migrations) {
                const result = migrate(this.sampleLogs);
                if (result) this.sampleLogs = result;
            }

            // 후처리 hook (예: water의 smartMerge)
            const processed = this.onAfterLoad(this.sampleLogs, year);
            if (processed) this.sampleLogs = processed;

            // UI 업데이트 (기본 필터 적용)
            this.filterAndRenderLogs();
            this.updateRecordCount();

            // 다음 접수번호 설정 (서브클래스에서 구현된 경우)
            if (typeof this.generateNextReceptionNumber === 'function') {
                const nextNumber = this.generateNextReceptionNumber();
                const receptionNumberInput = document.getElementById('receptionNumber');
                if (receptionNumberInput && nextNumber) {
                    receptionNumberInput.value = nextNumber;
                }
            }

            // FileAPI 경로 업데이트
            if (this.FileAPI) {
                await this.FileAPI.updateAutoSavePath(year);
            }

            // 자동 저장 트리거
            this.triggerAutoSave();

            this.log(`✅ ${year}년 데이터 로드 완료:`, this.sampleLogs.length, '건');
        } catch (error) {
            (window.logger?.error || console.error)('데이터 로드 실패:', error);
            this.showToast('데이터 로드 실패', 'error');
        }
    }

    /**
     * Firebase에서 데이터 로드
     * @param {string} year - 연도
     */
    async loadFromFirebase(year) {
        try {
            this.log(` Firebase getAll 호출 - moduleKey: ${this.moduleKey}, year: ${year}`);
            this.log(` Firebase 상태:`, {
                isEnabled: window.firestoreDb?.isEnabled ? window.firestoreDb.isEnabled() : 'isEnabled 메서드 없음',
                getAll: typeof window.firestoreDb?.getAll,
                firestoreDb: !!window.firestoreDb
            });

            // SLS-1-121 (SAMPL-1-80 백포트): fromCache 메타 포함 조회 (있으면) —
            // 불완전 캐시 읽기 시 cross-device 삭제 보류 판단용
            let data, fromCache = false;
            if (typeof window.firestoreDb?.getAllWithMeta === 'function') {
                const res = await window.firestoreDb.getAllWithMeta(this.moduleKey, parseInt(year, 10));
                data = res.documents;
                fromCache = res.fromCache === true;
            } else {
                data = await window.firestoreDb.getAll(this.moduleKey, parseInt(year, 10));
            }
            this.log(` Firebase 응답:`, data ? `${data.length}건 (fromCache=${fromCache})` : 'null/undefined');
            this.log(` Firebase 데이터 샘플:`, data && data.length > 0 ? data[0] : 'No data');
            return { data: data || [], fromCache };
        } catch (error) {
            console.error(`[${this.moduleName}] Firebase 로드 오류 상세:`, error);
            (window.logger?.error || console.error)('Firebase 로드 실패:', error);
            return { data: [], fromCache: false };
        }
    }

    /**
     * 스마트 병합 - utils.js의 함수 사용
     */
    smartMerge(localData, firebaseData, options = {}) {
        if (window.SyncUtils?.smartMerge) {
            // SyncUtils.smartMerge는 { data, hasChanges, ... } 객체를 반환하므로
            // 배열 계약을 유지하기 위해 data를 언래핑한다 (객체를 그대로 쓰면 데이터 손상)
            // SLS-1-121: options(allowDeletions 등)를 그대로 전달해 캐시 읽기 시 삭제 보류 가능
            const result = window.SyncUtils.smartMerge(localData, firebaseData, options);
            return Array.isArray(result) ? result : (result?.data || []);
        }
        // 폴백: id 기준 union merge (로컬 우선 — Firebase만 반환하면 로컬 변경 유실)
        // ⚠️ 삭제 의미론 미지원: 이 폴백은 로컬+Firebase의 합집합만 만든다.
        //    SyncUtils.smartMerge와 달리 "클라우드에서 삭제된(syncedAt 있는) 레코드를
        //    로컬에서도 제거"하지 못한다. 또한 양쪽 존재 시 updatedAt 비교 없이 무조건
        //    로컬을 우선하므로 클라우드 최신본이 무시될 수 있다. SyncUtils 로드 실패라는
        //    예외 경로에서만 동작하는 안전망이며, 결과는 [...firebase, ...local] 순서에 의존한다.
        const map = new Map();
        const noId = [];
        [...(firebaseData || []), ...(localData || [])].forEach(item => {
            if (item?.id) map.set(String(item.id), item);
            else if (item) noId.push(item);
        });
        return [...Array.from(map.values()), ...noId];
    }

    // ========================================
    // 자동 저장
    // ========================================

    /**
     * 자동 저장 초기화
     */
    async initAutoSave() {
        if (!this.FileAPI || !window.isElectron) {
            return;
        }

        // SampleUtils가 있으면 사용
        if (window.SampleUtils?.initAutoSave) {
            await window.SampleUtils.initAutoSave({
                moduleKey: this.moduleKey,
                moduleName: this.moduleName,
                FileAPI: this.FileAPI,
                currentYear: this.selectedYear,
                log: (...args) => this.log(...args),
                showToast: window.showToast
            });

            // 자동 저장 파일에서 데이터 로드하는 함수
            window.loadFromAutoSaveFile = async () => {
                return await window.SampleUtils.loadFromAutoSaveFile(this.FileAPI, (...args) => this.log(...args));
            };
        } else {
            // 폴백: 기본 자동 저장 처리
            try {
                const savedData = await this.FileAPI.loadAutoSave();
                if (savedData) {
                    this.lastSavedDataHash = this.hashData(savedData);
                }
            } catch (error) {
                this.log('자동 저장 데이터 로드 실패:', error);
            }
        }
    }

    /**
     * 자동 저장 트리거
     */
    triggerAutoSave() {
        if (!this.FileAPI || !window.isElectron) {
            return;
        }

        // 기존 타이머 클리어
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // 3초 후 저장
        this.autoSaveTimer = setTimeout(() => {
            this.performAutoSave();
        }, 3000);
    }

    /**
     * 자동 저장 수행
     */
    async performAutoSave() {
        try {
            // 자동 저장 활성화 여부 확인
            const enabledKey = `${this.moduleKey}AutoSaveEnabled`;
            if (localStorage.getItem(enabledKey) !== 'true') return;

            const currentDataHash = this.hashData(this.sampleLogs);

            // 데이터가 변경된 경우만 저장
            if (currentDataHash !== this.lastSavedDataHash) {
                const content = JSON.stringify({
                    version: '2.0',
                    exportDate: new Date().toISOString(),
                    totalRecords: this.sampleLogs.length,
                    data: this.sampleLogs
                }, null, 2);
                const result = await this.FileAPI.autoSave(content);

                if (result) {
                    this.lastSavedDataHash = currentDataHash;
                    this.log('✅ 자동 저장 완료');
                }
            }
        } catch (error) {
            this.log('자동 저장 실패:', error);
        }
    }

    /**
     * 데이터 해시 생성
     */
    hashData(data) {
        const str = JSON.stringify(data);
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    // ========================================
    // UI 관리
    // ========================================

    /**
     * UI 초기화
     */
    initUI() {
        // DOM 요소 캐싱
        this.cacheElements();

        // 뷰 초기화
        this.initViews();

        // 페이지네이션 초기화
        this.initPagination();

        // 이벤트 위임 설정
        this.setupTableEventDelegation();
    }

    /**
     * 테이블 이벤트 위임 설정 (메모리 효율적인 이벤트 처리)
     */
    setupTableEventDelegation() {
        if (!this.tableBody || !window.EventDelegator) return;

        this.tableDelegator = new window.EventDelegator(this.tableBody);

        // 수정 버튼
        this.tableDelegator.on('click', '.btn-edit', (e, target) => {
            const id = target.dataset.id;
            if (id) this.editSample(id);
        });

        // 삭제 버튼
        this.tableDelegator.on('click', '.btn-delete', (e, target) => {
            const id = target.dataset.id;
            if (id && confirm('이 항목을 삭제하시겠습니까?')) {
                this.deleteSample(id);
            }
        });

        // 완료 토글 버튼
        this.tableDelegator.on('click', '.btn-complete', (e, target) => {
            const id = target.dataset.id;
            if (id && typeof this.toggleComplete === 'function') {
                this.toggleComplete(id);
            }
        });

        // 판정 토글 버튼
        this.tableDelegator.on('click', '.btn-result', (e, target) => {
            const id = target.dataset.id;
            if (id && typeof this.toggleResult === 'function') {
                this.toggleResult(id);
            }
        });

        // 접수번호 클릭 (편집)
        this.tableDelegator.on('click', '.btn-link.edit-btn', (e, target) => {
            e.preventDefault();
            const row = target.closest('tr');
            const editBtn = row?.querySelector('.btn-edit');
            const id = editBtn?.dataset.id;
            if (id) this.editSample(id);
        });
    }

    /**
     * 리소스 정리 (메모리 누수 방지)
     */
    destroy() {
        // 이벤트 위임 정리
        if (this.tableDelegator) {
            this.tableDelegator.destroy();
            this.tableDelegator = null;
        }

        // 자동 저장 타이머 정리
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }

        // hashchange 리스너 해제 (익명 핸들러 누수 방지)
        if (this._hashChangeHandler) {
            window.removeEventListener('hashchange', this._hashChangeHandler);
            this._hashChangeHandler = null;
        }

        // L2: online 재시도 리스너 정리
        if (this._retryCloudSyncHandler) {
            window.removeEventListener('online', this._retryCloudSyncHandler);
            this._retryCloudSyncHandler = null;
        }
        this.cloudSyncPromise = null;

        // Firebase 캐시/페이지네이션 정리
        this._firebaseCache.clear();
        this.pagination = null;

        // 참조 정리
        this.form = null;
        this.tableBody = null;
        this.emptyState = null;
        this.recordCountEl = null;
    }

    /**
     * DOM 요소 캐싱
     */
    cacheElements() {
        this.form = document.getElementById('sampleForm');
        this.tableBody = document.getElementById('sampleTableBody');
        this.emptyState = document.querySelector('.empty-state');
        this.recordCountEl = document.getElementById('recordCount');
    }

    /**
     * 뷰 전환
     * @param {string} viewName - 뷰 이름
     */
    switchView(viewName) {
        const views = document.querySelectorAll('.view');
        const navItems = document.querySelectorAll('.nav-btn');

        views.forEach(view => view.classList.remove('active'));
        navItems.forEach(nav => nav.classList.remove('active'));

        const targetView = document.getElementById(`${viewName}View`);
        const targetNav = document.querySelector(`.nav-btn[data-view="${viewName}"]`);

        if (targetView) targetView.classList.add('active');
        if (targetNav) targetNav.classList.add('active');

        // 목록 뷰로 전환 시 변경된 경우에만 테이블 새로고침 (PER-5)
        if (viewName === 'list' && this.listViewStale) {
            this.filterAndRenderLogs();
            this.listViewStale = false;
        }
    }

    /**
     * 레코드 수 업데이트
     */
    updateRecordCount() {
        if (!this.recordCountEl) return;
        const total = this.sampleLogs.length;
        const incomplete = this.sampleLogs.filter(log => !log.isComplete).length;
        if (incomplete > 0) {
            this.recordCountEl.textContent = `${total}건 (미완료 ${incomplete}건)`;
        } else {
            this.recordCountEl.textContent = `총 ${total}건`;
        }
    }

    /**
     * 토스트 메시지 표시
     */
    showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        }
    }

    // ========================================
    // 이벤트 리스너
    // ========================================

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 네비게이션
        this.setupNavigation();

        // 폼 이벤트
        this.setupFormEvents();

        // 연도 선택
        this.setupYearSelection();

        // 전화번호 포맷팅
        this.setupPhoneFormatting();

        // 수령 방법 선택
        this.setupReceptionMethod();
    }

    /**
     * 네비게이션 이벤트 설정
     */
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-btn');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const viewName = item.dataset.view;
                this.switchView(viewName);
            });
        });
    }

    /**
     * 폼 이벤트 설정
     */
    setupFormEvents() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitForm();
            });

            // 취소 버튼
            const cancelBtn = document.getElementById('cancelBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.resetForm();
                    this.editingId = null;
                    this.switchView('register');
                });
            }
        }
    }

    /**
     * 연도 선택 이벤트 설정
     */
    setupYearSelection() {
        const yearSelect = document.getElementById('yearSelect');
        const listYearSelect = document.getElementById('listYearSelect');

        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                this.syncYearSelects(e.target.value);
                this.loadYearData(e.target.value);
            });
        }

        if (listYearSelect) {
            listYearSelect.addEventListener('change', (e) => {
                this.syncYearSelects(e.target.value);
                this.loadYearData(e.target.value);
            });
        }
    }

    /**
     * 전화번호 포맷팅 설정
     */
    setupPhoneFormatting() {
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput && window.formatPhoneNumber) {
            phoneInput.addEventListener('input', (e) => {
                e.target.value = window.formatPhoneNumber(e.target.value);
            });
        }
    }

    /**
     * 수령 방법 버튼 설정
     */
    setupReceptionMethod() {
        const methodBtns = document.querySelectorAll('.method-btn');
        const methodInput = document.getElementById('receptionMethod');

        methodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                methodBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (methodInput) {
                    methodInput.value = btn.dataset.value;
                }
            });
        });
    }

    // ========================================
    // 유틸리티 메서드
    // ========================================

    /**
     * 고유 ID 생성
     */
    generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return (typeof SampleUtils !== 'undefined' && SampleUtils.generateUUID) ? SampleUtils.generateUUID() : crypto.randomUUID();
    }

    /**
     * 디버그 로그
     */
    log(...args) {
        if (this.debug) {
            (window.logger?.debug || console.log)(`[${this.moduleName}]`, ...args);
        }
    }

    // ========================================
    // 추상 메서드 (서브클래스에서 구현 필요)
    // ========================================

    /**
     * 필터를 적용한 렌더링 — 공통 4조건(성명/접수번호 범위/날짜 범위/완료 상태)
     * + 타입 고유 필터 훅(matchesTypeSpecificFilters)
     * SLS-1-192 백포트: 기존 구현은 필터 없이 전건 렌더였음
     */
    filterAndRenderLogs() {
        const filtered = this.sampleLogs.filter(log =>
            this.matchesNameFilter(log) &&
            this.matchesReceptionFilter(log) &&
            this.matchesDateFilter(log) &&
            this.matchesCompletedFilter(log) &&
            this.matchesTypeSpecificFilters(log)
        );
        this.renderLogs(filtered);
        this.updateSearchButtonState();
    }

    /**
     * 성명 검색 필터
     * 검색어 소문자 정규화를 매처에서 수행한다 — 호출부(검색 모달 배선)가 정규화를
     * 빠뜨리면 대문자 입력 시 조용히 결과 0건이 되고, 크래시가 없어 탐지되지 않는다.
     */
    matchesNameFilter(log) {
        const needle = (this.currentSearchFilter.name || '').toLowerCase();
        return !needle || (log.name || '').toLowerCase().includes(needle);
    }

    /** 접수번호 범위 필터 */
    matchesReceptionFilter(log) {
        if (!this.currentSearchFilter.receptionFrom && !this.currentSearchFilter.receptionTo) return true;
        const logNum = this.extractReceptionNumber(log.receptionNumber || '');
        const fromNum = this.currentSearchFilter.receptionFrom ? parseInt(this.currentSearchFilter.receptionFrom, 10) : 0;
        const toNum = this.currentSearchFilter.receptionTo ? parseInt(this.currentSearchFilter.receptionTo, 10) : Infinity;
        if (fromNum && logNum < fromNum) return false;
        if (toNum !== Infinity && logNum > toNum) return false;
        return true;
    }

    /** 날짜 범위 필터 */
    matchesDateFilter(log) {
        if (!this.currentSearchFilter.dateFrom && !this.currentSearchFilter.dateTo) return true;
        const logDate = log.date;
        if (this.currentSearchFilter.dateFrom && logDate < this.currentSearchFilter.dateFrom) return false;
        if (this.currentSearchFilter.dateTo && logDate > this.currentSearchFilter.dateTo) return false;
        return true;
    }

    /** 완료 상태 필터 */
    matchesCompletedFilter(log) {
        if (this.currentSearchFilter.completed === 'completed') return log.isComplete === true;
        if (this.currentSearchFilter.completed === 'incomplete') return !log.isComplete;
        return true;
    }

    /** 타입 고유 필터 훅 — soil이 필지(lot)/목적(purpose) 조건으로 오버라이드 */
    matchesTypeSpecificFilters(log) {
        return true;
    }

    /**
     * 접수번호 문자열 끝의 숫자 추출 (필터 비교용)
     * @param {string} receptionNumber
     * @returns {number}
     */
    extractReceptionNumber(receptionNumber) {
        const match = (receptionNumber || '').match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
    }

    /**
     * 검색 버튼 상태 갱신 — 활성 필터 존재 시 has-filter 표시
     * 검사할 필터 키 목록은 getFilterKeys() 훅으로 결정
     */
    updateSearchButtonState() {
        const f = this.currentSearchFilter;
        const hasFilter = this.getFilterKeys().some(key => f[key]) ||
            (f.completed && f.completed !== 'incomplete');
        const openSearchModalBtn = document.getElementById('openSearchModalBtn');
        if (openSearchModalBtn) {
            if (hasFilter) {
                openSearchModalBtn.classList.add('has-filter');
                openSearchModalBtn.innerHTML = window.sanitizeHTML('🔍 검색 중');
            } else {
                openSearchModalBtn.classList.remove('has-filter');
                openSearchModalBtn.innerHTML = window.sanitizeHTML('🔍 검색');
            }
        }
    }

    /** 검색 버튼 상태 판정에 쓰는 필터 키 목록 훅 (completed는 별도 판정) */
    getFilterKeys() {
        return ['dateFrom', 'dateTo', 'name', 'receptionFrom', 'receptionTo'];
    }

    /**
     * 레거시 address 문자열을 주소 입력 필드(addressPostcode/addressRoad)에 반영
     * addressRoad가 이미 있으면 건드리지 않음
     * @param {Object} log - 시료 레코드
     */
    applyLegacyAddress(log) {
        if (log.addressRoad || !log.address) return;
        // 이 파일의 컨벤션(:561 window.SampleUtils?.initAutoSave)에 맞춘 방어.
        // utils.js가 뒤에 로드되는 진입점에서도 편집 진입이 죽지 않도록 한다.
        const { postcode, road } = window.SampleUtils?.splitLegacyAddress?.(log.address)
            ?? { postcode: null, road: log.address };
        const postcodeEl = this.addressPostcode || document.getElementById('addressPostcode');
        const roadEl = this.addressRoad || document.getElementById('addressRoad');
        if (postcode && postcodeEl) postcodeEl.value = postcodeEl.value || postcode;
        if (roadEl) roadEl.value = road;
    }

    /**
     * 로그 렌더링 (테이블 그리기)
     * @abstract
     */
    renderLogs(logs) {
        // 서브클래스의 prepareDataForRender hook (soil/pesticide: flattenLogsForTable)
        const preparedData = this.prepareDataForRender(logs);

        if (this.pagination) {
            this.pagination.setData(preparedData);
        } else {
            // PaginationManager 없이 직접 렌더링 (폴백)
            if (this.tableBody) {
                this.tableBody.innerHTML = '';
                preparedData.forEach((item, index) => {
                    const row = this.buildTableRow(item, index);
                    if (row) this.tableBody.appendChild(row);
                });
            }
        }
    }

    /**
     * 폼 제출 처리
     * @abstract
     */
    submitForm() {
        throw new Error('submitForm must be implemented by subclass');
    }

    /**
     * 폼 공통 입력 필드 수집 — submitForm/updateSample의 commonData 리터럴 중복 흡수
     * 반환: 10개 교집합(date/name/phoneNumber/주소4/purpose/receptionMethod/note) + 법인3(조건부).
     * createdAt/updatedAt/isComplete/타입고유필드는 호출부 책임(신규/수정 정책이 다름).
     * soil은 applicantType 요소가 없으므로 법인3 자동 스킵.
     * @param {FormData} formData
     * @returns {Object}
     */
    collectCommonFormData(formData) {
        const data = {
            date: formData.get('date'),
            name: formData.get('name'),
            phoneNumber: formData.get('phoneNumber'),
            address: formData.get('address'),
            addressPostcode: formData.get('addressPostcode'),
            addressRoad: formData.get('addressRoad'),
            addressDetail: formData.get('addressDetail'),
            purpose: formData.get('purpose'),
            receptionMethod: formData.get('receptionMethod'),
            note: formData.get('note')
        };
        // 법인/개인 구분 — applicantType 요소가 있는 타입만 (soil 자동 스킵)
        if (this.applicantTypeSelect || document.getElementById('applicantType')) {
            const applicantType = formData.get('applicantType') || '개인';
            data.applicantType = applicantType;
            data.birthDate = applicantType === '개인' ? formData.get('birthDate') : '';
            data.corpNumber = applicantType === '법인' ? formData.get('corpNumber') : '';
        }
        return data;
    }

    /**
     * 라벨 인쇄 페이지로 선택 레코드 전달
     * label-print 페이지는 [{name, address, postalCode}] 배열만 수용한다.
     * 주소 매핑 2변형(분리필드 vs address 재파싱)은 getLabelAddressParts 훅으로 흡수.
     * @param {Array} logs - 라벨로 인쇄할 레코드 배열
     */
    openLabelPrintWithData(logs) {
        const labelData = (logs || []).map(log => {
            const { address, postalCode } = this.getLabelAddressParts(log);
            return { name: log.name || '', address: address, postalCode: postalCode };
        });

        // 중복 제거 (주소 기준)
        const uniqueMap = new Map();
        labelData.forEach(item => {
            const key = `${item.address}|${item.postalCode}`;
            if (!uniqueMap.has(key)) uniqueMap.set(key, item);
        });
        const uniqueLabelData = Array.from(uniqueMap.values());

        const duplicateCount = labelData.length - uniqueLabelData.length;
        if (duplicateCount > 0) {
            this.showToast(`주소 중복 ${duplicateCount}건 제거됨 (총 ${uniqueLabelData.length}건)`, 'info');
        }

        // SLS-1-198: quota 상태에서 무가드 setItem이 throw하면 아래 이동이 실행되지 않아
        // 라벨 인쇄가 아무 반응 없이 죽는다. 실패를 알리고 이동을 중단한다.
        try {
            localStorage.setItem('labelPrintData', JSON.stringify(uniqueLabelData));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                this.showToast('저장 공간 부족으로 라벨 데이터를 전달하지 못했습니다. 설정에서 오래된 연도의 데이터를 정리해 주세요.', 'error');
                return;
            }
            throw e;
        }
        window.location.href = '../label-print/index.html';
    }

    /**
     * 라벨용 주소/우편번호 추출 훅 — 기본: 분리 필드(addressRoad/addressDetail/addressPostcode) 사용
     * soil은 address 재파싱으로 오버라이드.
     * @param {Object} log
     * @returns {{address: string, postalCode: string}}
     */
    getLabelAddressParts(log) {
        const addressParts = [];
        if (log.addressRoad) addressParts.push(log.addressRoad);
        if (log.addressDetail) addressParts.push(log.addressDetail);
        return { address: addressParts.join(' '), postalCode: log.addressPostcode || '' };
    }

    /**
     * 샘플 편집 — Template Method
     * find → 편집상태 세팅 → 공통 필드 → 타입 고유 필드(훅) → 편집모드 UI
     * SLS-1-192 백포트: 기존은 abstract thrower였음
     * @param {string} id
     */
    editSample(id) {
        const log = this.sampleLogs.find(l => String(l.id) === String(id));
        if (!log) return;
        this.editingId = log.id;
        this.editingGroupIds = [];
        this.populateCommonFields(log);
        this.populateTypeSpecificFields(log);
        this.enterEditModeUI();
    }

    /**
     * 편집 폼 공통 필드 채우기
     * 접수번호/날짜/성명/전화/주소4종(+레거시파싱)/법인토글/수령방법/비고
     * 그룹 편집의 접수번호 합치기 등은 populateTypeSpecificFields에서 덮어씀
     * @param {Object} log
     */
    populateCommonFields(log) {
        // this 캐시가 없는 타입은 getElementById로 폴백
        const recEl = this.receptionNumberInput || document.getElementById('receptionNumber');
        const dateEl = this.dateInput || document.getElementById('date');
        if (recEl) recEl.value = log.receptionNumber || '';
        if (dateEl) dateEl.value = log.date || '';

        const nameEl = document.getElementById('name');
        const phoneEl = document.getElementById('phoneNumber');
        if (nameEl) nameEl.value = log.name || '';
        if (phoneEl) phoneEl.value = log.phoneNumber || '';

        const postcodeEl = this.addressPostcode || document.getElementById('addressPostcode');
        const roadEl = this.addressRoad || document.getElementById('addressRoad');
        const detailEl = this.addressDetail || document.getElementById('addressDetail');
        const hiddenEl = this.addressHidden || document.getElementById('address');
        if (postcodeEl) postcodeEl.value = log.addressPostcode || '';
        if (roadEl) roadEl.value = log.addressRoad || '';
        if (detailEl) detailEl.value = log.addressDetail || '';
        if (hiddenEl) hiddenEl.value = log.address || '';
        this.applyLegacyAddress(log);

        this.populateApplicantType(log);
        this.populateReceptionMethod(log);

        const noteEl = document.getElementById('note');
        if (noteEl) noteEl.value = log.note || '';
    }

    /**
     * 법인/개인 신청자 구분 토글
     * soil은 applicantType 요소가 없으므로 스킵
     * @param {Object} log
     */
    populateApplicantType(log) {
        const select = this.applicantTypeSelect || document.getElementById('applicantType');
        if (!select) return;
        const applicantType = log.applicantType || '개인';
        select.value = applicantType;
        const birthDateField = this.birthDateField || document.getElementById('birthDateField');
        const corpNumberField = this.corpNumberField || document.getElementById('corpNumberField');
        const birthDateInput = this.birthDateInput || document.getElementById('birthDate');
        const corpNumberInput = this.corpNumberInput || document.getElementById('corpNumber');
        const isCorp = applicantType === '법인';
        if (birthDateField) birthDateField.classList.toggle('hidden', isCorp);
        if (corpNumberField) corpNumberField.classList.toggle('hidden', !isCorp);
        if (isCorp) {
            if (corpNumberInput) corpNumberInput.value = log.corpNumber || '';
            if (birthDateInput) birthDateInput.value = '';
        } else {
            if (birthDateInput) birthDateInput.value = log.birthDate || '';
            if (corpNumberInput) corpNumberInput.value = '';
        }
    }

    /**
     * 수령(통보)방법 버튼 active 토글 + hidden input 값 설정
     * @param {Object} log
     */
    populateReceptionMethod(log) {
        const btns = this.receptionMethodBtns || document.querySelectorAll('.reception-method-btn');
        if (btns) btns.forEach(btn => btn.classList.toggle('active', btn.dataset.method === log.receptionMethod));
        const input = this.receptionMethodInput || document.getElementById('receptionMethod');
        if (input) input.value = log.receptionMethod || '';
    }

    /**
     * 타입 고유 편집 필드 채우기 훅 (기본 no-op)
     * @param {Object} log
     */
    populateTypeSpecificFields(log) {}

    /**
     * 편집 모드 UI 진입: navSubmitBtn '수정 완료' 표시 + 폼 뷰 전환
     */
    enterEditModeUI() {
        const navSubmitBtn = this.navSubmitBtn || document.getElementById('navSubmitBtn');
        if (navSubmitBtn) {
            navSubmitBtn.title = '수정 완료';
            navSubmitBtn.classList.add('btn-edit-mode');
        }
        this.switchToEditFormView();
    }

    /**
     * 편집 시 폼 뷰 전환 훅 — 기본: switchView('form') + 안내 토스트
     * (soil은 직접 DOM 토글 + scrollIntoView로 오버라이드)
     */
    switchToEditFormView() {
        this.switchView('form');
        this.showToast('수정 모드입니다. 변경 후 등록 버튼을 클릭하세요.', 'warning');
    }

    /**
     * 폼 초기화 — Template Method
     * form.reset() → yearSelect 복원 → 편집상태 해제 → navSubmitBtn 복원
     * → 날짜(오늘/보존) → 접수번호 재생성 → onAfterFormReset() 훅
     *
     * ⚠️ 서브클래스 필수 구현 계약: generateNextReceptionNumber()
     *    base에는 정의가 없으므로 이 메서드를 상속받는 서브클래스는 반드시 구현해야 한다.
     *    실제 구현체는 인자를 받을 수 있다(soil-script.js:929는 landClass1 1-arg).
     *    base는 인자 없이 호출하므로 구현체는 인자 없는 호출에서도 동작해야 한다.
     * SLS-1-192 백포트: 기존은 abstract thrower였음
     */
    resetForm() {
        // 날짜 보존 정책: form.reset() 전에 현재 값을 저장
        const dateEl = this.dateInput || document.getElementById('date');
        const savedDate = (this.shouldPreserveDateOnReset() && dateEl) ? dateEl.value : null;

        if (this.form) this.form.reset();
        // yearSelect 복원: form.reset()이 yearSelect를 첫 옵션으로 되돌리므로 복원
        const yearSelect = document.getElementById('yearSelect');
        if (yearSelect && this.selectedYear) yearSelect.value = this.selectedYear;

        // 편집 상태 해제
        this.editingId = null;
        this.editingGroupIds = [];

        // navSubmitBtn 복원
        const navSubmitBtn = this.navSubmitBtn || document.getElementById('navSubmitBtn');
        if (navSubmitBtn) {
            navSubmitBtn.title = '접수 등록';
            navSubmitBtn.classList.remove('btn-edit-mode');
        }

        // 날짜: 보존값이 있으면 복원, 없으면 오늘
        if (dateEl) {
            if (savedDate) dateEl.value = savedDate;
            else dateEl.valueAsDate = new Date();
        }

        // 접수번호 재생성 — 미구현 시 조용한 오작동 대신 계약 위반을 즉시 드러낸다
        // (loadYearData:466은 typeof 가드로 스킵하지만, 여기서는 값이 반드시 필요하다)
        const recEl = this.receptionNumberInput || document.getElementById('receptionNumber');
        if (recEl) {
            if (typeof this.generateNextReceptionNumber !== 'function') {
                throw new Error('generateNextReceptionNumber must be implemented by subclass');
            }
            recEl.value = this.generateNextReceptionNumber();
        }

        this.onAfterFormReset();
    }

    /** 리셋 시 접수일자 보존 여부 훅 (compost: true → 현재 날짜 유지) */
    shouldPreserveDateOnReset() {
        return false;
    }

    /** 리셋 후 타입 고유 초기화 훅 (기본 no-op) */
    onAfterFormReset() {}

    /**
     * 테이블 행 빌드 (PaginationManager에서 호출)
     * @abstract
     * @param {Object} item - 데이터 항목
     * @param {number} index - 인덱스
     * @returns {HTMLElement} tr 요소
     */
    buildTableRow(item, index) {
        // 서브클래스에서 구현 필요
        // PaginationManager 미사용 시에는 구현하지 않아도 됨
        return null;
    }

    /**
     * 렌더링 전 데이터 가공 (soil/pesticide: flattenLogsForTable)
     * @param {Array} logs - 원본 데이터
     * @returns {Array} 가공된 데이터
     */
    prepareDataForRender(logs) {
        return logs;
    }

    /**
     * 추가 마이그레이션 함수 목록 (pesticide: migrateProducerAddress 등)
     * @returns {Array<Function>} 마이그레이션 함수 배열
     */
    getAdditionalMigrations() {
        return [];
    }

    /**
     * 공통 completed 필드 마이그레이션
     * @param {Array} logs - 데이터
     * @returns {Array} 마이그레이션된 데이터
     */
    migrateCompletedField(logs) {
        if (!Array.isArray(logs)) return logs;
        return logs.map(log => {
            if (log.completed === undefined) {
                return { ...log, completed: false };
            }
            return log;
        });
    }

    /**
     * hash 기반 뷰 전환
     */
    handleHashChange() {
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            this.switchView(hash);
        }
    }

    /**
     * 타입별 추가 이벤트 설정 (서브클래스에서 override)
     */
    setupTypeSpecificEvents() {
        // 서브클래스에서 오버라이드
    }

    /**
     * 페이지 변경 시 콜백 (서브클래스에서 override)
     */
    onPageChange(page, pageData) {
        // 서브클래스에서 오버라이드 가능
    }

    /**
     * 데이터 로드 후처리 hook
     */
    onAfterLoad(data, year) {
        return data;
    }

    // ========================================
    // Hook 메서드 (선택적 오버라이드)
    // ========================================

    /**
     * 뷰 초기화 시 호출
     */
    initViews() {
        // 서브클래스에서 오버라이드 가능
    }

    /**
     * 페이지네이션 초기화
     */
    initPagination() {
        if (!window.PaginationManager) return;

        this.pagination = new window.PaginationManager({
            storageKey: `${this.moduleKey}ItemsPerPage`,
            defaultItemsPerPage: 100,
            onPageChange: (page, pageData) => {
                this.onPageChange(page, pageData);
            },
            renderRow: (item, index) => {
                return this.buildTableRow(item, index);
            }
        });

        this.pagination.setTableElements(
            this.tableBody,
            this.emptyState
        );
    }

    /**
     * 연도 변경 시 호출
     */
    onYearChange(newYear) {
        // 서브클래스에서 오버라이드 가능
    }

    /**
     * 데이터 저장 전 처리
     */
    onBeforeSave(data) {
        return data;
    }

    /**
     * 데이터 저장 후 처리
     */
    onAfterSave(data) {
        // 서브클래스에서 오버라이드 가능
    }

    // ========================================
    // 정적 유틸리티 메서드
    // ========================================

    /**
     * 등록 결과 테이블 빌드 (DOM 직접 조작으로 XSS 방지)
     * @param {HTMLElement} tableBody - tbody 요소
     * @param {Array<{label: string, value: string, isMultiline?: boolean}>} rows - 테이블 행 데이터
     */
    static buildResultTable(tableBody, rows) {
        if (!tableBody) return;

        tableBody.innerHTML = '';

        rows.forEach(({ label, value, isMultiline }) => {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            const td = document.createElement('td');

            th.textContent = label;

            if (isMultiline && value && value !== '-') {
                // 줄바꿈을 <br>로 변환 (의뢰물품명 등)
                const div = document.createElement('div');
                div.className = 'request-content';
                String(value).split('\n').forEach((line, idx, arr) => {
                    div.appendChild(document.createTextNode(line));
                    if (idx < arr.length - 1) {
                        div.appendChild(document.createElement('br'));
                    }
                });
                td.appendChild(div);
            } else {
                td.textContent = value || '-';
            }

            tr.appendChild(th);
            tr.appendChild(td);
            tableBody.appendChild(tr);
        });
    }
}

// 전역으로 내보내기 (Vite 번들 환경에서도 window에 노출)
window.BaseSampleManager = BaseSampleManager;