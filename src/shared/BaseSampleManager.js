// ========================================
// Base Sample Manager 클래스
// 모든 시료 타입의 공통 기능을 관리하는 기본 클래스
// ========================================

/**
 * 시료 관리의 기본 클래스
 * 모든 시료 타입 (soil, water, compost, pesticide, heavy-metal)이 공통으로 사용하는 기능 제공
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
        this.currentPage = 1;
        this.itemsPerPage = 100;
        this.totalPages = 1;
        this.listViewStale = true;  // PER-5: 목록 뷰 리렌더 필요 여부
        this._firebaseCache = new Map();  // PER-9: 연도별 Firebase 데이터 캐시 { data, timestamp }
        this._firebaseCacheTTL = 30000;   // PER-9: 캐시 유효 시간 (30초)
        this._firebaseCacheMax = 5;       // 메모리 누수 방지: 캐시 보관 연도 상한
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
        try {
            localStorage.setItem(yearStorageKey, JSON.stringify(this.sampleLogs));
            this.log('💾 로컬 저장 완료:', this.sampleLogs.length, '건');
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                (window.logger?.warn || console.warn)('localStorage 용량 초과:', e);
                this.showToast('저장 공간이 부족합니다. 오래된 연도의 데이터를 정리해 주세요.', 'error');
                return;
            }
            throw e;
        }

        // Firebase 백그라운드 동기화 (fire-and-forget — Quota 초과 시에도 UI 블로킹 없음)
        if (window.firestoreDb?.isEnabled()) {
            window.firestoreDb.batchSave(this.moduleKey, parseInt(this.selectedYear, 10), this.sampleLogs)
                .then(() => this.log('Firebase 동기화 완료:', this.sampleLogs.length, '건'))
                .catch(err => (window.logger?.error || console.error)('Firebase 동기화 실패:', err));
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
        this.filterAndRenderLogs();
        this.showToast('삭제되었습니다.', 'success');

        // Firebase 삭제 (백그라운드)
        if (window.firestoreDb?.isEnabled()) {
            window.firestoreDb.delete(this.moduleKey, parseInt(this.selectedYear, 10), String(id))
                .then(() => this.log('Firebase 삭제 완료:', id))
                .catch(err => (window.logger?.error || console.error)('Firebase 삭제 실패:', err));
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
                    const firebaseLogs = cacheValid ? cacheEntry.data : await this.loadFromFirebase(year);

                    if (firebaseLogs && firebaseLogs.length > 0) {
                        this.log(` Firebase 데이터:`, firebaseLogs.length, '건');

                        // PER-9: TTL 포함 캐시 저장 (Firebase 원본 기준 — 다음 로드에서 재병합)
                        if (!cacheValid) {
                            // 메모리 누수 방지: 상한 초과 시 가장 오래된 항목 제거(LRU 근사)
                            if (this._firebaseCache.size >= this._firebaseCacheMax && !this._firebaseCache.has(year)) {
                                this._firebaseCache.delete(this._firebaseCache.keys().next().value);
                            }
                            this._firebaseCache.set(year, { data: JSON.parse(JSON.stringify(firebaseLogs)), timestamp: Date.now() });
                        }

                        // 통째 교체 대신 로컬과 스마트 병합(동기화 경로 단일화):
                        //  - 오프라인에서 로컬에만 추가된(syncedAt 없는) 레코드 → 보존(유실 방지)
                        //  - 클라우드에서 삭제된(과거 동기화되어 syncedAt 있는) 레코드 → 로컬에서도 제거
                        //  - 양쪽 존재 시 updatedAt 최신 우선
                        const localLogs = this.safeParseArray(yearStorageKey);
                        const mergedLogs = this.smartMerge(localLogs, firebaseLogs);
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
                        this.log(` Firebase+로컬 병합 결과 저장 (${mergedLogs.length}건, 로컬 ${localLogs.length}건)`);
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

            const data = await window.firestoreDb.getAll(this.moduleKey, parseInt(year, 10));
            this.log(` Firebase 응답:`, data ? `${data.length}건` : 'null/undefined');
            this.log(` Firebase 데이터 샘플:`, data && data.length > 0 ? data[0] : 'No data');
            return data || [];
        } catch (error) {
            console.error(`[${this.moduleName}] Firebase 로드 오류 상세:`, error);
            (window.logger?.error || console.error)('Firebase 로드 실패:', error);
            return [];
        }
    }

    /**
     * 스마트 병합 - utils.js의 함수 사용
     */
    smartMerge(localData, firebaseData) {
        if (window.SyncUtils?.smartMerge) {
            // SyncUtils.smartMerge는 { data, hasChanges, ... } 객체를 반환하므로
            // 배열 계약을 유지하기 위해 data를 언래핑한다 (객체를 그대로 쓰면 데이터 손상)
            const result = window.SyncUtils.smartMerge(localData, firebaseData);
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
     * 필터를 적용한 렌더링 (서브클래스에서 override)
     * 기본 구현은 renderLogs를 직접 호출 (필터 없음)
     */
    filterAndRenderLogs() {
        this.renderLogs(this.sampleLogs);
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
     * 샘플 편집
     * @abstract
     */
    editSample(id) {
        throw new Error('editSample must be implemented by subclass');
    }

    /**
     * 폼 초기화
     * @abstract
     */
    resetForm() {
        throw new Error('resetForm must be implemented by subclass');
    }

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