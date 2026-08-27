/**
 * @fileoverview 토양 시료 전용 스크립트
 * SoilSampleManager - BaseSampleManager 상속
 */

// ========================================
// 상수 및 설정
// ========================================

/** @type {string} */
const SAMPLE_TYPE = '토양';

/** @type {string} */
const STORAGE_KEY = 'soilSampleLogs';

/** @type {string} */
const AUTO_SAVE_FILE = 'soil-autosave.json';

/**
 * 목록 표의 머리글 칸 수 (숨긴 열 포함).
 *
 * 구분선·채움 행의 `colSpan` 폴백이다 — 평소에는 `_columnSpan()`이 머리글에서 직접
 * 센다. 표를 찾지 못했을 때만 쓴다.
 * @type {number}
 */
const SOIL_TOTAL_COLUMN_COUNT = 22;

/**
 * 시·도 탐지 폴백 정규식 — constants.js의 SIDO_PATTERN(window.SIDO_PATTERN) SSOT가
 * 미로드일 때만 사용. 실제 사용처는 항상 `window.SIDO_PATTERN || SIDO_DETECT_FALLBACK`로
 * 호출 시점에 lazy 해석하므로 로드 순서 영향 없음. (특별자치도 표기 포함, 전체 명칭)
 * g 플래그 없음 → 인스턴스 공유 시 lastIndex 부작용 없음.
 * @type {RegExp}
 */
const SIDO_DETECT_FALLBACK = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|경기도|강원도|강원특별자치도|충청북도|충청남도|전라북도|전북특별자치도|전라남도|경상북도|경상남도|제주도|제주특별자치도)\s*/;

/**
 * 선두 약어 시·도(공백 포함) 확장용 정규식 — 약어를 정식명으로 펼칠 때 사용.
 * 정식명/장음 표기는 뒤 글자가 공백이 아니어서 매칭되지 않음(no-op).
 * constants.js에 단축 패턴 SSOT가 없어 모듈 상수로 통일. g 플래그 없음 → 공유 안전.
 * @type {RegExp}
 */
const SHORT_SIDO_RE = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(\s)/;

/**
 * 경지구분 1차 선택지 (12개)
 * @type {string[]}
 */
/**
 * 접수번호 오름차순 비교 (`1`, `1-1`, `1-2`, `2`, `F3-1` 지원).
 *
 * 레코드 정렬과 목록 행 정렬이 **같은 규칙**을 써야 한다 (SLS-1-265).
 * 따로 두면 하위 지번 행이 엉뚱한 자리에 끼어든다.
 * `F` 접두는 떼고 비교한다 — 성토와 일반은 이미 다른 그룹이다.
 * @param {string} a @param {string} b @returns {number}
 */
function compareReceptionNumbers(a, b) {
    const sa = String(a || '');
    const sb = String(b || '');
    const partsA = sa.replace(/^F/, '').split('-').map(Number);
    const partsB = sb.replace(/^F/, '').split('-').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const va = partsA[i] || 0;
        const vb = partsB[i] || 0;
        if (va !== vb) return va - vb;
    }
    // 숫자가 같으면 `503`과 `F503`이 남는다. 예전에는 0을 돌려줘 **입력 순서에 맡겼고**,
    // 하위 지번 행까지 정렬하게 되면서 두 그룹이 섞일 수 있었다(codex 지적).
    // 일반을 먼저 두어 순서를 고정한다 — 숫자 순서 자체는 바뀌지 않는다.
    return (sa.startsWith('F') ? 1 : 0) - (sb.startsWith('F') ? 1 : 0);
}

const LAND_CLASS1_OPTIONS = ['개량제', '전략', '직불', '자체', '기타', '친환경', '유기농', '무농약', 'GAP', '농가의뢰', '대표필지', '공익직불제'];

/**
 * 경지구분 1차 기본값
 * @type {string}
 */
const LAND_CLASS1_DEFAULT = '농가의뢰';

/**
 * 통계 모달 경지구분별 차트의 라벨·색상 매핑.
 * LAND_CLASS1_OPTIONS 변경 시 함께 갱신할 것. 매핑 외 값은 category-other 폴백.
 * @type {Object.<string, {label: string, class: string}>}
 */
const LAND_CLASS1_STATS_MAPPING = {
    '농가의뢰': { label: '🧑‍🌾 농가의뢰', class: 'purpose-general' },
    '공익직불제': { label: '🏛️ 공익직불제', class: 'purpose-gap' },
    '대표필지': { label: '📍 대표필지', class: 'category-facility' },
    '개량제': { label: '🧪 개량제', class: 'category-fill' },
    '전략': { label: '🎯 전략', class: 'category-fruit' },
    '직불': { label: '💰 직불', class: 'purpose-lowcarbon' },
    '자체': { label: '🏢 자체', class: 'landclass-self' },
    '친환경': { label: '🌿 친환경', class: 'purpose-nopesticide' },
    '유기농': { label: '♻️ 유기농', class: 'purpose-organic' },
    '무농약': { label: '🍃 무농약', class: 'category-field' },
    'GAP': { label: '✅ GAP', class: 'landclass-gapcert' },
    '기타': { label: '📦 기타', class: 'category-other' }
};

/**
 * 공익직불제 기준년도(이행점검명) 선택지 (임시값, 추후 교체 가능)
 * @type {string[]}
 */
const GONGIK_BASE_YEAR_OPTIONS = ['2024토양화학성분 기준', '2025토양화학성분 기준', '2026토양화학성분 기준', '2027토양화학성분 기준'];

// ========================================
// SoilSampleManager 클래스
// ========================================

class SoilSampleManager extends window.BaseSampleManager {
    constructor() {
        super({
            moduleKey: 'soil',
            moduleName: '토양',
            storageKey: STORAGE_KEY,
            sampleType: SAMPLE_TYPE,
            autoSaveFile: AUTO_SAVE_FILE,
            debug: !!window.DEBUG
        });

        // Soil-specific state
        this.parcels = [];
        this.parcelIdCounter = 0;
        this.currentRegistrationData = null;
        // SLS-1-122: Firebase 삭제 실패 시 보류 큐 — online 복귀 시 재시도해
        //            클라우드 잔존 문서로 인한 삭제 레코드 부활을 방지한다.
        this._pendingCloudDeletes = new Set();
        this.listViewStale = true;
        this.currentSearchFilter = {
            dateFrom: '',
            dateTo: '',
            name: '',
            receptionFrom: '',
            receptionTo: '',
            lot: '',
            purpose: '',
            completed: 'incomplete',
            landClass1: '농가의뢰'
        };
        this.isFullView = false;
        this.autoSaveFileHandle = null;
        // SLS-1-198: 이 클래스는 웹에서도 저장 시 파일 자동저장을 수행한다
        // (saveLogs 오버라이드가 autoSaveToFile 직접 호출) → 백업 판정에 반영
        this._webAutoSaveOnSave = true;
        this.regionSelectionModalData = null;
        this.editingLogId = null;
        this.editingGroupId = null;      // undefined면 groupId 없는 레코드에 오매칭된다 (SLS-1-223 리뷰)
        this.editingGroupLogs = null;
        this.pendingMailDateIds = [];

        // Pagination state (soil uses its own pagination, NOT PaginationManager)
        this.currentFlatRows = [];

        // Modal state
        this.currentParcelIdForCrop = null;
        this.tempCropAreas = [];
        this.currentSubLotParcelId = null;
        this.currentSubLotIndex = null;

        // Crop modal state (legacy)
        this.tempSelectedCrops = [];
        this.confirmedCrops = [];

        this._initDomRefPlaceholders();
        this._initSoilFileHelpers();
    }

    /**
     * DOM 참조 필드 초기화 (실제 참조는 cacheElements에서 설정).
     */
    _initDomRefPlaceholders() {
        // Soil-specific DOM refs (set in cacheElements)
        this.dateInput = null;
        this.parcelsContainer = null;
        this.addParcelBtn = null;
        this.parcelsDataInput = null;
        this.emptyParcels = null;
        this.paginationContainer = null;
        this.receptionNumberInput = null;
        this.subCategorySelect = null;
        this.purposeSelect = null;
        this.landClass1Select = null;
        this.landClass1Tab = null;
        this.receptionMethodBtns = null;
        this.receptionMethodInput = null;
        this.navSubmitBtn = null;
        this.navResetBtn = null;
        this.selectAllCheckbox = null;
        this.logTable = null;
        this.listViewTitle = null;

        // Pagination DOM refs
        this.paginationInfo = null;
        this.itemsPerPageSelect = null;
        this.pageNumbersContainer = null;
        this.firstPageBtn = null;
        this.prevPageBtn = null;
        this.nextPageBtn = null;
        this.lastPageBtn = null;

        // Address refs
        this.addressPostcode = null;
        this.addressRoad = null;
        this.addressDetail = null;
        this.addressHidden = null;
        this.addressManager = null;

        // Modal refs
        this.cropAreaModal = null;
        this.cropAreaList = null;
        this.addCropAreaBtn = null;
        this.confirmCropAreaBtn = null;
        this.cancelCropAreaBtn = null;
        this.closeCropAreaModalBtn = null;
        this.registrationResultModal = null;
        this.resultTableBody = null;
        this.listSearchModal = null;
        this.statisticsModal = null;
        this.mailDateModal = null;
        this.regionSelectionModal = null;
    }

    /**
     * 면적 포맷터·soil 전용 엑셀 저장 함수 초기화.
     */
    _initSoilFileHelpers() {
        // Area formatting from shared utils
        if (window.SampleUtils) {
            this.formatArea = window.SampleUtils.formatArea;
            this.getUnitLabel = window.SampleUtils.getUnitLabel;
            this.formatAreaWithUnit = window.SampleUtils.formatAreaWithUnit;
        }

        // soil 전용 엑셀 저장 함수 추가
        if (this.FileAPI) {
            this.FileAPI.saveExcel = async function(buffer, suggestedName = 'data.xlsx') {
                if (window.isElectron) {
                    const filePath = await window.electronAPI.saveFileDialog({
                        title: '엑셀 파일 저장',
                        defaultPath: suggestedName,
                        filters: [
                            { name: 'Excel Files', extensions: ['xlsx'] },
                            { name: 'All Files', extensions: ['*'] }
                        ]
                    });
                    if (filePath) {
                        const result = await window.electronAPI.writeFile(filePath, buffer);
                        return result.success;
                    }
                    return false;
                }
                return false;
            };
        }
    }

    // ========================================
    // Override: DOM 요소 캐싱
    // ========================================

    cacheElements() {
        super.cacheElements();

        // Override different IDs (soil uses logTableBody / emptyState)
        this.tableBody = document.getElementById('logTableBody');
        this.emptyState = document.getElementById('emptyState');

        // Soil-specific elements
        this.dateInput = document.getElementById('date');
        this.parcelsContainer = document.getElementById('parcelsContainer');
        this.addParcelBtn = document.getElementById('addParcelBtn');
        this.parcelsDataInput = document.getElementById('parcelsData');
        this.emptyParcels = document.getElementById('emptyParcels');
        this.paginationContainer = document.getElementById('pagination');
        this.receptionNumberInput = document.getElementById('receptionNumber');
        this.subCategorySelect = document.getElementById('subCategory');
        this.purposeSelect = document.getElementById('purpose');
        this.landClass1Select = document.getElementById('landClass1');
        this.landClass1Tab = document.getElementById('landClass1Tab');
        this.receptionMethodBtns = document.querySelectorAll('.reception-method-btn');
        this.receptionMethodInput = document.getElementById('receptionMethod');
        this.navSubmitBtn = document.getElementById('navSubmitBtn');
        this.navResetBtn = document.getElementById('navResetBtn');
        this.selectAllCheckbox = document.getElementById('selectAll');
        this.logTable = document.getElementById('logTable');
        this.listViewTitle = document.getElementById('listViewTitle');

        // Pagination elements
        this.paginationInfo = document.getElementById('paginationInfo');
        this.itemsPerPageSelect = document.getElementById('itemsPerPage');
        this.pageNumbersContainer = document.getElementById('pageNumbers');
        this.firstPageBtn = document.getElementById('firstPage');
        this.prevPageBtn = document.getElementById('prevPage');
        this.nextPageBtn = document.getElementById('nextPage');
        this.lastPageBtn = document.getElementById('lastPage');

        // Address refs
        this.addressPostcode = document.getElementById('addressPostcode');
        this.addressRoad = document.getElementById('addressRoad');
        this.addressDetail = document.getElementById('addressDetail');
        this.addressHidden = document.getElementById('address');

        // Modal refs
        this.cropAreaModal = document.getElementById('cropAreaModal');
        this.cropAreaList = document.getElementById('cropAreaList');
        this.addCropAreaBtn = document.getElementById('addCropAreaBtn');
        this.confirmCropAreaBtn = document.getElementById('confirmCropAreaBtn');
        this.cancelCropAreaBtn = document.getElementById('cancelCropAreaBtn');
        this.closeCropAreaModalBtn = document.getElementById('closeCropAreaModal');
        this.registrationResultModal = document.getElementById('registrationResultModal');
        this.resultTableBody = document.getElementById('resultTableBody');
        this.listSearchModal = document.getElementById('listSearchModal');
        this.statisticsModal = document.getElementById('statisticsModal');
        this.mailDateModal = document.getElementById('mailDateModal');
        this.regionSelectionModal = document.getElementById('regionSelectionModal');
    }

    // ========================================
    // Override: 뷰 초기화
    // ========================================

    initViews() {
        // 경지구분 1차 폼/탭 option 동적 생성 (LAND_CLASS1_OPTIONS 단일 소스)
        this.populateLandClass1Options();

        // 오늘 날짜 설정
        if (this.dateInput) {
            this.dateInput.valueAsDate = new Date();
        }

        // 기존 데이터 마이그레이션 (년도 없는 기존 데이터를 현재 년도로 이동)
        const oldData = SampleUtils.safeParseJSON(this.storageKey, []);
        if (oldData.length > 0) {
            const yearKey = this.getStorageKey(this.selectedYear);
            if (!localStorage.getItem(yearKey)) {
                localStorage.setItem(yearKey, JSON.stringify(oldData));
                this.log('기존 데이터를 년도별 저장소로 마이그레이션:', oldData.length, '건');
            }
        }

        // 리스트 뷰 제목 업데이트
        this.updateListViewTitle();

        // 페이지당 항목 수 초기화
        if (this.itemsPerPageSelect) {
            this.itemsPerPageSelect.value = this.itemsPerPage;
        }
    }

    // ========================================
    // Override: 페이지네이션 (soil은 PaginationManager 사용 안함)
    // ========================================

    initPagination() {
        // soil은 자체 페이지네이션 사용 - PaginationManager 초기화 건너뜀
        this.itemsPerPage = parseInt(localStorage.getItem('soilItemsPerPage'), 10) || 100;
    }

    // ========================================
    // Override: completed 필드 마이그레이션 (soil은 isComplete 사용)
    // ========================================

    migrateCompletedField(logs) {
        if (!Array.isArray(logs)) return logs;
        return logs.map(log => {
            if (log.completed !== undefined || log.isCompleted !== undefined) {
                log.isComplete = log.isComplete || log.isCompleted || log.completed || false;
                delete log.completed;
                delete log.isCompleted;
            }
            if (log.isComplete === undefined) {
                log.isComplete = false;
            }
            // 경지구분 1차 마이그레이션: 없으면 기본값으로 채움
            if (log.landClass1 === undefined || log.landClass1 === null || log.landClass1 === '') {
                log.landClass1 = LAND_CLASS1_DEFAULT;
            }
            // 공익직불제 전용 메타 마이그레이션
            if (log.gongikOrder === undefined) log.gongikOrder = '1';
            if (log.gongikBaseYear === undefined) log.gongikBaseYear = '';
            return log;
        });
    }

    // ========================================
    // Override: 렌더링 전 데이터 가공 (flattenLogsForTable)
    // ========================================

    prepareDataForRender(logs) {
        return this.flattenLogsForTable(logs);
    }

    // ========================================
    // Override: switchView (listViewStale 로직)
    // ========================================

    switchView(viewName) {
        // 뷰 전환 시 열려있는 자동완성 리스트 모두 닫기
        this.closeAllAutocomplete();

        const views = document.querySelectorAll('.view');
        const navItems = document.querySelectorAll('.nav-btn');

        views.forEach(view => view.classList.remove('active'));
        navItems.forEach(nav => nav.classList.remove('active'));

        const targetView = document.getElementById(`${viewName}View`);
        const targetNav = document.querySelector(`.nav-btn[data-view="${viewName}"]`);

        if (targetView) targetView.classList.add('active');
        if (targetNav) targetNav.classList.add('active');

        // 목록 뷰로 전환 시 데이터 변경이 있을 때만 새로고침
        if (viewName === 'list' && this.listViewStale) {
            this.filterAndRenderLogs();
            this.listViewStale = false;
        }
    }

    /**
     * 열려있는 모든 자동완성 리스트 닫기
     */
    closeAllAutocomplete() {
        document.querySelectorAll('.crop-autocomplete-list.show, .lot-address-autocomplete-list.show')
            .forEach(el => el.classList.remove('show'));
    }

    // ========================================
    // Override: updateRecordCount (no "총" prefix)
    // ========================================

    updateRecordCount() {
        if (!this.recordCountEl) return;
        const total = this.sampleLogs.length;
        const incomplete = this.sampleLogs.filter(log => !log.isComplete).length;
        if (incomplete > 0) {
            this.recordCountEl.textContent = `${total}건 (미완료 ${incomplete}건)`;
        } else {
            this.recordCountEl.textContent = `${total}건`;
        }
    }

    // ========================================
    // Override: setupReceptionMethod (different selectors)
    // ========================================

    setupReceptionMethod() {
        if (this.receptionMethodBtns) {
            this.receptionMethodBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.receptionMethodBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (this.receptionMethodInput) {
                        this.receptionMethodInput.value = btn.dataset.method;
                    }
                });
            });
        }
    }

    // ========================================
    // Override: setupEventListeners
    // ========================================

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

    // ========================================
    // Override: setupPhoneFormatting
    // ========================================

    setupPhoneFormatting() {
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput && window.SampleUtils?.setupPhoneNumberInput) {
            window.SampleUtils.setupPhoneNumberInput(phoneInput);
        }
    }

    // ========================================
    // Override: setupFormEvents
    // ========================================

    setupFormEvents() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitForm();
            });

            // 폼 리셋 시 필지도 초기화
            this.form.addEventListener('reset', () => {
                setTimeout(() => {
                    this.parcels = [];
                    this.parcelIdCounter = 0;
                    if (this.parcelsContainer) this.parcelsContainer.innerHTML = '';
                    this.addParcel();
                }, 0);
            });
        }
    }

    // ========================================
    // Override: setupYearSelection (extra auto-save logic)
    // ========================================

    setupYearSelection() {
        const yearSelect = document.getElementById('yearSelect');
        const listYearSelect = document.getElementById('listYearSelect');

        const handleYearChange = async (e) => {
            this.syncYearSelects(e.target.value);
            await this.loadYearData(e.target.value);
            // 로컬 모드에서만 auto-save 로드 (Firebase 모드에서는 로드 안함)
            if (window.isElectron && this.FileAPI && !window.firebaseConfig?.isEnabled()) {
                await this.loadAutoSaveForSelectedYear();
            }
            this.showToast(`${e.target.value}년 데이터를 불러왔습니다.`, 'success');
        };

        if (yearSelect) yearSelect.addEventListener('change', handleYearChange);
        if (listYearSelect) listYearSelect.addEventListener('change', handleYearChange);
    }

    // ========================================
    // Override: 연도 변경 hook
    // ========================================

    onYearChange(newYear) {
        this.updateListViewTitle();
    }

    // ========================================
    // Override: saveLogs (soil-specific: sessionStorage)
    // ========================================

    async saveLogs() {
        const yearStorageKey = this.getStorageKey(this.selectedYear);
        this.listViewStale = true;
        this._firebaseCache.delete(this.selectedYear);  // PER-9: 캐시 무효화

        // ID가 없는 항목에 ID 추가 (in-place)
        // 배열을 새 복사본으로 교체하지 않고 제자리에서 id만 보충한다. 복사본 교체 시
        // 외부(예: runVerificationForModal에 넘긴 newLogs)에 보관된 log 참조가 고아가 되어
        // 이후 mutation(addressVerified 등)이 실제 sampleLogs에 반영되지 않는 문제가 있었다.
        // (SLS-1-24 빨강 표시 유실 근본 차단)
        this.sampleLogs.forEach(item => {
            if (!item.id) item.id = this.generateId();
        });

        // 로컬 저장 (Firebase는 개별 변경 시 호출자에서 직접 처리)
        // SLS-1-198: quota 초과 시 return하지 않는다. 이 오버라이드는 Firebase를 직접
        // 올리지 않으므로, 여기서 끊으면 아래의 파일 자동저장 — Firebase 미설정 센터에서는
        // **유일한 잔여 백업** — 까지 함께 죽는다. 토스트도 이 경로에서는 클라우드 문구를
        // 억제한다(cloudWritesInThisPath: false — 업로드는 persistRecords→firebaseSaveRecords 담당).
        this._localSaveFailed = false;
        try {
            localStorage.setItem(yearStorageKey, JSON.stringify(this.sampleLogs));
            this.log('로컬 저장 완료:', this.sampleLogs.length, '건');
            this._warnIfStorageNearFull();
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                (window.logger?.warn || console.warn)('localStorage 용량 초과:', e);
                this._localSaveFailed = true;
                this._notifyQuotaExceeded({ cloudWritesInThisPath: false });
            } else {
                throw e;
            }
        }

        // 자동 저장 실행
        const autoSaveEnabled = localStorage.getItem('soilAutoSaveEnabled') === 'true';
        if (autoSaveEnabled && (window.isElectron ? this.FileAPI?.autoSavePath : this.autoSaveFileHandle)) {
            this.autoSaveToFile();
        }

        this.updateRecordCount();

        sessionStorage.setItem('lastSaveTime', new Date().toISOString());
    }

    // ========================================
    // Firebase 개별 저장 (Quota 절감: 변경분만 write)
    // ========================================

    /**
     * 레코드를 Firestore에 개별 저장 (백그라운드, fire-and-forget)
     * @param {Array|Object} logs - 저장할 레코드 (배열 또는 단일 객체)
     */
    firebaseSaveRecords(logs) {
        if (!window.firestoreDb?.isEnabled()) return;
        const arr = Array.isArray(logs) ? logs : [logs];
        const year = parseInt(this.selectedYear, 10);
        const promises = arr
            .filter(log => log.id)
            .map(log => window.firestoreDb.save('soil', year, String(log.id), log));
        Promise.allSettled(promises).then(results => {
            // save는 실패 시 reject가 아닌 false 반환 — value===false도 실패로 판정해야 함
            const failed = results.filter(r => r.status === 'rejected' || r.value === false);
            if (failed.length > 0) {
                (window.logger?.error || console.error)('Firebase 저장 실패:', failed.length, '건');
                this.showToast(`클라우드 동기화 ${failed.length}건 실패`, 'warning');
            }
        });
    }

    /**
     * localStorage 저장 + Firestore 개별 저장을 한 번에 수행하는 편의 메서드.
     * saveLogs() + firebaseSaveRecords(records) 연쇄 호출 패턴의 단일 소스.
     * @param {Array|Object} records - Firestore에 동기화할 레코드 (배열 또는 단일 객체)
     */
    persistRecords(records) {
        this.saveLogs();
        this.firebaseSaveRecords(records);
    }

    /**
     * 레코드를 Firestore에서 개별 삭제 (백그라운드, fire-and-forget)
     * @param {Array|string} ids - 삭제할 ID (배열 또는 단일 문자열)
     */
    firebaseDeleteRecords(ids) {
        if (!window.firestoreDb?.isEnabled()) return;
        const arr = Array.isArray(ids) ? ids : [ids];
        const year = parseInt(this.selectedYear, 10);
        // SLS-1-122: id별 결과를 추적해 실패분만 보류 큐에 적재한다.
        // 주의: firestoreDb.delete는 실패 시 reject가 아니라 false로 resolve한다
        // (deleteDocument의 catch → false) — value===false도 실패로 판정해야 한다.
        const tracked = arr.map(id => ({
            id: String(id),
            promise: window.firestoreDb.delete('soil', year, String(id))
        }));
        Promise.allSettled(tracked.map(t => t.promise)).then(results => {
            const failedIds = [];
            results.forEach((r, i) => {
                if (r.status === 'rejected' || r.value === false) failedIds.push(tracked[i].id);
            });
            if (failedIds.length > 0) {
                (window.logger?.error || console.error)('Firebase 삭제 실패:', failedIds.length, '건');
                // SLS-1-122: 실패한 삭제 id를 큐에 보관 → online 복귀 시 재시도(_retryCloudSyncAction).
                failedIds.forEach(id => this._pendingCloudDeletes.add(id));
                this._handleCloudSyncFailure();
            }
        });
    }

    /**
     * SLS-1-122: online 복귀 시 재시도 동작 오버라이드.
     * 베이스 기본 구현은 saveLogs()만 호출하지만, soil의 saveLogs는 로컬 전용이라
     * 실패한 삭제가 재시도되지 않아 클라우드 문서가 잔존하고 다음 병합에서 부활한다.
     * → 보류 삭제를 먼저 재시도하고, 성공분만 큐에서 제거한 뒤 전체 동기화를 수행한다.
     */
    _retryCloudSyncAction() {
        if (!window.firestoreDb?.isEnabled()) {
            // 오프라인 등으로 비활성 — 다음 online 이벤트에서 다시 시도하도록 실패 상태 재무장
            if (this._pendingCloudDeletes.size > 0) this._handleCloudSyncFailure();
            return;
        }

        const year = parseInt(this.selectedYear, 10);
        const pending = Array.from(this._pendingCloudDeletes);

        if (pending.length === 0) {
            // 보류 삭제 없음 → 전체 재동기화만
            this.firebaseBatchSync();
            return;
        }

        this.log('🔁 보류 삭제 재시도:', pending.length, '건');
        const tracked = pending.map(id => ({
            id,
            promise: window.firestoreDb.delete('soil', year, String(id))
        }));
        Promise.allSettled(tracked.map(t => t.promise)).then(results => {
            const stillFailed = [];
            results.forEach((r, i) => {
                // delete는 실패 시 false resolve — fulfilled여도 value===false면 실패
                if (r.status === 'fulfilled' && r.value !== false) {
                    this._pendingCloudDeletes.delete(tracked[i].id);  // 성공분만 큐에서 제거
                } else {
                    stillFailed.push(tracked[i].id);
                }
            });
            if (stillFailed.length > 0) {
                // 일부 재시도 실패 → 다음 online 복귀에서 다시 시도
                (window.logger?.warn || console.warn)('보류 삭제 재시도 일부 실패:', stillFailed.length, '건');
                this._handleCloudSyncFailure();
            } else {
                this.log('✅ 보류 삭제 전부 재시도 완료');
            }
            // 삭제 정리 후 전체 동기화로 나머지 변경분 반영
            this.firebaseBatchSync();
        });
    }

    /**
     * 전체 데이터를 Firestore에 동기화 (대량 import 전용)
     * SLS-1-122: cloudSyncPromise 락으로 동시 batchSave를 직렬화한다.
     * 메인(sample-log-electron) syncWithCloud의 Promise 락과 동일한 의미 —
     * 진행 중인 batchSave가 끝난 뒤에야 다음 batchSave가 시작되어 쓰기 순서를 보장한다.
     * 락 진입 시점에 최신 sampleLogs 스냅샷을 잡으므로, 대기 중 변경분도 누락되지 않는다.
     * @returns {Promise<void>}
     */
    async firebaseBatchSync() {
        if (!window.firestoreDb?.isEnabled()) return;

        // 이전 동기화가 끝난 뒤 이어서 실행되도록 체인을 건다 (직렬화 락).
        const previous = this.cloudSyncPromise;
        const run = (async () => {
            if (previous) {
                this.log('⏳ 기존 전체 동기화 대기 중...');
                await previous.catch(() => {});  // 이전 실패는 흡수, 직렬성만 보장
            }
            const snapshot = [...this.sampleLogs]; // 레이스 컨디션 방지: 락 진입 시점 스냅샷
            if (snapshot.length === 0) {
                // batchSave는 빈 배열에도 false를 반환하므로 호출 생략 (거짓 실패→재시도 루프 방지, saveLogs와 동일 정책)
                this.log('빈 데이터 — 전체 동기화 생략');
                return;
            }
            try {
                // batchSave는 실패 시 throw가 아닌 false 반환 — 반환값 검사 필수
                const ok = await window.firestoreDb.batchSave('soil', parseInt(this.selectedYear, 10), snapshot);
                if (ok) {
                    this.log('Firebase 전체 동기화 완료:', snapshot.length, '건');
                } else {
                    (window.logger?.error || console.error)('Firebase 전체 동기화 실패 (batchSave false)');
                    this._handleCloudSyncFailure(); // 토스트 + online 복귀 재시도
                }
            } catch (err) {
                (window.logger?.error || console.error)('Firebase 전체 동기화 실패:', err);
                this._handleCloudSyncFailure();
            }
        })();
        this.cloudSyncPromise = run;

        try {
            await run;
        } finally {
            // 자신이 체인의 마지막이면 락 해제 (뒤이은 호출이 이어받았으면 그대로 둠)
            if (this.cloudSyncPromise === run) {
                this.cloudSyncPromise = null;
            }
        }
    }

    // ========================================
    // Override: deleteSample (soil-specific: inline Firebase delete)
    // ========================================

    async deleteSample(id, receptionNumber = null) {
        const beforeCount = this.sampleLogs.length;
        this.sampleLogs = this.sampleLogs.filter(log => String(log.id) !== String(id));
        const deleted = beforeCount - this.sampleLogs.length;
        await this.saveLogs();
        this.filterAndRenderLogs();
        // SLS-1-198: quota로 로컬 기록이 실패했으면 success 토스트가 quota 경고와 모순된다
        if (deleted > 0 && !this._localSaveFailed) {
            this.showToast('삭제되었습니다.', 'success');
        }

        // Firebase에서도 삭제
        this.firebaseDeleteRecords(id);

        // 삭제한 항목이 수정 중이던 항목이면 수정 모드 취소
        if (String(this.editingLogId) === String(id)) {
            this.cancelEditMode();
        }

        // 삭제된 접수번호의 기본번호를 입력란에 세팅 (재입력 편의)
        if (receptionNumber && this.receptionNumberInput) {
            const baseNumber = receptionNumber.split('-')[0];
            // 해당 기본번호가 더 이상 존재하지 않으면 입력란에 세팅
            const stillExists = this.sampleLogs.some(log =>
                (log.receptionNumber || '').split('-')[0] === baseNumber
            );
            if (!stillExists) {
                this.receptionNumberInput.value = baseNumber;
            }
        }
    }

    /**
     * 그룹 삭제: 같은 groupId를 가진 모든 시료를 삭제하고 접수번호를 재사용 가능하도록 세팅
     * @param {string} groupId - 삭제할 그룹 ID
     * @param {string} baseReceptionNumber - 삭제 후 세팅할 접수번호
     */
    async deleteGroup(groupId, baseReceptionNumber) {
        const groupLogs = this.sampleLogs.filter(log => log.groupId === groupId);
        const deleteIds = groupLogs.map(log => log.id);

        this.sampleLogs = this.sampleLogs.filter(log => log.groupId !== groupId);
        await this.saveLogs();
        this.filterAndRenderLogs();

        // Firebase에서도 삭제
        this.firebaseDeleteRecords(deleteIds);

        // 수정 중이던 항목이 삭제 그룹에 포함되면 수정 모드 취소
        if (deleteIds.map(String).includes(String(this.editingLogId))) {
            this.cancelEditMode();
        }

        // 삭제된 접수번호를 입력란에 세팅하여 재입력 편의 제공
        if (baseReceptionNumber && this.receptionNumberInput) {
            this.receptionNumberInput.value = baseReceptionNumber;
        }

        // SLS-1-198: quota로 로컬 기록이 실패했으면 success 토스트 억제
        if (!this._localSaveFailed) {
            this.showToast(`${groupLogs.length}건이 삭제되었습니다. 접수번호 ${baseReceptionNumber}번으로 재입력할 수 있습니다.`, 'success');
        }
    }

    // ========================================
    // Override: renderLogs (soil-specific pagination)
    // ========================================

    renderLogs(logs) {
        if (!this.tableBody) return;
        this.tableBody.innerHTML = '';

        // 공익직불제 탭 선택 시 경영체등록번호·BASEPNU 컬럼 표시
        this._syncTableModeClasses();
        this._syncGongikBulkBar();

        this.updateRecordCount();

        if (!logs || logs.length === 0) {
            if (this.emptyState) this.emptyState.classList.remove('hidden');
            if (this.paginationContainer) this.paginationContainer.style.display = 'none';
            this.currentFlatRows = [];
            this.updatePaginationUI();
            return;
        }

        if (this.emptyState) this.emptyState.classList.add('hidden');
        if (this.paginationContainer) this.paginationContainer.style.display = 'flex';

        // 접수번호 기준 오름차순 정렬 (1, 1-1, 1-2, 2, 3-1 등 지원)
        const sortedLogs = [...logs].sort(
            (a, b) => compareReceptionNumbers(a.receptionNumber, b.receptionNumber));

        // 데이터 평탄화
        // SLS-1-265: 평탄화는 레코드 순서대로 하위 지번 행을 자기 레코드 뒤에 붙인다.
        // 작물 분할이 있으면 `503, 503-2, 503-3, 503-1`처럼 순서가 뒤집혀 보인다
        // (하위 지번이 형제 레코드 번호를 건너뛰기 때문). 번호는 맞지만 읽기 불편해
        // **표시 번호 기준으로 한 번 더 정렬**한다. 기존 데이터는 순서가 그대로다.
        this.currentFlatRows = this.flattenLogsForTable(sortedLogs);

        // 페이지네이션 계산
        this.totalPages = Math.ceil(this.currentFlatRows.length / this.itemsPerPage) || 1;
        if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        this.renderCurrentPage();
    }

    /**
     * SLS-1-277: 목록 표의 **모드 클래스를 한 자리에서** 맞춘다.
     *
     * `gongik-on`(공익직불제 전용 열)과 `allclass-on`(전체 경지구분 탭)은 항상 함께
     * 갱신되어야 한다. 예전에는 두 줄이 `renderLogs`와 `renderCurrentPage`에 그대로
     * 복사돼 있어, 모드가 하나 더 늘면 한쪽만 고치는 사고가 나기 쉬웠다.
     *
     * ⚠️ `allclass-on`은 **경지구분 열을 되살리는** 클래스다. 평소 그 열을 감추는
     *    근거(SLS-1-261)는 "탭이 이미 현재 구분을 보여 준다"인데, 그 전제가
     *    '전체 경지구분' 탭에서는 깨진다 — 12개 구분의 행이 섞이고 채번이 구분
     *    단위로 독립이라(`reception-number.js`) 같은 접수번호가 여러 줄로 보인다.
     *
     * @returns {boolean} 공익직불제 모드 여부
     */
    _syncTableModeClasses() {
        const filter = this.currentSearchFilter?.landClass1;
        const gongikOn = filter === '공익직불제';
        const table = this.logTable || document.getElementById('logTable');
        table?.classList.toggle('gongik-on', gongikOn);
        table?.classList.toggle('allclass-on', !filter);
        return gongikOn;
    }

    /** 공익직불제 탭일 때만 차수·기준년도 일괄 적용 바 표시 */
    _syncGongikBulkBar() {
        const bar = document.getElementById('gongikBulkBar');
        if (bar) bar.style.display = (this.currentSearchFilter?.landClass1 === '공익직불제') ? '' : 'none';
    }

    /** 공익직불제 전체 레코드에 차수·기준년도 일괄 적용 */
    applyGongikBulk() {
        const order = document.getElementById('gongikBulkOrder')?.value || '1';
        const baseYear = document.getElementById('gongikBulkBaseYear')?.value || '';
        const targets = this.sampleLogs.filter(l => (l.landClass1 || LAND_CLASS1_DEFAULT) === '공익직불제');
        if (targets.length === 0) {
            this.showToast('공익직불제 레코드가 없습니다.', 'warning');
            return;
        }
        const orderLabel = order === '2' ? '2차' : '1차';
        if (!confirm(`${this.selectedYear}년 공익직불제 ${targets.length}건(현재 필터 무관 전체)에 차수=${orderLabel}, 기준년도=${baseYear || '(없음)'}을(를) 일괄 적용합니다. 계속하시겠습니까?`)) return;
        const now = new Date().toISOString();
        targets.forEach(l => { l.gongikOrder = order; l.gongikBaseYear = baseYear; l.updatedAt = now; });
        this.persistRecords(targets);
        this.filterAndRenderLogs();
        this.showToast(`공익직불제 ${targets.length}건에 일괄 적용했습니다.`, 'success');
    }

    // ========================================
    // Override: setupTableEventDelegation (soil uses its own)
    // ========================================

    setupTableEventDelegation() {
        // soil handles table events in setupTypeSpecificEvents via direct delegation
        // Do not call base class setupTableEventDelegation
    }

    // ========================================
    // 경지구분 1차 (landClass1) 헬퍼
    // ========================================

    /**
     * 폼 select(#landClass1)와 목록 탭 select(#landClass1Tab) option을
     * LAND_CLASS1_OPTIONS 단일 소스로 동적 생성한다.
     */
    populateLandClass1Options() {
        if (this.landClass1Select && this.landClass1Select.options.length === 0) {
            const frag = document.createDocumentFragment();
            LAND_CLASS1_OPTIONS.forEach(value => {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = value;
                if (value === LAND_CLASS1_DEFAULT) opt.defaultSelected = true;
                frag.appendChild(opt);
            });
            this.landClass1Select.appendChild(frag);
            this.landClass1Select.value = LAND_CLASS1_DEFAULT;
        }
        if (this.landClass1Tab && this.landClass1Tab.options.length === 0) {
            const frag = document.createDocumentFragment();
            const allOpt = document.createElement('option');
            allOpt.value = '';
            allOpt.textContent = '전체 경지구분';
            frag.appendChild(allOpt);
            LAND_CLASS1_OPTIONS.forEach(value => {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = value;
                frag.appendChild(opt);
            });
            this.landClass1Tab.appendChild(frag);
            this.landClass1Tab.value = LAND_CLASS1_DEFAULT;
        }
    }

    // ========================================
    // 접수번호 생성
    // ========================================

    /**
     * 현재 폼에서 선택된 경지구분 1차 값 반환 (없으면 기본값)
     * @returns {string}
     */
    getCurrentLandClass1() {
        return (this.landClass1Select?.value) || LAND_CLASS1_DEFAULT;
    }

    /**
     * form.reset()은 동적으로 옵션을 채우는 select(연도, 경지구분 1차)를
     * 첫 번째 옵션으로 되돌리므로, 리셋 전후로 값을 캡처·복원한다.
     * (동일 버그가 세 호출부에서 반복 발생해 SLS-1-176에서 공유 헬퍼로 통합)
     */
    _resetFormPreservingSelects() {
        const prevLandClass1 = this.getCurrentLandClass1();
        this.form.reset();
        const yearSelect = document.getElementById('yearSelect');
        if (yearSelect && this.selectedYear) yearSelect.value = this.selectedYear;
        if (this.landClass1Select && prevLandClass1) this.landClass1Select.value = prevLandClass1;
    }

    /**
     * 일반(성토 제외) 다음 접수번호 생성.
     * 같은 경지구분 1차 범위 내에서 독립적으로 max+1 계산.
     * @param {string} [landClass1] 기준 경지구분 1차 (미지정 시 현재 폼 값)
     * @returns {string}
     */
    generateNextReceptionNumber(landClass1) {
        const targetClass = landClass1 || this.getCurrentLandClass1();
        const nextNumber = window.ReceptionNumber.computeNextNumber(this.sampleLogs, targetClass);
        this.log('다음 접수번호 생성:', nextNumber, '(경지구분1차:', targetClass, ')');
        return String(nextNumber);
    }

    /**
     * 성토(F) 다음 접수번호 생성.
     * 같은 경지구분 1차 범위 내에서 독립적으로 max+1 계산.
     * @param {string} [landClass1] 기준 경지구분 1차 (미지정 시 현재 폼 값)
     * @returns {string}
     */
    generateNextFillReceptionNumber(landClass1) {
        const targetClass = landClass1 || this.getCurrentLandClass1();
        const nextNumber = window.ReceptionNumber.computeNextNumber(this.sampleLogs, targetClass, { fill: true });
        this.log('다음 성토 접수번호 생성: F' + nextNumber, '(경지구분1차:', targetClass, ')');
        return `F${nextNumber}`;
    }

    // ========================================
    // 가져오기용 공개 API (스트림 B 연동 계약)
    // ========================================

    /**
     * 지정 연도 저장소에서 같은 경지구분 1차 범위의 다음 일반 접수번호(숫자) 계산.
     * 성토(F)는 제외하며, 가져오기는 일반 번호 체계를 사용한다.
     * @param {number|string} year 대상 연도
     * @param {string} landClass1 경지구분 1차
     * @returns {number} 다음 접수번호(정수)
     */
    getNextNumberForClass(year, landClass1) {
        const targetClass = landClass1 || LAND_CLASS1_DEFAULT;
        const targetYear = year || this.selectedYear;
        // 현재 로드된 연도면 메모리 데이터, 아니면 해당 연도 저장소를 읽는다.
        const logs = (String(targetYear) === String(this.selectedYear))
            ? this.sampleLogs
            : SampleUtils.safeParseJSON(this.getStorageKey(targetYear), []);
        return window.ReceptionNumber.computeNextNumber(logs, targetClass);
    }

    /**
     * 현재 연도 저장소에 가져온 레코드 한 건 추가.
     * receptionNumber 미지정 시 landClass1별 독립 번호를 자동 부여한다.
     * @param {Object} record - { name, phoneNumber, lotAddress, cropsDisplay, area,
     *   subCategory, purpose, note, landClass1, receptionNumber? }
     * @returns {Object} 저장된 레코드(부여된 receptionNumber 포함)
     */
    addImportedRecord(record) {
        const src = record || {};
        const landClass1 = src.landClass1 || LAND_CLASS1_DEFAULT;

        // 접수번호: 지정값 우선, 없으면 경지구분 1차별 독립 번호 자동 부여.
        //
        // 성토(subCategory='성토')는 'F' 접두의 **별 시퀀스**를 쓴다. 이 분기가 없으면
        // computeNextNumber가 일반 체계(fill=false)로 계산하며 방금 저장한 성토 레코드를
        // 제외하므로 카운터가 전진하지 않고, 가져온 성토 행 전부가 '1'로 저장된다.
        // 그 뒤로는 일반 접수의 자동채번도 1번에 고정된다 (SLS-1-222).
        const isFill = src.subCategory === '성토';
        const receptionNumber = (src.receptionNumber != null && String(src.receptionNumber).trim() !== '')
            ? String(src.receptionNumber).trim()
            : (isFill
                ? this.generateNextFillReceptionNumber(landClass1)
                : String(this.getNextNumberForClass(this.selectedYear, landClass1)));

        const lotAddress = src.lotAddress || '';
        const cropsDisplay = src.cropsDisplay || '-';
        const area = (src.area != null ? String(src.area) : '0');
        const nowISO = new Date().toISOString();

        const newLog = {
            id: crypto.randomUUID(),
            receptionNumber,
            date: src.date || new Date().toISOString().slice(0, 10),
            name: src.name || '',
            phoneNumber: src.phoneNumber || '',
            address: src.address || '',
            addressPostcode: src.addressPostcode || '',
            addressRoad: src.addressRoad || '',
            addressDetail: src.addressDetail || '',
            subCategory: src.subCategory || '-',
            purpose: src.purpose || '',
            landClass1,
            receptionMethod: src.receptionMethod || '-',
            note: src.note || '',
            businessRegNo: src.businessRegNo || '',
            gongikOrder: src.gongikOrder || '1',
            gongikBaseYear: src.gongikBaseYear || '',
            basePnu: src.basePnu || '',
            groupId: crypto.randomUUID(),
            parcelIndex: 1,
            totalParcels: 1,
            createdAt: nowISO,
            updatedAt: nowISO,
            isComplete: false,
            parcels: [{
                id: crypto.randomUUID(),
                lotAddress,
                isMountain: false,
                subLots: [],
                crops: cropsDisplay && cropsDisplay !== '-'
                    ? [{ name: cropsDisplay, area: (parseFloat(area) || 0).toString() }]
                    : [],
                category: src.subCategory || '',
                purpose: src.purpose || '',
                // 🚨 여기에 src.note를 넣지 않는다 (SLS-1-241). parcel.note는 **주소 필드**이고
                //    레코드의 '비고'와는 다른 것이다. 복사하면 비고 문구가
                //    흙토람에 제출하는 파일의 주소 칸까지 흘러간다:
                //      화면       폼 '기타주소' 입력란 · 목록 '기타주소' 열 · 상세 모달
                //      흙토람     dataRow[16] '기타주소'    (heuktoram-script.js)
                //      공익직불제  dataRow[C+17] '상세주소'
                //    레코드 수준 note(위)가 비고의 자리다.
                note: ''
            }],
            lotAddress,
            area: (parseFloat(area) || 0).toString(),
            cropsDisplay
        };

        this.sampleLogs.push(newLog);
        this.persistRecords(newLog);
        this.filterAndRenderLogs();
        this.log('가져오기 레코드 추가:', receptionNumber, '(경지구분1차:', landClass1, ')');
        return newLog;
    }

    // ========================================
    // 접수번호 가져오기 (연도 제외)
    // ========================================

    getReceptionNumber() {
        if (!this.receptionNumberInput) {
            (window.logger?.warn || console.warn)('접수번호 입력란을 찾을 수 없습니다');
            return '';
        }
        const value = this.receptionNumberInput.value.trim();
        if (!value) {
            (window.logger?.warn || console.warn)('접수번호가 비어있습니다');
            return '';
        }
        const parts = value.split('-');
        if (parts.length >= 2) {
            const numberPart = parts.slice(1).join('-');
            this.log('접수번호 추출:', value, '->', numberPart);
            return numberPart;
        }
        this.log('접수번호 형식 확인:', value);
        return value;
    }

    // ========================================
    // 필지 관리 시스템
    // ========================================

    addParcel() {
        this.log('필지 추가 함수 호출됨');
        const parcelId = `parcel-${this.parcelIdCounter++}`;
        const parcel = {
            id: parcelId,
            lotAddress: '',
            isMountain: false,
            subLots: [],
            crops: [],
            category: '',
            purpose: '',
            note: ''
        };
        this.parcels.push(parcel);
        this.log('생성된 필지 ID:', parcelId, '전체 필지 개수:', this.parcels.length);

        this.renderParcelCard(parcel, this.parcels.length);
        this.updateParcelsData();
        this.updateEmptyParcelsState();
    }

    removeParcel(parcelId) {
        if (this.parcels.length > 1) {
            this.parcels = this.parcels.filter(p => p.id !== parcelId);
            const el = document.getElementById(parcelId);
            if (el) el.remove();
            this.updateParcelNumbers();
            this.updateParcelsData();
        } else {
            alert('최소 1개의 필지가 필요합니다.');
        }
    }

    updateEmptyParcelsState() {
        if (this.emptyParcels) {
            if (this.parcels.length === 0) {
                this.emptyParcels.style.display = 'block';
            } else {
                this.emptyParcels.style.display = 'none';
            }
        }
    }

    updateParcelNumbers() {
        if (!this.parcelsContainer) return;
        const cards = this.parcelsContainer.querySelectorAll('.parcel-card');
        cards.forEach((card, idx) => {
            card.querySelector('h4').textContent = `필지 ${idx + 1}`;
        });
    }

    updateParcelsData() {
        if (this.parcelsDataInput) {
            this.parcelsDataInput.value = JSON.stringify(this.parcels);
        }
    }

    updateAllParcelNumbers() {
        this.parcels.forEach((parcel) => {
            this.updateSubLotsDisplay(parcel.id);
            this.updateCropsAreaDisplay(parcel.id);
        });
    }

    updateParcelCardsMode(isFillMode) {
        if (this.parcelsContainer) {
            if (isFillMode) {
                this.parcelsContainer.classList.add('fill-mode');
            } else {
                this.parcelsContainer.classList.remove('fill-mode');
            }
        }
    }

    // ========================================
    // 필지 카드 렌더링
    // ========================================

    renderParcelCard(parcel, index) {
        this.log('필지 카드 렌더링 시작:', parcel.id, 'index:', index);

        const card = document.createElement('div');
        card.className = 'parcel-card';
        card.id = parcel.id;
        card.innerHTML = sanitizeHTML(this._buildParcelCardHTML(parcel, index));

        if (!this.parcelsContainer) {
            (window.logger?.error || console.error)('parcelsContainer를 찾을 수 없습니다!');
            return;
        }

        this.parcelsContainer.appendChild(card);

        // 이벤트 바인딩
        this.bindDirectCropAutocomplete(parcel.id);
        this.bindLotAddressAutocomplete(parcel.id);
        this.bindSubLotAutocomplete(parcel.id);
        this.bindAreaUnitConversion(parcel.id);
        this.bindParcelSelects(parcel.id);
    }

    // 필지 카드 마크업 문자열을 생성한다 (sanitizeHTML 적용 전 원본)
    _buildParcelCardHTML(parcel, parcelNumber) {
        return `
            ${this._buildParcelCardHeader(parcel, parcelNumber)}
            <div class="parcel-form-grid">
                ${this._buildParcelCardLeftColumn(parcel)}
                ${this._buildParcelCardRightColumn(parcel, parcelNumber)}
                <div class="parcel-note-row">
                    <div class="parcel-form-group parcel-note-group">
                        <label for="parcel-note-${parcel.id}">기타주소</label>
                        <input type="text" class="parcel-note-input"
                               id="parcel-note-${parcel.id}"
                               name="parcel-note-${parcel.id}"
                               data-id="${parcel.id}"
                               placeholder="예: 1동, 2동"
                               value="${escapeHTML(parcel.note || '')}">
                    </div>
                </div>
                <div class="parcel-summary" id="summary-${parcel.id}">
                    ${this.renderParcelSummary(parcel)}
                </div>
            </div>
        `;
    }

    _buildParcelCardHeader(parcel, parcelNumber) {
        const parcelCategory = parcel.category || '';
        const parcelPurpose = parcel.purpose || '';
        return `
            <div class="parcel-card-header">
                <h4>필지 ${parcelNumber}</h4>
                <div class="parcel-header-selects">
                    <select class="parcel-category-select" data-id="${parcel.id}" id="parcel-category-${parcel.id}">
                        <option value="">구분</option>
                        <option value="논" ${parcelCategory === '논' ? 'selected' : ''}>논</option>
                        <option value="밭" ${parcelCategory === '밭' ? 'selected' : ''}>밭</option>
                        <option value="과수" ${parcelCategory === '과수' ? 'selected' : ''}>과수</option>
                        <option value="시설" ${parcelCategory === '시설' ? 'selected' : ''}>시설</option>
                        <option value="임야" ${parcelCategory === '임야' ? 'selected' : ''}>임야</option>
                        <option value="성토" ${parcelCategory === '성토' ? 'selected' : ''}>성토</option>
                    </select>
                    <select class="parcel-purpose-select" data-id="${parcel.id}" id="parcel-purpose-${parcel.id}">
                        <option value="">용도</option>
                        <option value="일반재배" ${parcelPurpose === '일반재배' ? 'selected' : ''}>일반재배</option>
                        <option value="무농약" ${parcelPurpose === '무농약' ? 'selected' : ''}>무농약</option>
                        <option value="유기" ${parcelPurpose === '유기' ? 'selected' : ''}>유기</option>
                        <option value="GAP" ${parcelPurpose === 'GAP' ? 'selected' : ''}>GAP</option>
                        <option value="저탄소" ${parcelPurpose === '저탄소' ? 'selected' : ''}>저탄소</option>
                    </select>
                </div>
                <button type="button" class="btn-remove-parcel" data-id="${parcel.id}">삭제</button>
            </div>
        `;
    }

    _buildParcelCardLeftColumn(parcel) {
        const firstCrop = parcel.crops[0] || { name: '', area: '' };
        const safeLotAddress = escapeHTML(parcel.lotAddress);
        const safeCropName = escapeHTML(firstCrop.name);
        return `
                <div class="parcel-left-column">
                    <div class="parcel-form-group">
                        <label for="lot-address-${parcel.id}">
                            필지 주소 (주 지번) <span class="label-hint">* 리+지번 입력 후 Enter</span>
                        </label>
                        <div class="lot-address-row" style="display:flex; gap:0.5rem; align-items:flex-start;">
                            <div class="lot-address-autocomplete-wrapper" style="flex:1; min-width:0;">
                                <input type="text" class="lot-address-input"
                                       id="lot-address-${parcel.id}"
                                       name="lot-address-${parcel.id}"
                                       data-id="${parcel.id}"
                                       placeholder="예: ○○리 224, ○○리 산 423"
                                       value="${safeLotAddress}">
                                <ul class="lot-address-autocomplete-list" id="lotAutocomplete-${parcel.id}"></ul>
                            </div>
                            <button type="button" class="mountain-btn" data-id="${parcel.id}" data-active="${parcel.isMountain ? 'true' : 'false'}" aria-pressed="${parcel.isMountain ? 'true' : 'false'}" style="flex:0 0 auto; padding:0.5rem 1rem; border:1px solid ${parcel.isMountain ? '#f59e0b' : '#d1d5db'}; border-radius:0.5rem; background:${parcel.isMountain ? '#fef3c7' : '#f9fafb'}; color:${parcel.isMountain ? '#92400e' : '#374151'}; font-weight:${parcel.isMountain ? '600' : 'normal'}; font-size:0.875rem; cursor:pointer; user-select:none; white-space:nowrap; transition:all 0.15s;">산</button>
                        </div>
                    </div>
                    <div class="crop-area-row">
                        <div class="parcel-form-group">
                            <label for="crop-direct-${parcel.id}">작물명</label>
                            <div class="crop-autocomplete-wrapper">
                                <input type="text" class="crop-direct-input"
                                       id="crop-direct-${parcel.id}"
                                       name="crop-direct-${parcel.id}"
                                       data-id="${parcel.id}"
                                       placeholder="예: 고추"
                                       value="${safeCropName}">
                                <ul class="crop-autocomplete-list" id="autocomplete-direct-${parcel.id}"></ul>
                            </div>
                        </div>
                        <div class="parcel-form-group">
                            <label for="area-direct-${parcel.id}">면적</label>
                            <div class="area-input-group">
                                <input type="number" class="area-direct-input"
                                       id="area-direct-${parcel.id}"
                                       name="area-direct-${parcel.id}"
                                       data-id="${parcel.id}"
                                       placeholder="면적"
                                       value="${firstCrop.area}">
                                <div class="area-unit-toggle" id="area-unit-${parcel.id}" data-id="${parcel.id}" data-unit="${firstCrop.unit || 'm2'}">
                                    <button type="button" class="unit-btn ${(!firstCrop.unit || firstCrop.unit === 'm2') ? 'active' : ''}" data-value="m2">㎡</button>
                                    <button type="button" class="unit-btn ${firstCrop.unit === 'pyeong' ? 'active' : ''}" data-value="pyeong">평</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn-add-crop-compact" data-id="${parcel.id}">
                        <span>+</span> 추가 작물
                    </button>
                    <div class="crops-area-container" id="cropsArea-${parcel.id}">
                        ${this._renderAdditionalCrops(parcel)}
                    </div>
                </div>
        `;
    }

    _buildParcelCardRightColumn(parcel, parcelNumber) {
        return `
                <div class="parcel-right-column">
                    <div class="parcel-form-group">
                        <label for="sub-lot-${parcel.id}">하위 필지</label>
                        <div class="sub-lot-input-wrapper">
                            <div class="lot-address-autocomplete-wrapper">
                                <input type="text" class="sub-lot-input"
                                       id="sub-lot-${parcel.id}"
                                       name="sub-lot-${parcel.id}"
                                       data-id="${parcel.id}"
                                       placeholder="예: ○○리 224, ○○리 산 423">
                                <ul class="lot-address-autocomplete-list" id="subLotAutocomplete-${parcel.id}"></ul>
                            </div>
                            <button type="button" class="btn-add-sub-lot-icon" data-id="${parcel.id}" title="하위 필지 추가">+</button>
                        </div>
                        <div class="sub-lots-container" id="subLots-${parcel.id}">
                            ${this._renderSubLots(parcel, parcelNumber)}
                        </div>
                    </div>
                </div>
        `;
    }

    _renderAdditionalCrops(parcel) {
        const formatAreaWithUnit = this.formatAreaWithUnit || window.SampleUtils?.formatAreaWithUnit || ((v) => v);
        return parcel.crops.slice(1).map((crop, idx) => {
            const safeCropName = escapeHTML(crop.name);
            return `
                <div class="crop-area-item" data-index="${idx + 1}">
                    <span class="crop-name">${safeCropName}</span>
                    <span class="crop-area">${formatAreaWithUnit(crop.area, crop.unit || 'm2')}</span>
                    <button type="button" class="remove-crop-area">&times;</button>
                </div>
            `;
        }).join('');
    }

    _renderSubLotCard(parcel, subLot, idx, parcelNumber) {
        const formatArea = this.formatArea || window.SampleUtils?.formatArea || ((v) => v);
        const number = `${parcelNumber}-${idx + 1}`;
        const lotAddress = typeof subLot === 'string' ? subLot : subLot.lotAddress;
        const crops = typeof subLot === 'string' ? [] : (subLot.crops || []);
        const subLotCropsId = `subLotCrops-${parcel.id}-${idx}`;
        const safeLotAddress = escapeHTML(lotAddress);
        return `
            <div class="sub-lot-card">
                <div class="sub-lot-card-header">
                    <div class="sub-lot-info">
                        <span class="sub-lot-number">${number}</span>
                        <span class="sub-lot-value">${safeLotAddress}</span>
                    </div>
                    <button type="button" class="remove-sub-lot" data-index="${idx}">&times;</button>
                </div>
                <div class="sub-lot-crops-list" id="${subLotCropsId}">
                    ${crops.map((crop, cropIdx) => {
                        const safeCropName = escapeHTML(crop.name);
                        return `
                        <div class="sub-lot-crop-item">
                            <span class="crop-name">${safeCropName}</span>
                            <div class="crop-area-info">
                                <span class="crop-area">${formatArea(crop.area)} m²</span>
                                <button type="button" class="remove-sublot-crop" data-sublot-index="${idx}" data-crop-index="${cropIdx}">&times;</button>
                            </div>
                        </div>
                    `;}).join('')}
                </div>
                <button type="button" class="btn-add-sublot-crop" data-parcel-id="${parcel.id}" data-sublot-index="${idx}">
                    + 작물 추가
                </button>
            </div>
        `;
    }

    _renderSubLots(parcel, parcelNumber) {
        return parcel.subLots.map((subLot, idx) =>
            this._renderSubLotCard(parcel, subLot, idx, parcelNumber)
        ).join('');
    }

    // ========================================
    // 필지별 구분/목적 드롭다운 이벤트 바인딩
    // ========================================

    bindParcelSelects(parcelId) {
        const categorySelect = document.getElementById(`parcel-category-${parcelId}`);
        const purposeSelectEl = document.getElementById(`parcel-purpose-${parcelId}`);

        const toggleHasValue = (selectEl) => {
            selectEl.classList.toggle('has-value', selectEl.value !== '');
        };

        if (categorySelect) {
            toggleHasValue(categorySelect);
            categorySelect.addEventListener('change', (e) => {
                toggleHasValue(e.target);
                const parcel = this.parcels.find(p => p.id === parcelId);
                if (parcel) {
                    parcel.category = e.target.value;
                    this.updateParcelsData();
                }
            });
        }

        if (purposeSelectEl) {
            toggleHasValue(purposeSelectEl);
            purposeSelectEl.addEventListener('change', (e) => {
                toggleHasValue(e.target);
                const parcel = this.parcels.find(p => p.id === parcelId);
                if (parcel) {
                    parcel.purpose = e.target.value;
                    this.updateParcelsData();
                }
            });
        }
    }

    // ========================================
    // 면적 단위 변환 이벤트 바인딩
    // ========================================

    bindAreaUnitConversion(parcelId) {
        const areaInput = document.getElementById(`area-direct-${parcelId}`);
        const unitToggle = document.getElementById(`area-unit-${parcelId}`);

        if (!areaInput || !unitToggle) return;

        const unitButtons = unitToggle.querySelectorAll('.unit-btn');
        unitButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const newUnit = btn.dataset.value;
                const previousUnit = unitToggle.dataset.unit;
                if (newUnit === previousUnit) return;
                unitButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                unitToggle.dataset.unit = newUnit;
            });
        });
    }

    // ========================================
    // 필지 주소 자동완성 바인딩
    // ========================================

    bindLotAddressAutocomplete(parcelId) {
        const lotInput = document.querySelector(`.lot-address-input[data-id="${parcelId}"]`);
        const autocompleteList = document.getElementById(`lotAutocomplete-${parcelId}`);
        window.AddressAutocomplete.bind(lotInput, autocompleteList, {
            regionKeys: null,
            onInput: () => this.updateParcelLotAddress(parcelId),
            onSelect: (_value, ctx) => {
                // 산 필지 선택 시 parcel.isMountain + 체크박스 자동 동기화
                if (ctx && typeof ctx.isMountain === 'boolean') {
                    this.syncMountainCheckbox(parcelId, ctx.isMountain);
                }
                this.updateParcelLotAddress(parcelId);
            },
            onShowModal: (result) => this.showRegionSelectionModal(result, parcelId, lotInput),
        });
    }

    /**
     * 산 필지 버튼 + parcel.isMountain 상태 동기화
     */
    syncMountainCheckbox(parcelId, isMountain) {
        const parcel = this.parcels.find(p => p.id === parcelId);
        if (parcel) parcel.isMountain = !!isMountain;
        this.applyMountainToggleStyle(parcelId, !!isMountain);
    }

    /**
     * '산' 버튼 외관 갱신 (data-active + 색 팔레트)
     */
    applyMountainToggleStyle(parcelId, isMountain) {
        const btn = document.querySelector(`.mountain-btn[data-id="${parcelId}"]`);
        if (!btn) return;
        btn.dataset.active = isMountain ? 'true' : 'false';
        btn.setAttribute('aria-pressed', isMountain ? 'true' : 'false');
        btn.style.background = isMountain ? '#fef3c7' : '#f9fafb';
        btn.style.borderColor = isMountain ? '#f59e0b' : '#d1d5db';
        btn.style.color = isMountain ? '#92400e' : '#374151';
        btn.style.fontWeight = isMountain ? '600' : 'normal';
    }

    // ========================================
    // 하위 지번 자동완성 바인딩
    // ========================================

    bindSubLotAutocomplete(parcelId) {
        const subLotInput = document.querySelector(`.sub-lot-input[data-id="${parcelId}"]`);
        const autocompleteList = document.getElementById(`subLotAutocomplete-${parcelId}`);
        window.AddressAutocomplete.bind(subLotInput, autocompleteList, {
            // null = 정적 데이터 전체 지역 검색 + JUSO API 폴백 활성
            regionKeys: null,
            onShowModal: (result) => this.showRegionSelectionModal(result, parcelId, subLotInput),
        });
    }

    // ========================================
    // 직접 입력 자동완성 바인딩
    // ========================================

    bindDirectCropAutocomplete(parcelId) {
        const cropInput = document.querySelector(`.crop-direct-input[data-id="${parcelId}"]`);
        const autocompleteList = document.getElementById(`autocomplete-direct-${parcelId}`);

        if (!cropInput || !autocompleteList) return;

        cropInput.addEventListener('input', (e) => {
            const value = e.target.value.trim().toLowerCase();
            if (value.length > 0 && typeof CROP_DATA !== 'undefined') {
                const matches = CROP_DATA.filter(crop =>
                    crop.name.toLowerCase().includes(value)
                ).slice(0, 8);

                if (matches.length > 0) {
                    autocompleteList.innerHTML = '';
                    matches.forEach(crop => {
                        const li = document.createElement('li');
                        li.dataset.code = crop.code || '';
                        li.dataset.name = crop.name || '';
                        li.textContent = `${crop.name} (${crop.category})`;
                        autocompleteList.appendChild(li);
                    });
                    autocompleteList.classList.add('show');
                } else {
                    autocompleteList.classList.remove('show');
                }
            } else {
                autocompleteList.classList.remove('show');
            }
            this.updateFirstCrop(parcelId);
        });

        cropInput.addEventListener('blur', () => {
            setTimeout(() => { autocompleteList.classList.remove('show'); }, 200);
        });

        autocompleteList.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                const name = e.target.dataset.name;
                cropInput.value = name;
                autocompleteList.classList.remove('show');
                this.updateFirstCrop(parcelId);
                const areaInput = document.querySelector(`.area-direct-input[data-id="${parcelId}"]`);
                if (areaInput) areaInput.focus();
            }
        });
    }

    // ========================================
    // 필지 주소 업데이트
    // ========================================

    updateParcelLotAddress(parcelId) {
        const parcel = this.parcels.find(p => p.id === parcelId);
        const lotInput = document.querySelector(`.lot-address-input[data-id="${parcelId}"]`);

        if (parcel && lotInput) {
            const newValue = lotInput.value.trim();
            if (!newValue) {
                this.showToast('필지 주소를 입력해주세요.', 'warning');
                lotInput.focus();
                return;
            }
            parcel.lotAddress = newValue;
            this.updateParcelsData();
            this.updateParcelSummary(parcelId);
        }
    }

    // ========================================
    // 첫 번째 작물 업데이트
    // ========================================

    updateFirstCrop(parcelId) {
        const parcel = this.parcels.find(p => p.id === parcelId);
        const cropInput = document.querySelector(`.crop-direct-input[data-id="${parcelId}"]`);
        const areaInput = document.querySelector(`.area-direct-input[data-id="${parcelId}"]`);
        const unitToggle = document.getElementById(`area-unit-${parcelId}`);

        if (!parcel || !cropInput || !areaInput) return;

        const cropName = cropInput.value.trim();
        const cropArea = areaInput.value.trim();
        const unit = unitToggle ? unitToggle.dataset.unit : 'm2';

        if (cropName && cropArea) {
            if (parcel.crops.length === 0) {
                parcel.crops.push({ name: cropName, area: cropArea, code: '', unit: unit });
            } else {
                parcel.crops[0].name = cropName;
                parcel.crops[0].area = cropArea;
                parcel.crops[0].unit = unit;
            }
        } else {
            if (parcel.crops.length === 1 && (!parcel.crops[0].name || !parcel.crops[0].area)) {
                parcel.crops = [];
            }
        }

        this.updateParcelSummary(parcelId);
        this.updateParcelsData();
    }

    // ========================================
    // 필지 요약 렌더링
    // ========================================

    renderParcelSummary(parcel) {
        const allCrops = [
            ...parcel.crops,
            ...parcel.subLots.flatMap(subLot => {
                if (typeof subLot === 'string') return [];
                return subLot.crops || [];
            })
        ].filter(c => c.name && c.area);

        let m2Total = 0;
        let pyeongTotal = 0;
        allCrops.forEach(crop => {
            const area = parseFloat(crop.area) || 0;
            if (crop.unit === 'pyeong') {
                pyeongTotal += area;
            } else {
                m2Total += area;
            }
        });

        const cropCount = allCrops.length;
        const subLotCount = parcel.subLots.length;

        const areaParts = [];
        if (m2Total > 0) areaParts.push(`${m2Total.toLocaleString()} ㎡`);
        if (pyeongTotal > 0) areaParts.push(`${pyeongTotal.toLocaleString()} 평`);
        const areaDisplay = areaParts.length > 0 ? areaParts.join(' / ') : '0';

        return `
            <div class="summary-item">
                <span>하위 필지:</span>
                <span>${subLotCount}개</span>
            </div>
            <div class="summary-item">
                <span>작물 수:</span>
                <span>${cropCount}개</span>
            </div>
            <div class="summary-item total-area">
                <span>총 면적:</span>
                <span>${areaDisplay}</span>
            </div>
        `;
    }

    updateParcelSummary(parcelId) {
        const parcel = this.parcels.find(p => p.id === parcelId);
        const summaryEl = document.getElementById(`summary-${parcelId}`);
        if (summaryEl && parcel) {
            summaryEl.innerHTML = sanitizeHTML(this.renderParcelSummary(parcel));
        }
    }

    // ========================================
    // 하위 지번 표시 업데이트
    // ========================================

    updateSubLotsDisplay(parcelId) {
        const parcel = this.parcels.find(p => p.id === parcelId);
        const parcelIndex = this.parcels.indexOf(parcel) + 1;
        const container = document.getElementById(`subLots-${parcelId}`);
        if (!container || !parcel) return;

        const formatAreaWithUnit = this.formatAreaWithUnit || window.SampleUtils?.formatAreaWithUnit || ((v) => v);

        container.innerHTML = sanitizeHTML(parcel.subLots.map((subLot, idx) => {
            const number = `${parcelIndex}-${idx + 1}`;
            const lotAddress = typeof subLot === 'string' ? subLot : subLot.lotAddress;
            const crops = typeof subLot === 'string' ? [] : (subLot.crops || []);
            const subLotCropsId = 'subLotCrops-' + parcelId + '-' + idx;
            const safeLotAddress = escapeHTML(lotAddress);
            return `
                <div class="sub-lot-card bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-slate-200 dark:border-zinc-700">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <span class="sub-lot-number bg-primary text-white px-2 py-1 rounded text-xs font-bold">` + number + `</span>
                            <span class="sub-lot-value font-medium text-slate-800 dark:text-slate-200">` + safeLotAddress + `</span>
                        </div>
                        <button type="button" class="remove-sub-lot text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 text-lg" data-index="` + idx + `">&times;</button>
                    </div>
                    <div class="sub-lot-crops-list space-y-1" id="` + subLotCropsId + `">
                        ` + crops.map((crop, cropIdx) => {
                            const safeCropName = escapeHTML(crop.name);
                            return `
                            <div class="flex items-center justify-between bg-white dark:bg-zinc-900 px-2 py-1.5 rounded text-xs">
                                <span class="font-medium text-slate-700 dark:text-slate-300">` + safeCropName + `</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-slate-600 dark:text-slate-400">` + formatAreaWithUnit(crop.area, crop.unit || 'm2') + `</span>
                                    <button type="button" class="remove-sublot-crop text-slate-400 hover:text-red-500 text-sm" data-sublot-index="` + idx + `" data-crop-index="` + cropIdx + `">&times;</button>
                                </div>
                            </div>
                        `;}).join('') + `
                    </div>
                    <button type="button" class="btn-add-sublot-crop mt-2 w-full text-xs text-primary hover:text-primary-hover font-medium py-1.5 border border-dashed border-primary rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" data-parcel-id="` + parcelId + `" data-sublot-index="` + idx + `">
                        + 작물 추가
                    </button>
                </div>
            `;
        }).join(''));
    }

    // ========================================
    // 작물 면적 표시 업데이트
    // ========================================

    updateCropsAreaDisplay(parcelId) {
        const parcel = this.parcels.find(p => p.id === parcelId);
        if (!parcel) return;
        const container = document.getElementById(`cropsArea-${parcelId}`);
        if (!container) return;

        const formatAreaWithUnit = this.formatAreaWithUnit || window.SampleUtils?.formatAreaWithUnit || ((v) => v);

        container.innerHTML = sanitizeHTML(parcel.crops.slice(1).map((crop, idx) => {
            const subLotLabel = this.getSubLotLabel(crop.subLotTarget, parcel);
            const safeCropName = escapeHTML(crop.name);
            const safeSubLotLabel = escapeHTML(subLotLabel);
            return `
                <div class="crop-area-item" data-index="${idx + 1}">
                    <span class="crop-name">${safeCropName}</span>
                    <span class="crop-area">${formatAreaWithUnit(crop.area, crop.unit || 'm2')}</span>
                    ${subLotLabel ? `<span class="crop-sublot">${safeSubLotLabel}</span>` : ''}
                    <button type="button" class="remove-crop-area">&times;</button>
                </div>
            `;
        }).join(''));
    }

    getSubLotLabel(subLotTarget, parcel) {
        if (!subLotTarget || subLotTarget === 'all') return '';
        if (!parcel.subLots || parcel.subLots.length === 0) return '';
        const idx = parcel.subLots.indexOf(subLotTarget);
        if (idx >= 0) {
            return `[${subLotTarget}]`;
        }
        return '';
    }

    // ========================================
    // 작물+면적 입력 모달
    // ========================================

    openCropAreaModal(parcelId) {
        this.currentParcelIdForCrop = parcelId;
        const parcel = this.parcels.find(p => p.id === parcelId);
        this.tempCropAreas = parcel.crops.map(c => ({
            ...c,
            subLotTarget: c.subLotTarget || 'all'
        }));
        this.renderCropAreaModal();
        if (this.cropAreaModal) this.cropAreaModal.classList.remove('hidden');
    }

    getSubLotOptions(parcelId) {
        const parcel = this.parcels.find(p => p.id === parcelId);
        if (!parcel) return [];
        const options = [{ value: 'all', label: '전체 (상위 필지 전체)' }];
        if (parcel.subLots && parcel.subLots.length > 0) {
            parcel.subLots.forEach((lot, idx) => {
                options.push({ value: lot, label: `하위 ${idx + 1}: ${lot}` });
            });
        }
        return options;
    }

    closeCropAreaModalFn() {
        if (this.cropAreaModal) this.cropAreaModal.classList.add('hidden');
        this.currentParcelIdForCrop = null;
        this.tempCropAreas = [];
    }

    renderCropAreaModal() {
        if (this.tempCropAreas.length === 0) {
            this.tempCropAreas.push({ name: '', area: '', code: '', subLotTarget: 'all' });
        }

        const subLotOptions = this.getSubLotOptions(this.currentParcelIdForCrop || this.currentSubLotParcelId);
        const hasSubLots = subLotOptions.length > 1;

        if (!this.cropAreaList) return;

        this.cropAreaList.innerHTML = sanitizeHTML(this.tempCropAreas.map((crop, idx) => `
            <div class="crop-area-input-row" data-index="${idx}">
                <div class="crop-select-wrapper crop-autocomplete-wrapper">
                    <input type="text" class="crop-search-input"
                           id="crop-search-${idx}"
                           name="crop-search-${idx}"
                           placeholder="작물명 검색..."
                           value="${escapeHTML(crop.name)}"
                           data-index="${idx}">
                    <ul class="crop-autocomplete-list" id="autocomplete-${idx}"></ul>
                </div>
                <div class="area-input-wrapper">
                    <input type="number" class="area-input"
                           id="area-input-${idx}"
                           name="area-input-${idx}"
                           placeholder="면적"
                           value="${escapeHTML(String(crop.area ?? ''))}"
                           data-index="${idx}">
                    <div class="area-unit-toggle area-unit-modal-toggle"
                         id="area-unit-modal-${idx}"
                         data-index="${idx}"
                         data-unit="${crop.unit || 'm2'}">
                        <button type="button" class="unit-btn ${(!crop.unit || crop.unit === 'm2') ? 'active' : ''}" data-value="m2">㎡</button>
                        <button type="button" class="unit-btn ${crop.unit === 'pyeong' ? 'active' : ''}" data-value="pyeong">평</button>
                    </div>
                </div>
                ${hasSubLots ? `
                <div class="sublot-select-wrapper">
                    <select class="sublot-select"
                            id="sublot-select-${idx}"
                            name="sublot-select-${idx}"
                            data-index="${idx}">
                        ${subLotOptions.map(opt => `
                            <option value="${opt.value}" ${crop.subLotTarget === opt.value ? 'selected' : ''}>
                                ${opt.label}
                            </option>
                        `).join('')}
                    </select>
                </div>
                ` : ''}
                <button type="button" class="btn-remove-row" data-index="${idx}">&times;</button>
            </div>
        `).join(''));

        this.bindAutocompleteEvents();
    }

    bindAutocompleteEvents() {
        if (!this.cropAreaList) return;

        const searchInputs = this.cropAreaList.querySelectorAll('.crop-search-input');

        searchInputs.forEach((input) => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                const value = e.target.value.trim().toLowerCase();
                const autocompleteList = document.getElementById(`autocomplete-${idx}`);

                this.tempCropAreas[idx].name = e.target.value;
                this.tempCropAreas[idx].code = '';

                if (value.length > 0 && typeof CROP_DATA !== 'undefined') {
                    const matches = CROP_DATA.filter(crop =>
                        crop.name.toLowerCase().includes(value)
                    ).slice(0, 10);

                    if (matches.length > 0) {
                        autocompleteList.innerHTML = '';
                        matches.forEach(crop => {
                            const li = document.createElement('li');
                            li.dataset.code = crop.code || '';
                            li.dataset.name = crop.name || '';
                            li.textContent = `${crop.name} (${crop.category})`;
                            autocompleteList.appendChild(li);
                        });
                        // 모달 내부 → overflow:hidden 회피를 위해 fixed 포지션으로 좌표 계산
                        const rect = e.target.getBoundingClientRect();
                        autocompleteList.style.position = 'fixed';
                        autocompleteList.style.top = `${rect.bottom + 2}px`;
                        autocompleteList.style.left = `${rect.left}px`;
                        autocompleteList.style.width = `${rect.width}px`;
                        autocompleteList.style.right = 'auto';
                        autocompleteList.classList.add('show');
                    } else {
                        autocompleteList.classList.remove('show');
                    }
                } else {
                    autocompleteList.classList.remove('show');
                }
            });

            input.addEventListener('blur', () => {
                setTimeout(() => {
                    const idx = parseInt(input.dataset.index, 10);
                    const autocompleteList = document.getElementById(`autocomplete-${idx}`);
                    if (autocompleteList) autocompleteList.classList.remove('show');
                }, 200);
            });
        });

        const autocompleteLists = this.cropAreaList.querySelectorAll('.crop-autocomplete-list');
        autocompleteLists.forEach(list => {
            list.addEventListener('click', (e) => {
                if (e.target.tagName === 'LI') {
                    const idx = parseInt(list.id.replace('autocomplete-', ''));
                    const name = e.target.dataset.name;
                    const code = e.target.dataset.code;
                    this.tempCropAreas[idx].name = name;
                    this.tempCropAreas[idx].code = code;
                    const input = this.cropAreaList.querySelector(`.crop-search-input[data-index="${idx}"]`);
                    input.value = name;
                    list.classList.remove('show');
                    const areaInput = this.cropAreaList.querySelector(`.area-input[data-index="${idx}"]`);
                    if (areaInput) areaInput.focus();
                }
            });
        });

        this.cropAreaList.querySelectorAll('.area-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                this.tempCropAreas[idx].area = e.target.value;
            });
        });

        this.cropAreaList.querySelectorAll('.area-unit-modal-select').forEach((select) => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                this.tempCropAreas[index].unit = e.target.value;
            });
        });

        this.cropAreaList.querySelectorAll('.sublot-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                this.tempCropAreas[idx].subLotTarget = e.target.value;
            });
        });

        this.cropAreaList.querySelectorAll('.btn-remove-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                if (this.tempCropAreas.length > 1) {
                    this.tempCropAreas.splice(idx, 1);
                    this.renderCropAreaModal();
                }
            });
        });

        this.cropAreaList.querySelectorAll('.area-unit-modal-toggle .unit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const toggle = e.target.closest('.area-unit-modal-toggle');
                const value = e.target.dataset.value;
                toggle.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                toggle.dataset.unit = value;
            });
        });
    }

    // ========================================
    // 하위 지번 작물 추가 모달
    // ========================================

    openSubLotCropModal(parcelId, subLotIndex) {
        this.currentSubLotParcelId = parcelId;
        this.currentSubLotIndex = subLotIndex;

        const parcel = this.parcels.find(p => p.id === parcelId);
        const subLot = parcel.subLots[subLotIndex];

        this.tempCropAreas = subLot.crops && subLot.crops.length > 0
            ? subLot.crops.map(c => ({ ...c }))
            : [{ name: '', area: '', code: '' }];

        this.renderCropAreaModal();
        if (this.cropAreaModal) this.cropAreaModal.classList.remove('hidden');
    }

    confirmCropArea() {
        const validCrops = this.tempCropAreas.filter(c => c.name.trim() && c.area).map((crop, idx) => {
            const unitToggle = document.getElementById(`area-unit-modal-${idx}`);
            const unit = unitToggle ? unitToggle.dataset.unit : 'm2';
            return { ...crop, unit: unit };
        });

        if (this.currentSubLotParcelId && this.currentSubLotIndex !== null) {
            const parcel = this.parcels.find(p => p.id === this.currentSubLotParcelId);
            if (parcel.subLots[this.currentSubLotIndex]) {
                if (typeof parcel.subLots[this.currentSubLotIndex] === 'string') {
                    const lotAddress = parcel.subLots[this.currentSubLotIndex];
                    parcel.subLots[this.currentSubLotIndex] = { lotAddress: lotAddress, crops: [] };
                }
                parcel.subLots[this.currentSubLotIndex].crops = validCrops;
            }
            this.updateSubLotsDisplay(this.currentSubLotParcelId);
            this.updateParcelSummary(this.currentSubLotParcelId);
            this.updateParcelsData();
            this.currentSubLotParcelId = null;
            this.currentSubLotIndex = null;
        } else {
            const parcel = this.parcels.find(p => p.id === this.currentParcelIdForCrop);
            parcel.crops = validCrops;
            this.updateCropsAreaDisplay(this.currentParcelIdForCrop);
            this.updateParcelSummary(this.currentParcelIdForCrop);
            this.updateParcelsData();
        }

        this.closeCropAreaModalFn();
    }

    // ========================================
    // 폼 제출 처리
    // ========================================

    submitForm() {
        const validParcels = this.parcels.filter(p => p.lotAddress.trim());
        if (validParcels.length === 0) {
            this.showToast('최소 1개의 필지 주소를 입력해주세요.', 'warning');
            return;
        }

        const formData = new FormData(this.form);

        // 저장 경로 3개가 공유하는 불변식 검사 (SLS-1-223).
        // _submitSingleEdit에만 두었더니 신규 등록·그룹 수정으로 위반 레코드가 계속 만들어졌다.
        if (!this._checkReceptionNamespace(validParcels, formData)) return;

        if (this.editingGroupId) return this._submitGroupEdit(validParcels, formData);
        if (this.editingLogId) return this._submitSingleEdit(validParcels, formData);
        return this._submitNewRegistration(validParcels, formData);
    }

    /**
     * 접수번호 파싱: 'F503' → {isFillNumber:true, baseNumber:503}, '503' → {false, 503}. 순수.
     * null/undefined → {isFillNumber:false, baseNumber:1} 폴백(방어적 — 현 호출처는 항상 문자열 전달).
     */
    _parseReceptionNumber(base) {
        const isFillNumber = String(base || '').startsWith('F');
        const baseNumber = isFillNumber
            ? parseInt(String(base).replace('F', ''), 10) || 1
            : parseInt(base, 10) || 1;
        return { isFillNumber, baseNumber };
    }

    /**
     * 폼에서 공통 레코드 데이터 수집 (그룹 수정·신규 등록 공유).
     * 모드별 필드(updatedAt / gongikOrder·createdAt 등)는 호출처에서 추가한다.
     */
    _collectCommonData(formData) {
        return {
            date: formData.get('date'),
            name: formData.get('name'),
            phoneNumber: formData.get('phoneNumber'),
            address: formData.get('address'),
            addressPostcode: this.addressPostcode?.value || '',
            addressRoad: this.addressRoad?.value || '',
            addressDetail: this.addressDetail?.value || '',
            subCategory: formData.get('subCategory') || '-',
            purpose: formData.get('purpose'),
            landClass1: formData.get('landClass1') || LAND_CLASS1_DEFAULT,
            receptionMethod: formData.get('receptionMethod') || '-',
            note: formData.get('note') || ''
        };
    }

    /**
     * 필지×작물 채번 → 레코드 배열 생성 (그룹 수정·신규 등록 공유).
     * oldGroupLogs가 있으면 그룹 수정(기존 ID 보존), 없으면 신규.
     * 한 필지에 작물이 2개 이상이면 기본번호·기본번호-1·-2 형태로 분할(하위필지는 분할 안 함).
     */
    _buildLogsForParcels(validParcels, opts) {
        const { baseNumber, isFillNumber, commonData, groupId, oldGroupLogs } = opts;
        const isGroupEdit = !!oldGroupLogs;
        const logs = [];
        let existingLogIdx = 0; // 그룹 수정 전용: 생성 순서대로 기존 레코드 ID를 매칭(신규에선 미사용)
        validParcels.forEach((parcel, index) => {
            const num = baseNumber + index;
            const validCrops = parcel.crops.filter(c => c.name.trim());
            const useSubNumbers = validCrops.length > 1;

            if (useSubNumbers) {
                validCrops.forEach((crop, cropIndex) => {
                    const baseNum = isFillNumber ? `F${num}` : String(num);
                    const receptionNumber = cropIndex === 0 ? baseNum : `${baseNum}-${cropIndex}`;
                    const existingLog = isGroupEdit ? oldGroupLogs[existingLogIdx++] : undefined;
                    logs.push(window.SoilLogRecord.buildSoilLogRecord(parcel, {
                        receptionNumber, commonData, groupId, index,
                        totalParcels: validParcels.length,
                        crop, cropIndex, cropSplitCount: validCrops.length,
                        isGroupEdit, existingLog
                    }));
                });
            } else {
                const receptionNumber = isFillNumber ? `F${num}` : String(num);
                const existingLog = isGroupEdit ? oldGroupLogs[existingLogIdx++] : undefined;
                logs.push(window.SoilLogRecord.buildSoilLogRecord(parcel, {
                    receptionNumber, commonData, groupId, index,
                    totalParcels: validParcels.length,
                    isGroupEdit, existingLog
                }));
            }
        });
        return logs;
    }

    /**
     * 그룹 수정 모드: 기존 그룹을 통째로 교체. 삭제될 멤버가 있으면 확인 후 진행(취소 시 원본 복원).
     */
    /**
     * 접수번호 표기와 구분의 불변식 검사 — `F` 접두 ⟺ 구분='성토' (SLS-1-223).
     *
     * 세 저장 경로(_submitNewRegistration · _submitSingleEdit · _submitGroupEdit)가
     * 공유한다. 한 곳에만 두었더니 나머지 두 경로로 위반 레코드가 계속 만들어졌다.
     *
     * **필지 전수를 본다.** 저장되는 subCategory는 필지 값이 우선하고
     * (`soil-log-record.js`의 `parcel.category || common.subCategory`),
     * 필지 카드의 구분 select는 접수번호를 다시 뽑지 않는다. 첫 필지만 보면
     * 두 번째 필지의 성토가 빠져나간다.
     *
     * **이미 위반이던 레코드의 정당한 수정은 막지 않는다.** 수정으로 위반이
     * 새로 생기거나 대상이 바뀔 때만 차단한다 — 그러지 않으면 손상 데이터를 가진
     * 사용자가 전화번호 오타조차 고칠 수 없다(정직한 출구가 없어진다).
     *
     * 자동 재부여는 하지 않는다 — 접수번호가 이미 라벨·흙토람 내보내기에 쓰였을 수
     * 있어 조용히 바꾸는 것이 더 위험하다. 무엇을 고쳐야 하는지 알린다.
     *
     * @returns {boolean} 저장을 계속해도 되는가
     */
    _checkReceptionNamespace(validParcels, formData) {
        const RN = window.ReceptionNumber;
        const editedNumber = String(formData.get('receptionNumber') || '').trim();
        if (!editedNumber) return true;   // 번호 없음은 채번 단계가 처리한다

        const base = RN.baseOf(editedNumber);
        const mainSub = formData.get('subCategory') || '-';

        // 검사 범위는 모드에 맞춘다 (SLS-1-223 리뷰).
        // 그룹 수정·신규 등록은 필지마다 레코드가 생기므로 전수를 본다.
        // 단건 수정은 레코드가 하나이고 그 subCategory는 첫 필지 값이므로
        // 전수를 보면 저장 결과보다 엄격해져 정합 레코드도 막힌다.
        const isSingleEdit = !!this.editingLogId && !this.editingGroupId;
        const allParcels = (validParcels || []).length ? validParcels : [{ category: mainSub, crops: [] }];
        const scope = isSingleEdit ? [allParcels[0]] : allParcels;

        // 위반 필지를 **전부** 모은다. 하나만 보면 나머지 필지의 신규 위반이 새어나간다.
        //
        // ⚠️ 구분의 **종류**(Set)로 모으면 안 된다 (SLS-1-223 재리뷰 2). 그룹 편집에서
        // 필지를 늘리면 위반 레코드가 1건 → 2건으로 늘어도 구분은 여전히 '성토' 하나라
        // 아래 "악화 없음" 예외를 통과해 새 위반이 저장됐다. 건수를 세야 한다.
        const offendingParcels = scope.filter(p => RN.namespaceViolation(base, (p.category || mainSub) === '성토'));
        if (offendingParcels.length === 0) return true;

        /**
         * 이 필지가 저장 시 만들 **레코드 수**. 작물이 2개 이상이면 작물마다
         * 레코드가 나뉜다 (`_buildLogsForParcels`의 `useSubNumbers` 분기).
         *
         * ⚠️ 아래 비교 대상(`wasOffendingCount`)은 대장의 **레코드** 수다. 필지 수를
         * 그대로 쓰면 단위가 어긋나, 작물 2개짜리 위반 필지가 1개 → 2개로 늘 때
         * (레코드 2건 → 4건) `2 <= 2`가 되어 통과한다 (SLS-1-223 재리뷰 2-2).
         */
        const recordsOf = (p) => Math.max(1, ((p && p.crops) || []).filter(c => (c.name || '').trim()).length);
        // 단건 수정은 작물이 몇 개든 레코드가 하나다 (`_submitSingleEdit`는 분할하지 않는다)
        const offendingRecordCount = isSingleEdit
            ? offendingParcels.length
            : offendingParcels.reduce((n, p) => n + recordsOf(p), 0);

        // 수정 중이라면, 이번 수정이 위반을 **새로 만들거나 늘렸을 때만** 막는다.
        // 원래도 위반이던 레코드의 정당한 수정(전화번호 오타 등)을 막으면
        // 손상 데이터를 가진 사용자에게 정직한 출구가 없어진다.
        if (this.editingLogId || this.editingGroupId) {
            const beforeLogs = this.editingGroupId
                ? (this.editingGroupLogs || this.sampleLogs.filter(l => l.groupId === this.editingGroupId))
                : this.sampleLogs.filter(l => l.id === this.editingLogId);
            // 같은 네임스페이스(F 여부)에서 이미 위반이던 레코드 **수**.
            // 그룹은 멤버 번호가 base, base+1… 로 갈리므로 본번 일치가 아니라 F 여부로 본다.
            const wasOffendingCount = beforeLogs.filter((l) => {
                const b = RN.baseOf(l.receptionNumber || '');
                return RN.isFillNotation(b) === RN.isFillNotation(base)
                    && RN.namespaceViolation(b, l.subCategory === '성토');
            }).length;
            if (offendingRecordCount <= wasOffendingCount) return true;   // 악화 없음
        }

        const offending = offendingParcels[0].category || mainSub;
        const violation = RN.namespaceViolation(base, offending === '성토');
        const guide = offending === '성토'
            ? `성토 시료는 접수번호가 F로 시작해야 합니다 (현재: ${editedNumber}).`
            : `F로 시작하는 접수번호는 성토 시료에만 씁니다 (현재: ${editedNumber}, 구분: ${offending}).`;
        this.showToast(`${violation}. ${guide} 구분과 접수번호를 함께 맞춰 주세요.`, 'error');
        return false;
    }

    _submitGroupEdit(validParcels, formData) {
        const baseReceptionNumber = formData.get('receptionNumber');
        const { isFillNumber, baseNumber } = this._parseReceptionNumber(baseReceptionNumber);

        const commonData = { ...this._collectCommonData(formData), updatedAt: new Date().toISOString() };

        const oldGroupLogs = this.editingGroupLogs;
        const groupId = this.editingGroupId;

        // 기존 그룹 레코드 모두 제거
        this.sampleLogs = this.sampleLogs.filter(l => l.groupId !== groupId);

        // 새 레코드 생성 (필지 수 × 작물 수에 맞춰, 기존 ID 보존)
        const newLogs = this._buildLogsForParcels(validParcels, { baseNumber, isFillNumber, commonData, groupId, oldGroupLogs });

        newLogs.forEach(log => {
            delete log.addressVerified; // 주소 편집 시 검증 초기화
            this.sampleLogs.push(log);
        });
        this.saveLogs(); // localStorage 먼저 (ID 할당 보장)

        // Firebase: 삭제된 레코드 제거 + 새 레코드 저장
        const newIds = new Set(newLogs.map(l => l.id));
        const removedIds = oldGroupLogs.filter(l => !newIds.has(l.id)).map(l => l.id);

        // SLS-1-123 (SAMPL-1-82 백포트): 빈 필지주소/빈 작물명이 필터되면 해당 멤버가
        // removedIds에 포함돼 조용히 삭제된다. 삭제 전 사용자에게 확인 — 취소 시 원본 복원.
        if (removedIds.length > 0 &&
            !confirm(`기존 ${oldGroupLogs.length}건 중 ${removedIds.length}건이 삭제됩니다. (빈 필지 주소 또는 빈 작물명이 있으면 해당 항목이 제외됩니다.) 계속하시겠습니까?`)) {
            this.sampleLogs = this.sampleLogs.filter(l => l.groupId !== groupId); // 방금 추가한 새 레코드 제거
            this.sampleLogs.push(...oldGroupLogs);                                // 원본 그룹 복원
            this.saveLogs(); // 위에서 이미 새 상태가 저장됐으므로 localStorage도 원본으로 되돌림
            this.cancelEditMode();
            this.filterAndRenderLogs();
            this.switchView('list');
            return;
        }

        if (removedIds.length > 0) this.firebaseDeleteRecords(removedIds);
        this.firebaseSaveRecords(newLogs);
        this.cancelEditMode();
        this.filterAndRenderLogs();
        this.validateAndMarkLogs(newLogs).catch(err => // 그룹 수정 후 재검증 (백그라운드)
            (window.logger?.error || console.error)('VWORLD 재검증 오류:', err)
        );
        this.showToast(`${newLogs.length}건의 시료가 수정되었습니다.`, 'success');
        this.switchView('list');
    }

    /**
     * 단일 수정 모드: 한 레코드를 폼 값으로 갱신.
     */
    _submitSingleEdit(validParcels, formData) {
        const logIndex = this.sampleLogs.findIndex(l => l.id === this.editingLogId);
        if (logIndex === -1) {
            this.showToast('수정할 데이터를 찾을 수 없습니다.', 'error');
            this.cancelEditMode();
            this.switchView('list');
            return;
        }

        const existingLog = this.sampleLogs[logIndex];
        const firstParcelCategory = validParcels[0]?.category;
        const firstParcelPurpose = validParcels[0]?.purpose;
        const mainSubCategory = formData.get('subCategory') || '-';
        const effectiveSubCategory = firstParcelCategory || mainSubCategory;
        const effectivePurpose = firstParcelPurpose || formData.get('purpose');

        const updatedLog = {
            ...existingLog,
            receptionNumber: formData.get('receptionNumber'),
            date: formData.get('date'),
            name: formData.get('name'),
            phoneNumber: formData.get('phoneNumber'),
            address: formData.get('address'),
            addressPostcode: this.addressPostcode?.value || '',
            addressRoad: this.addressRoad?.value || '',
            addressDetail: this.addressDetail?.value || '',
            subCategory: effectiveSubCategory,
            purpose: effectivePurpose,
            landClass1: formData.get('landClass1') || existingLog.landClass1 || LAND_CLASS1_DEFAULT,
            receptionMethod: formData.get('receptionMethod') || '-',
            note: formData.get('note') || '',
            parcels: validParcels.map(p => ({
                id: p.id || crypto.randomUUID(),
                lotAddress: p.lotAddress,
                isMountain: p.isMountain || false,
                subLots: [...p.subLots],
                crops: p.crops.map(c => ({ ...c })),
                category: p.category || '',
                purpose: p.purpose || '',
                note: p.note || ''
            })),
            updatedAt: new Date().toISOString()
        };

        if (validParcels.length > 0) {
            const firstParcel = validParcels[0];
            updatedLog.lotAddress = firstParcel.lotAddress;
            updatedLog.area = firstParcel.crops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0).toString();
            updatedLog.cropsDisplay = firstParcel.crops.map(c => c.name).join(', ') || '-';
        }

        delete updatedLog.addressVerified; // 주소 편집 시 검증 초기화
        this.sampleLogs[logIndex] = updatedLog;
        this.persistRecords(updatedLog);
        this.cancelEditMode();
        this.filterAndRenderLogs();
        this.validateAndMarkLogs([updatedLog]).catch(err => // 편집 후 재검증 (백그라운드)
            (window.logger?.error || console.error)('VWORLD 재검증 오류:', err)
        );
        this.showToast('수정이 완료되었습니다.', 'success');
        this.switchView('list');
    }

    /**
     * 신규 등록 모드: 중복 접수번호 검사 후 새 그룹 생성, 폼 초기화, 결과 모달 표시.
     */
    _submitNewRegistration(validParcels, formData) {
        const baseReceptionNumber = formData.get('receptionNumber');
        const { isFillNumber, baseNumber } = this._parseReceptionNumber(baseReceptionNumber);

        const numbersToCheck = validParcels.map((_, index) => {
            const num = baseNumber + index;
            return isFillNumber ? `F${num}` : String(num);
        });

        const yearStorageKey = this.getStorageKey(this.selectedYear);
        const latestLogs = SampleUtils.safeParseJSON(yearStorageKey, []);
        const currentLandClass1 = this.getCurrentLandClass1();

        const duplicateNumbers = numbersToCheck.filter(numToCheck => {
            return latestLogs.some(log => {
                if ((log.landClass1 || LAND_CLASS1_DEFAULT) !== currentLandClass1) return false;
                const logBaseNumber = (log.receptionNumber || '').split('-')[0];
                return logBaseNumber === numToCheck;
            });
        });

        if (duplicateNumbers.length > 0) {
            this.sampleLogs = latestLogs;
            this.filterAndRenderLogs();
            const nextAvailable = isFillNumber
                ? this.generateNextFillReceptionNumber()
                : this.generateNextReceptionNumber();
            this.receptionNumberInput.value = nextAvailable;
            this.showToast(`접수번호 ${duplicateNumbers.join(', ')}이(가) 이미 존재합니다. ${nextAvailable}번으로 변경되었습니다.`, 'warning');
            return;
        }

        const commonData = {
            ...this._collectCommonData(formData),
            gongikOrder: '1',
            gongikBaseYear: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const groupId = crypto.randomUUID();

        const newLogs = this._buildLogsForParcels(validParcels, { baseNumber, isFillNumber, commonData, groupId });

        newLogs.forEach(log => this.sampleLogs.push(log));
        this.persistRecords(newLogs);
        this.filterAndRenderLogs();
        this._resetFormPreservingSelects();
        if (this.dateInput) this.dateInput.valueAsDate = new Date();

        // 주소 필드 초기화
        if (this.addressPostcode) this.addressPostcode.value = '';
        if (this.addressRoad) this.addressRoad.value = '';
        if (this.addressDetail) this.addressDetail.value = '';
        if (this.addressHidden) this.addressHidden.value = '';

        // 필지 초기화
        this.parcels = [];
        this.parcelIdCounter = 0;
        if (this.parcelsContainer) this.parcelsContainer.innerHTML = '';
        this.addParcel();

        this.receptionNumberInput.value = this.generateNextReceptionNumber();

        const parcelCount = newLogs.length;
        this.showToast(`${parcelCount}건의 시료가 접수되었습니다.`, 'success');

        // 등록 결과 모달 표시 (검증 중 상태)
        const resultData = {
            ...newLogs[newLogs.length - 1],
            parcels: validParcels.map(p => ({
                lotAddress: p.lotAddress,
                isMountain: p.isMountain || false,
                subLots: [...p.subLots],
                crops: p.crops.map(c => ({ ...c }))
            })),
            totalRegistered: parcelCount,
            _newLogIds: newLogs.map(l => l.id)
        };
        this.showRegistrationResult(resultData);
        this.switchView('list');

        // 주소 검증 실행 → 모달에 결과 반영
        this.runVerificationForModal(newLogs);
    }

    // ========================================
    // 수정 모드 관리
    // ========================================

    editSample(id) {
        const logItem = this.sampleLogs.find(l => String(l.id) === id);
        if (!logItem) return;

        // groupId가 있고 같은 그룹에 2개 이상의 레코드가 있으면 그룹 수정
        if (logItem.groupId) {
            const groupLogs = this.sampleLogs
                .filter(l => l.groupId === logItem.groupId)
                .sort((a, b) => (a.parcelIndex || 0) - (b.parcelIndex || 0));
            if (groupLogs.length > 1) {
                this.populateFormForGroupEdit(groupLogs);
                return;
            }
        }
        // 단독 레코드는 기존 방식
        this.populateFormForEdit(logItem);
    }

    cancelEditMode() {
        this.editingLogId = null;
        this.editingGroupId = null;
        this.editingGroupLogs = null;

        if (this.navSubmitBtn) {
            this.navSubmitBtn.title = '접수 등록';
            this.navSubmitBtn.classList.remove('btn-edit-mode');
        }

        this._resetFormPreservingSelects();
        const subCatSelect = document.getElementById('subCategory');
        if (subCatSelect) {
            subCatSelect.disabled = false;
            subCatSelect.innerHTML = sanitizeHTML(`
                <option value="">선택하세요</option>
                <option value="논">🌾 논</option>
                <option value="밭">🥬 밭</option>
                <option value="과수">🍎 과수</option>
                <option value="시설">🏠 시설</option>
                <option value="임야">🌲 임야</option>
                <option value="성토">🚜 성토</option>
            `);
            subCatSelect.value = '';
        }
        if (this.dateInput) this.dateInput.valueAsDate = new Date();

        if (this.addressPostcode) this.addressPostcode.value = '';
        if (this.addressRoad) this.addressRoad.value = '';
        if (this.addressDetail) this.addressDetail.value = '';
        if (this.addressHidden) this.addressHidden.value = '';

        this.parcels = [];
        this.parcelIdCounter = 0;
        if (this.parcelsContainer) this.parcelsContainer.innerHTML = '';
        this.addParcel();

        this.receptionNumberInput.value = this.generateNextReceptionNumber();
    }

    resetForm() {
        this.cancelEditMode();
    }

    populateFormForEdit(log) {
        this.editingLogId = log.id;

        this.receptionNumberInput.value = log.receptionNumber || '';
        if (this.dateInput) this.dateInput.value = log.date || '';
        document.getElementById('name').value = log.name || '';
        document.getElementById('phoneNumber').value = log.phoneNumber || '';

        // 주소 필드 처리: 개별 저장 필드 우선 사용
        if (this.addressPostcode) this.addressPostcode.value = log.addressPostcode || '';
        if (this.addressRoad) this.addressRoad.value = log.addressRoad || '';
        if (this.addressDetail) this.addressDetail.value = log.addressDetail || '';
        if (this.addressHidden) this.addressHidden.value = log.address || '';

        // addressRoad가 없으면 address에서 파싱 (레거시 데이터 호환)
        if (!log.addressRoad && log.address) {
            const addressMatch = log.address.match(/^\((\d{5})\)\s*(.+)$/);
            if (addressMatch) {
                if (this.addressPostcode) this.addressPostcode.value = this.addressPostcode.value || addressMatch[1];
                if (this.addressRoad) this.addressRoad.value = addressMatch[2];
            } else {
                if (this.addressRoad) this.addressRoad.value = log.address;
            }
        }

        const subCategorySelect = document.getElementById('subCategory');
        if (subCategorySelect) {
            subCategorySelect.disabled = false;
            subCategorySelect.innerHTML = sanitizeHTML(`
                <option value="">선택하세요</option>
                <option value="논">🌾 논</option>
                <option value="밭">🥬 밭</option>
                <option value="과수">🍎 과수</option>
                <option value="시설">🏠 시설</option>
                <option value="임야">🌲 임야</option>
                <option value="성토">🚜 성토</option>
            `);
            subCategorySelect.value = log.subCategory || '';
        }

        if (this.purposeSelect) {
            this.purposeSelect.value = log.purpose || '';
        }

        if (this.landClass1Select) {
            this.landClass1Select.value = log.landClass1 || LAND_CLASS1_DEFAULT;
        }

        const receptionMethodBtns = document.querySelectorAll('.reception-method-btn');
        receptionMethodBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.method === log.receptionMethod) {
                btn.classList.add('active');
            }
        });
        if (this.receptionMethodInput) {
            this.receptionMethodInput.value = log.receptionMethod || '';
        }

        const noteInput = document.getElementById('note');
        if (noteInput) noteInput.value = log.note || '';

        this.parcels = [];
        this.parcelIdCounter = 0;
        if (this.parcelsContainer) this.parcelsContainer.innerHTML = '';

        if (log.parcels && log.parcels.length > 0) {
            const R = window.SoilLogRecord || {};
            // crops/lotAddress 폴백은 단일 필지 로그에서만 — 최상위 cropsDisplay/area/lotAddress는
            // 레코드 단위 권위필드라 다필지 레코드에선 어느 필지 것인지 모호(방어적 게이트)
            const singleParcel = log.parcels.length === 1;
            log.parcels.forEach(parcel => {
                const parcelId = `parcel-${this.parcelIdCounter++}`;
                let crops = parcel.crops ? parcel.crops.map(c => ({ ...c })) : [];
                if (crops.length === 0 && singleParcel && R.cropsFromDisplay) {
                    crops = R.cropsFromDisplay(log);
                }
                const newParcel = {
                    id: parcelId,
                    lotAddress: parcel.lotAddress || (singleParcel ? (log.lotAddress || '') : ''),
                    isMountain: parcel.isMountain || false,
                    subLots: parcel.subLots ? [...parcel.subLots] : [],
                    crops,
                    category: R.resolveParcelCategory ? R.resolveParcelCategory(parcel.category, log) : (parcel.category || ''),
                    purpose: R.resolveParcelPurpose ? R.resolveParcelPurpose(parcel.purpose, log) : (parcel.purpose || ''),
                    note: parcel.note || ''
                };
                this.parcels.push(newParcel);
                this.renderParcelCard(newParcel, this.parcels.length);
            });
        } else {
            this.addParcel();
            if (log.lotAddress) {
                this.parcels[0].lotAddress = log.lotAddress;
                const lotInput = document.querySelector(`.lot-address-input[data-id="${this.parcels[0].id}"]`);
                if (lotInput) lotInput.value = log.lotAddress;
            }
        }

        this.updateParcelsData();

        if (this.navSubmitBtn) {
            this.navSubmitBtn.title = '수정 완료';
            this.navSubmitBtn.classList.add('btn-edit-mode');
        }

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('formView').classList.add('active');
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.nav-btn[data-view="form"]').classList.add('active');

        setTimeout(() => {
            this.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    populateFormForGroupEdit(groupLogs) {
        const firstLog = groupLogs[0];

        // 그룹 수정 모드 플래그
        this.editingLogId = null;
        this.editingGroupId = firstLog.groupId;
        this.editingGroupLogs = groupLogs;

        this._populateGroupEditHeaderFields(firstLog);
        this._populateGroupEditParcelCards(groupLogs);

        this.updateParcelsData();

        // 버튼 상태 변경
        if (this.navSubmitBtn) {
            this.navSubmitBtn.title = '수정 완료';
            this.navSubmitBtn.classList.add('btn-edit-mode');
        }

        // 폼 뷰로 전환
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('formView').classList.add('active');
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.nav-btn[data-view="form"]').classList.add('active');

        setTimeout(() => {
            this.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    /**
     * 그룹 수정 시 상단 헤더 필드(접수번호·날짜·이름·주소·구분·용도 등)를 채운다.
     * @param {Object} firstLog 그룹 대표 레코드 (groupLogs[0])
     */
    _populateGroupEditHeaderFields(firstLog) {
        // 접수번호 (기본번호만, 서브넘버 -1,-2 제외)
        const baseRecNum = (firstLog.receptionNumber || '').split('-')[0];
        this.receptionNumberInput.value = baseRecNum;
        if (this.dateInput) this.dateInput.value = firstLog.date || '';
        document.getElementById('name').value = firstLog.name || '';
        document.getElementById('phoneNumber').value = firstLog.phoneNumber || '';

        // 주소 필드 처리: 개별 저장 필드 우선 사용
        if (this.addressPostcode) this.addressPostcode.value = firstLog.addressPostcode || '';
        if (this.addressRoad) this.addressRoad.value = firstLog.addressRoad || '';
        if (this.addressDetail) this.addressDetail.value = firstLog.addressDetail || '';
        if (this.addressHidden) this.addressHidden.value = firstLog.address || '';

        if (!firstLog.addressRoad && firstLog.address) {
            const addressMatch = firstLog.address.match(/^\((\d{5})\)\s*(.+)$/);
            if (addressMatch) {
                if (this.addressPostcode) this.addressPostcode.value = this.addressPostcode.value || addressMatch[1];
                if (this.addressRoad) this.addressRoad.value = addressMatch[2];
            } else {
                if (this.addressRoad) this.addressRoad.value = firstLog.address;
            }
        }

        const subCategorySelect = document.getElementById('subCategory');
        if (subCategorySelect) {
            subCategorySelect.disabled = false;
            subCategorySelect.innerHTML = sanitizeHTML(`
                <option value="">선택하세요</option>
                <option value="논">🌾 논</option>
                <option value="밭">🥬 밭</option>
                <option value="과수">🍎 과수</option>
                <option value="시설">🏠 시설</option>
                <option value="임야">🌲 임야</option>
                <option value="성토">🚜 성토</option>
            `);
            subCategorySelect.value = firstLog.subCategory || '';
        }

        if (this.purposeSelect) this.purposeSelect.value = firstLog.purpose || '';

        if (this.landClass1Select) this.landClass1Select.value = firstLog.landClass1 || LAND_CLASS1_DEFAULT;

        const receptionMethodBtns = document.querySelectorAll('.reception-method-btn');
        receptionMethodBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.method === firstLog.receptionMethod) btn.classList.add('active');
        });
        if (this.receptionMethodInput) this.receptionMethodInput.value = firstLog.receptionMethod || '';

        const noteInput = document.getElementById('note');
        if (noteInput) noteInput.value = firstLog.note || '';
    }

    /**
     * 그룹 수정 시 parcelIndex 기준으로 필지 카드를 합성·렌더링한다 (SLS-1-164).
     * @param {Object[]} groupLogs 그룹 내 모든 레코드
     */
    _populateGroupEditParcelCards(groupLogs) {
        // 필지 카드 렌더링 - 같은 parcelIndex의 서브넘버 레코드는 하나의 필지로 합침
        this.parcels = [];
        this.parcelIdCounter = 0;
        if (this.parcelsContainer) this.parcelsContainer.innerHTML = '';

        // parcelIndex 기준으로 그룹화 (서브넘버 = 같은 필지의 다른 작물)
        const parcelMap = new Map();
        groupLogs.forEach(log => {
            const pIdx = log.parcelIndex || 1;
            if (!parcelMap.has(pIdx)) {
                parcelMap.set(pIdx, []);
            }
            parcelMap.get(pIdx).push(log);
        });

        // parcelIndex 순서대로 필지 카드 생성
        const sortedParcelIndices = [...parcelMap.keys()].sort((a, b) => a - b);
        const R = window.SoilLogRecord || {};
        sortedParcelIndices.forEach(pIdx => {
            const logsForParcel = parcelMap.get(pIdx);
            // 해당 필지 대표 레코드 — 폴백 권위필드 소스(외부 firstLog=groupLogs[0]와 구분)
            const parcelRepLog = logsForParcel[0];
            // SLS-1-164: parcels[0]이 빈 stub여도 카드를 누락하지 않도록 빈 객체로 합성
            const parcel = parcelRepLog.parcels?.[0] || {};

            // 같은 필지의 여러 작물을 합침 — 멤버 로그의 parcels[0].crops가 비면
            // 최상위 cropsDisplay/area로 보강(방어적, 멤버 로그마다 호출 → 분할 모드 정확)
            const mergedCrops = [];
            logsForParcel.forEach(log => {
                const logParcel = log.parcels?.[0];
                let crops = (logParcel && logParcel.crops) ? logParcel.crops : [];
                if (crops.length === 0 && R.cropsFromDisplay) {
                    crops = R.cropsFromDisplay(log);
                }
                crops.forEach(c => mergedCrops.push({ ...c }));
            });

            const parcelId = `parcel-${this.parcelIdCounter++}`;
            const newParcel = {
                id: parcelId,
                lotAddress: parcel.lotAddress || parcelRepLog.lotAddress || '',
                isMountain: parcel.isMountain || false,
                subLots: parcel.subLots ? [...parcel.subLots] : [],
                crops: mergedCrops.length > 0 ? mergedCrops : [{ name: '', area: '' }],
                category: R.resolveParcelCategory ? R.resolveParcelCategory(parcel.category, parcelRepLog) : (parcel.category || ''),
                purpose: R.resolveParcelPurpose ? R.resolveParcelPurpose(parcel.purpose, parcelRepLog) : (parcel.purpose || ''),
                note: parcel.note || ''
            };
            this.parcels.push(newParcel);
            this.renderParcelCard(newParcel, this.parcels.length);
        });

        // 필지가 하나도 없으면 빈 카드 추가
        if (this.parcels.length === 0) this.addParcel();
    }

    // ========================================
    // 검색/필터
    // ========================================

    filterAndRenderLogs() {
        const filteredLogs = this.sampleLogs.filter(log => {
            const matchesName = !this.currentSearchFilter.name ||
                log.name.toLowerCase().includes(this.currentSearchFilter.name);

            let matchesReception = true;
            if (this.currentSearchFilter.receptionFrom || this.currentSearchFilter.receptionTo) {
                const logNum = this.extractReceptionNumber(log.receptionNumber);
                const fromNum = this.currentSearchFilter.receptionFrom ? parseInt(this.currentSearchFilter.receptionFrom, 10) : 0;
                const toNum = this.currentSearchFilter.receptionTo ? parseInt(this.currentSearchFilter.receptionTo, 10) : Infinity;
                if (fromNum && logNum < fromNum) matchesReception = false;
                if (toNum !== Infinity && logNum > toNum) matchesReception = false;
            }

            let matchesDate = true;
            if (this.currentSearchFilter.dateFrom || this.currentSearchFilter.dateTo) {
                const logDate = log.date;
                if (this.currentSearchFilter.dateFrom && logDate < this.currentSearchFilter.dateFrom) matchesDate = false;
                if (this.currentSearchFilter.dateTo && logDate > this.currentSearchFilter.dateTo) matchesDate = false;
            }

            let matchesLot = true;
            if (this.currentSearchFilter.lot) {
                matchesLot = false;
                const searchQuery = this.currentSearchFilter.lot.trim().toLowerCase();
                const searchTerms = searchQuery.split(/\s+/).filter(t => t);

                const getSubLotAddress = (subLot) => {
                    if (typeof subLot === 'string') return subLot.toLowerCase();
                    if (subLot && typeof subLot === 'object' && subLot.lotAddress) return subLot.lotAddress.toLowerCase();
                    return '';
                };

                if (log.parcels && log.parcels.length > 0) {
                    matchesLot = log.parcels.some(parcel => {
                        const lotAddrLower = parcel.lotAddress ? parcel.lotAddress.toLowerCase() : '';
                        if (lotAddrLower.includes(searchQuery)) return true;
                        if (searchTerms.every(term => lotAddrLower.includes(term))) return true;
                        if (searchTerms.length === 1) {
                            const term = searchTerms[0];
                            if (parcel.subLots && parcel.subLots.length > 0) {
                                if (parcel.subLots.some(subLot => {
                                    const addr = getSubLotAddress(subLot);
                                    return addr && addr.includes(term);
                                })) return true;
                            }
                        }
                        if (searchTerms.length >= 2) {
                            const riTerm = searchTerms[0];
                            const lotTerms = searchTerms.slice(1);
                            const matchesRi = lotAddrLower.includes(riTerm);
                            if (matchesRi && parcel.subLots && parcel.subLots.length > 0) {
                                const matchesSubLots = lotTerms.every(lotTerm =>
                                    parcel.subLots.some(subLot => {
                                        const addr = getSubLotAddress(subLot);
                                        return addr && addr.includes(lotTerm);
                                    })
                                );
                                if (matchesSubLots) return true;
                            }
                        }
                        return false;
                    });
                }
            }

            const matchesPurpose = !this.currentSearchFilter.purpose ||
                (log.purpose || '') === this.currentSearchFilter.purpose;

            const matchesLandClass1 = !this.currentSearchFilter.landClass1 ||
                (log.landClass1 || LAND_CLASS1_DEFAULT) === this.currentSearchFilter.landClass1;

            let matchesCompleted = true;
            if (this.currentSearchFilter.completed === 'completed') {
                matchesCompleted = log.isComplete === true;
            } else if (this.currentSearchFilter.completed === 'incomplete') {
                matchesCompleted = !log.isComplete;
            }

            return matchesName && matchesReception && matchesDate && matchesLot && matchesPurpose && matchesLandClass1 && matchesCompleted;
        });

        this.renderLogs(filteredLogs);
        this.updateSearchButtonState();
        // SLS-1-264: 열 구성(공익직불제 탭 등)이 바뀌면 고정 좌표도 달라진다
        window.scheduleStickyColumns?.(this.logTable);
    }

    /**
     * 현재 경지구분 1차 탭으로 필터링된 레코드 반환.
     * 탭이 '전체'(빈 값)면 전체 sampleLogs 반환.
     * 통계·엑셀 내보내기가 현재 탭 데이터 기준으로 동작하도록 사용.
     * @returns {Array}
     */
    getTabFilteredLogs() {
        const tab = this.currentSearchFilter.landClass1;
        if (!tab) return this.sampleLogs;
        return this.sampleLogs.filter(log => (log.landClass1 || LAND_CLASS1_DEFAULT) === tab);
    }

    /**
     * 검색 버튼 배지 판정에 쓰는 필터 키 (SLS-1-197 A-3)
     *
     * ⚠️ `landClass1`은 **일부러 넣지 않는다.** 기본값이 '농가의뢰'라 항상 참이 되어
     *    검색 버튼이 늘 "검색 중"으로 보인다. 그것은 필터가 아니라 탭이다.
     */
    getFilterKeys() {
        return [...super.getFilterKeys(), 'lot', 'purpose'];
    }

    /**
     * 검색 버튼 배지는 base가 처리하고, soil 고유 배지 2개만 여기서 더한다 (SLS-1-197 A-3).
     * 예전에는 base와 같은 본문을 통째로 복사해 두고 배지 처리만 덧붙였다.
     */
    updateSearchButtonState() {
        super.updateSearchButtonState();
        const badge = (id, on) => document.getElementById(id)?.classList.toggle('has-filter', !!on);
        badge('purposeFilter', this.currentSearchFilter.purpose);
        badge('landClass1Tab', this.currentSearchFilter.landClass1);
    }

    // ========================================
    // 통계 기능
    // ========================================

    calculateStatistics() {
        const logs = this.getTabFilteredLogs();
        const total = logs.length;
        const completed = logs.filter(log => log.isComplete).length;
        const pending = total - completed;

        const bySubCategory = {};
        const categoryMapping = {
            '논': { label: '🌾 논', class: 'category-rice' },
            '밭': { label: '🥬 밭', class: 'category-field' },
            '과수': { label: '🍎 과수', class: 'category-fruit' },
            '시설': { label: '🏠 시설', class: 'category-facility' },
            '임야': { label: '🌲 임야', class: 'category-forest' },
            '성토': { label: '🏗️ 성토', class: 'category-fill' },
            '기타': { label: '📦 기타', class: 'category-other' }
        };

        logs.forEach(log => {
            const category = log.subCategory || '기타';
            if (!bySubCategory[category]) {
                bySubCategory[category] = { count: 0, ...categoryMapping[category] || categoryMapping['기타'] };
            }
            bySubCategory[category].count++;
        });

        const purposeMapping = {
            '일반재배': { label: '🌾 일반재배', class: 'purpose-general' },
            '유기': { label: '♻️ 유기', class: 'purpose-organic' },
            '무농약': { label: '🍃 무농약', class: 'purpose-nopesticide' },
            'GAP': { label: '✅ GAP', class: 'purpose-gap' },
            '저탄소': { label: '🌱 저탄소', class: 'purpose-lowcarbon' }
        };
        const byPurpose = {};
        Object.entries(purposeMapping).forEach(([key, val]) => {
            byPurpose[key] = { count: 0, ...val };
        });

        logs.forEach(log => {
            const purpose = log.purpose || '기타';
            if (!byPurpose[purpose]) {
                byPurpose[purpose] = { count: 0, ...purposeMapping[purpose] || { label: purpose, class: 'purpose-general' } };
            }
            byPurpose[purpose].count++;
        });

        const byMonth = {};
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        for (let i = 1; i <= 12; i++) {
            const monthKey = String(i).padStart(2, '0');
            byMonth[monthKey] = { count: 0, completed: 0, pending: 0, label: monthNames[i - 1], class: 'month' };
        }
        logs.forEach(log => {
            if (log.date) {
                const monthNum = log.date.substring(5, 7);
                if (byMonth[monthNum]) {
                    byMonth[monthNum].count++;
                    if (log.isComplete) { byMonth[monthNum].completed++; } else { byMonth[monthNum].pending++; }
                }
            }
        });

        const byQuarter = {
            Q1: { count: 0, completed: 0, pending: 0, label: '1분기 (1~3월)' },
            Q2: { count: 0, completed: 0, pending: 0, label: '2분기 (4~6월)' },
            Q3: { count: 0, completed: 0, pending: 0, label: '3분기 (7~9월)' },
            Q4: { count: 0, completed: 0, pending: 0, label: '4분기 (10~12월)' }
        };
        Object.entries(byMonth).forEach(([monthKey, data]) => {
            const monthNum = parseInt(monthKey, 10);
            let quarter;
            if (monthNum <= 3) quarter = 'Q1';
            else if (monthNum <= 6) quarter = 'Q2';
            else if (monthNum <= 9) quarter = 'Q3';
            else quarter = 'Q4';
            byQuarter[quarter].count += data.count;
            byQuarter[quarter].completed += data.completed;
            byQuarter[quarter].pending += data.pending;
        });

        const byReceptionMethod = {};
        const methodMapping = {
            '우편': { label: '📮 우편', class: 'method-mail' },
            '이메일': { label: '📧 이메일', class: 'method-email' },
            '팩스': { label: '📠 팩스', class: 'method-fax' },
            '직접방문': { label: '🚶 직접방문', class: 'method-visit' }
        };
        this.sampleLogs.forEach(log => {
            const method = log.receptionMethod || '기타';
            if (!byReceptionMethod[method]) {
                byReceptionMethod[method] = { count: 0, ...methodMapping[method] || { label: method, class: 'method-mail' } };
            }
            byReceptionMethod[method].count++;
        });

        const byLandClass = {};
        // 경지구분 간 비교가 목적이므로 탭 필터와 무관하게 전체 시료 기준 집계 (수령 방법별과 동일)
        this.sampleLogs.forEach(log => {
            const landClass = log.landClass1 || LAND_CLASS1_DEFAULT;
            if (!byLandClass[landClass]) {
                byLandClass[landClass] = { count: 0, ...LAND_CLASS1_STATS_MAPPING[landClass] || { label: landClass, class: 'category-other' } };
            }
            byLandClass[landClass].count++;
        });

        return { total, completed, pending, bySubCategory, byPurpose, byMonth, byQuarter, byReceptionMethod, byLandClass };
    }

    openStatisticsModal() {
        if (!this.statisticsModal) return;
        const stats = this.calculateStatistics();
        document.getElementById('statTotalCount').textContent = stats.total.toLocaleString();
        document.getElementById('statCompletedCount').textContent = stats.completed.toLocaleString();
        document.getElementById('statPendingCount').textContent = stats.pending.toLocaleString();
        const completedRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0;
        const pendingRate = stats.total > 0 ? ((stats.pending / stats.total) * 100).toFixed(1) : 0;
        const totalBadge = document.getElementById('statTotalBadge');
        const completedRateEl = document.getElementById('statCompletedRate');
        const pendingRateEl = document.getElementById('statPendingRate');
        if (totalBadge) totalBadge.textContent = `${stats.total}건`;
        if (completedRateEl) completedRateEl.textContent = `${completedRate}%`;
        if (pendingRateEl) pendingRateEl.textContent = `${pendingRate}%`;
        this.renderVerticalBarChart('statsByCategory', stats.bySubCategory);
        this.renderHorizontalBarChart('statsByPurpose', stats.byPurpose);
        this.renderMonthlyChart('statsByMonth', stats.byMonth);
        this.renderQuarterlySummary('statsQuarterly', stats.byQuarter);
        this.renderMethodCards('statsByReceptionMethod', stats.byReceptionMethod);
        this.renderHorizontalBarChart('statsByLandClass', stats.byLandClass);
        const monthRange = document.getElementById('statsMonthRange');
        if (monthRange) monthRange.textContent = `${new Date().getFullYear()}년 1월 ~ 12월`;
        this.statisticsModal.classList.remove('hidden');
    }

    renderVerticalBarChart(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const entries = Object.entries(data).sort((a, b) => b[1].count - a[1].count);
        if (entries.length === 0) {
            container.innerHTML = sanitizeHTML('<div class="stats-empty">데이터가 없습니다</div>');
            return;
        }
        const maxCount = Math.max(...entries.map(([, v]) => v.count));
        container.innerHTML = '';
        const barsDiv = document.createElement('div');
        barsDiv.className = 'vertical-bars';
        entries.forEach(([key, value]) => {
            const heightPercent = maxCount > 0 ? (value.count / maxCount) * 100 : 0;
            const group = document.createElement('div');
            group.className = 'vertical-bar-group';
            const barContainer = document.createElement('div');
            barContainer.className = 'vertical-bar-container';
            const bar = document.createElement('div');
            bar.className = `vertical-bar ${value.class}`;
            bar.style.height = `${heightPercent}%`;
            barContainer.appendChild(bar);
            const label = document.createElement('span');
            label.className = 'vertical-bar-label';
            label.textContent = value.label;
            group.appendChild(barContainer);
            group.appendChild(label);
            barsDiv.appendChild(group);
        });
        container.appendChild(barsDiv);
    }

    renderHorizontalBarChart(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const entries = Object.entries(data).sort((a, b) => b[1].count - a[1].count);
        if (entries.length === 0) {
            container.innerHTML = sanitizeHTML('<div class="stats-empty">데이터가 없습니다</div>');
            return;
        }
        const maxCount = Math.max(...entries.map(([, v]) => v.count));
        container.innerHTML = '';
        entries.forEach(([key, value]) => {
            const percent = maxCount > 0 ? (value.count / maxCount) * 100 : 0;
            const item = document.createElement('div');
            item.className = 'stat-bar-item';
            const label = document.createElement('span');
            label.className = 'stat-bar-label';
            label.textContent = value.label;
            const wrapper = document.createElement('div');
            wrapper.className = 'stat-bar-wrapper';
            const bar = document.createElement('div');
            bar.className = `stat-bar ${value.class}`;
            bar.style.width = `${percent}%`;
            wrapper.appendChild(bar);
            const val = document.createElement('span');
            val.className = 'stat-bar-value-outside';
            val.textContent = value.count;
            item.appendChild(label);
            item.appendChild(wrapper);
            item.appendChild(val);
            container.appendChild(item);
        });
    }

    renderMethodCards(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const entries = Object.entries(data).sort((a, b) => b[1].count - a[1].count);
        if (entries.length === 0) {
            container.innerHTML = sanitizeHTML('<div class="stats-empty">데이터가 없습니다</div>');
            return;
        }
        container.innerHTML = '';
        entries.forEach(([key, value]) => {
            const card = document.createElement('div');
            card.className = 'method-card';
            const name = document.createElement('span');
            name.className = 'method-card-name';
            name.textContent = value.label;
            const count = document.createElement('span');
            count.className = 'method-card-count';
            count.textContent = value.count;
            card.appendChild(name);
            card.appendChild(count);
            container.appendChild(card);
        });
    }

    renderBarChart(containerId, data, prefix) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const entries = Object.entries(data).sort((a, b) => b[1].count - a[1].count);
        if (entries.length === 0) {
            container.innerHTML = sanitizeHTML('<div class="stats-empty">데이터가 없습니다</div>');
            return;
        }
        const maxCount = Math.max(...entries.map(([, v]) => v.count));
        container.innerHTML = sanitizeHTML(entries.map(([key, value]) => {
            const percent = maxCount > 0 ? (value.count / maxCount) * 100 : 0;
            const showInside = percent > 20;
            return `
                <div class="stat-bar-item">
                    <span class="stat-bar-label">${value.label}</span>
                    <div class="stat-bar-wrapper">
                        <div class="stat-bar ${value.class}" data-width-pct="${percent}"></div>
                        ${showInside ? `<span class="stat-bar-count">${value.count}건</span>` : ''}
                    </div>
                    ${!showInside ? `<span style="font-size: 0.75rem; color: #6b7280; min-width: 40px;">${value.count}건</span>` : ''}
                </div>
            `;
        }).join(''));
    }

    renderMonthlyChart(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
        const maxCount = Math.max(...entries.map(([, v]) => v.count), 1);
        const totalCount = entries.reduce((sum, [, v]) => sum + v.count, 0);
        if (totalCount === 0) {
            container.innerHTML = sanitizeHTML('<div class="stats-empty">데이터가 없습니다</div>');
            return;
        }
        container.innerHTML = '';
        const chart = document.createElement('div');
        chart.className = 'monthly-chart';
        const barsRow = document.createElement('div');
        barsRow.className = 'monthly-bars';
        entries.forEach(([key, value]) => {
            const heightPercent = maxCount > 0 ? (value.count / maxCount) * 100 : 0;
            const completedPercent = value.count > 0 ? (value.completed / value.count) * 100 : 0;
            const group = document.createElement('div');
            group.className = 'monthly-bar-group';
            const barContainer = document.createElement('div');
            barContainer.className = 'monthly-bar-container';
            const stack = document.createElement('div');
            stack.className = 'monthly-bar-stack';
            stack.style.height = `${heightPercent}%`;
            const completed = document.createElement('div');
            completed.className = 'monthly-bar-completed';
            completed.style.height = `${completedPercent}%`;
            completed.title = `완료: ${value.completed}건`;
            const pending = document.createElement('div');
            pending.className = 'monthly-bar-pending';
            pending.style.height = `${100 - completedPercent}%`;
            pending.title = `미완료: ${value.pending}건`;
            stack.appendChild(completed);
            stack.appendChild(pending);
            barContainer.appendChild(stack);
            if (value.count > 0) {
                const val = document.createElement('span');
                val.className = 'monthly-bar-value';
                val.textContent = value.count;
                barContainer.appendChild(val);
            }
            const label = document.createElement('span');
            label.className = 'monthly-bar-label';
            label.textContent = value.label;
            group.appendChild(barContainer);
            group.appendChild(label);
            barsRow.appendChild(group);
        });
        chart.appendChild(barsRow);
        const legend = document.createElement('div');
        legend.className = 'monthly-legend';
        legend.innerHTML = sanitizeHTML('<span class="legend-item"><span class="legend-color completed"></span> 완료</span><span class="legend-item"><span class="legend-color pending"></span> 미완료</span>');
        chart.appendChild(legend);
        container.appendChild(chart);
    }

    renderQuarterlySummary(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const totalCount = Object.values(data).reduce((sum, q) => sum + q.count, 0);
        container.innerHTML = sanitizeHTML(`
            <div class="quarterly-summary">
                ${Object.entries(data).map(([key, value]) => {
                    const percent = totalCount > 0 ? ((value.count / totalCount) * 100).toFixed(1) : 0;
                    const completionRate = value.count > 0 ? ((value.completed / value.count) * 100).toFixed(0) : 0;
                    return `
                        <div class="quarterly-item">
                            <div class="quarterly-label">${value.label}</div>
                            <div class="quarterly-stats">
                                <span class="quarterly-count">${value.count}건</span>
                                <span class="quarterly-percent">(${percent}%)</span>
                            </div>
                            <div class="quarterly-completion">
                                <div class="completion-bar">
                                    <div class="completion-fill" data-width-pct="${completionRate}"></div>
                                </div>
                                <span class="completion-text">완료율 ${completionRate}%</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `);
        // 🚨 새니타이저가 인라인 style을 지운다 — 폭은 삽입 **뒤에** 준다 (SLS-1-253).
        //    안 그러면 완료율 0%인 분기도 막대가 꽉 차 보인다(실측 확인).
        window.applyDataWidths(container);
    }

    // ========================================
    // 체크박스 선택 기능
    // ========================================

    updateSelectAllState() {
        const rowCheckboxes = this.tableBody.querySelectorAll('.row-checkbox');
        const checkedBoxes = this.tableBody.querySelectorAll('.row-checkbox:checked');

        if (this.selectAllCheckbox) {
            if (rowCheckboxes.length === 0) {
                this.selectAllCheckbox.checked = false;
                this.selectAllCheckbox.indeterminate = false;
            } else if (checkedBoxes.length === 0) {
                this.selectAllCheckbox.checked = false;
                this.selectAllCheckbox.indeterminate = false;
            } else if (checkedBoxes.length === rowCheckboxes.length) {
                this.selectAllCheckbox.checked = true;
                this.selectAllCheckbox.indeterminate = false;
            } else {
                this.selectAllCheckbox.checked = false;
                this.selectAllCheckbox.indeterminate = true;
            }
        }
    }

    updateSelectedCount() {
        const checkedBoxes = this.tableBody.querySelectorAll('.row-checkbox:checked');
        const count = checkedBoxes.length;

        let badge = document.getElementById('selectedCountBadge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'selectedCountBadge';
                badge.className = 'selected-count-badge';
                const recordCount = document.getElementById('recordCount');
                if (recordCount) {
                    recordCount.parentNode.insertBefore(badge, recordCount.nextSibling);
                }
            }
            badge.textContent = `${count}건 선택`;
        } else if (badge) {
            badge.remove();
        }

        this.log(`${count}개 항목 선택됨`);
    }

    getSelectedIds() {
        const checkedBoxes = this.tableBody.querySelectorAll('.row-checkbox:checked');
        return Array.from(checkedBoxes).map(cb => cb.dataset.id);
    }

    selectByName(farmerKey) {
        const rowCheckboxes = this.tableBody.querySelectorAll('.row-checkbox');
        const targetCheckboxes = [];

        rowCheckboxes.forEach(cb => {
            const tr = cb.closest('tr');
            const nameCell = tr?.querySelector('.col-name');
            if (nameCell && nameCell.dataset.farmerKey === farmerKey) {
                targetCheckboxes.push(cb);
            }
        });

        if (targetCheckboxes.length === 0) return;

        const allChecked = targetCheckboxes.every(cb => cb.checked);
        targetCheckboxes.forEach(cb => { cb.checked = !allChecked; });

        this.updateSelectAllState();
        this.updateSelectedCount();
    }

    // ========================================
    // 라벨 인쇄 기능
    // ========================================

    /**
     * 라벨용 주소·우편번호를 뽑는다 (SLS-1-226).
     *
     * ⚠️ 원래는 `log.address`만 재파싱했다. 그래서 **엑셀로 가져온 건은 라벨이 비었다** —
     *    가져오기는 addressRoad만 채우고 address는 빈 채로 두기 때문이다.
     *    address 규약(address.js:340)이 "우편번호가 없으면 빈 문자열"이라, 우편번호를
     *    안 적은 자료는 주소까지 통째로 사라졌다.
     *
     * ⚠️ 이 파일의 다른 주소 소비처는 전부 addressRoad를 먼저 본다 —
     *    목록(:3732), 등록결과 모달(:3315), 공익직불제(:4997).
     *    Base에도 같은 취지의 훅이 있고(BaseSampleManager.getLabelAddressParts) 퇴비는 그걸 쓴다.
     *    **라벨만 혼자 다른 패턴이었다.**
     *
     * 분리 필드를 우선하고, address 재파싱은 레거시 데이터용 폴백으로 남긴다.
     * 이 순서 덕분에 **이미 가져온 기존 레코드도 재가져오기 없이 고쳐진다.**
     *
     * @param {Object} log
     * @returns {{address: string, postalCode: string}}
     */
    _extractLabelAddress(log) {
        const road = (log.addressRoad || '').trim();
        if (road) {
            const detail = (log.addressDetail || '').trim();
            // ⚠️ 혼합 레코드 보완 (codex 리뷰 MAJOR): addressRoad는 있는데 addressPostcode만
            //    비고 우편번호가 레거시 address 접두에만 남아 있는 경우가 있다.
            //    분리 필드를 우선하되, 비었을 때만 접두에서 끌어온다 —
            //    안 그러면 주소는 나오는데 우편번호만 사라진다.
            let postalCode = log.addressPostcode || '';
            if (!postalCode) {
                const m = (log.address || '').match(/^\((\d{5})\)\s*/);
                if (m) postalCode = m[1];
            }
            return {
                address: [road, detail].filter(Boolean).join(' '),
                postalCode,
            };
        }
        // 레거시: 분리 필드가 없던 시절의 레코드 — address에 '(우편번호) 주소'로 뭉쳐 있다
        const addressFull = log.address || '';
        const zipMatch = addressFull.match(/^\((\d{5})\)\s*/);
        return {
            address: zipMatch ? addressFull.replace(zipMatch[0], '') : addressFull,
            postalCode: zipMatch ? zipMatch[1] : (log.addressPostcode || ''),
        };
    }

    /**
     * 라벨용 주소 추출 훅 (SLS-1-197 A-2).
     *
     * base의 `openLabelPrintWithData`가 이 훅을 부른다. 예전에는 그 메서드를 통째로
     * 복사해 두고 이 한 줄만 달랐다 — base 쪽에 널 가드(`(logs || [])`)가 더 있어
     * 사본이 오히려 열화판이었다.
     */
    getLabelAddressParts(log) {
        return this._extractLabelAddress(log);
    }

    // ========================================
    // 등록 결과 모달
    // ========================================

    showRegistrationResult(logData) {
        this.currentRegistrationData = logData;
        const formatArea = this.formatArea || window.SampleUtils?.formatArea || ((v) => v);

        const basicRows = [
            { label: '접수번호', value: logData.receptionNumber },
            { label: '접수일자', value: logData.date },
            { label: '성명', value: logData.name },
            { label: '전화번호', value: logData.phoneNumber },
            { label: '주소', value: [logData.addressRoad || logData.address, logData.addressDetail].filter(Boolean).join(' ') || '-' },
            { label: '구분', value: logData.subCategory || '-' },
            { label: '목적 (용도)', value: logData.purpose || '-' },
            { label: '수령 방법', value: logData.receptionMethod || '-' },
            { label: '비고', value: logData.note || '-' }
        ];

        BaseSampleManager.buildResultTable(this.resultTableBody, basicRows);

        if (logData.parcels && logData.parcels.length > 0) {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = '필지 정보';
            th.style.verticalAlign = 'top';
            const td = document.createElement('td');
            const parcelsDiv = document.createElement('div');
            parcelsDiv.className = 'parcels-section';

            logData.parcels.forEach((parcel, idx) => {
                const parcelDiv = document.createElement('div');
                parcelDiv.className = 'parcel-item';
                const header = document.createElement('div');
                header.className = 'parcel-header';
                header.textContent = `필지 ${idx + 1}`;
                parcelDiv.appendChild(header);
                const addressDiv = document.createElement('div');
                addressDiv.textContent = parcel.lotAddress;
                parcelDiv.appendChild(addressDiv);

                const noteDiv = document.createElement('div');
                noteDiv.className = 'text-sm text-gray';
                noteDiv.textContent = '기타주소: ' + (parcel.note || '-');
                parcelDiv.appendChild(noteDiv);

                if (parcel.subLots && parcel.subLots.length > 0) {
                    const subLotsDiv = document.createElement('div');
                    subLotsDiv.className = 'text-sm text-gray';
                    subLotsDiv.textContent = '하위 지번: ' + parcel.subLots.map(s =>
                        typeof s === 'string' ? s : s.lotAddress
                    ).join(', ');
                    parcelDiv.appendChild(subLotsDiv);
                }

                if (parcel.crops && parcel.crops.length > 0) {
                    const cropList = document.createElement('div');
                    cropList.className = 'crop-list';
                    parcel.crops.forEach(crop => {
                        const cropTag = document.createElement('span');
                        cropTag.className = 'crop-tag';
                        cropTag.textContent = `${crop.name}: ${formatArea(crop.area)}m²`;
                        cropList.appendChild(cropTag);
                    });
                    parcelDiv.appendChild(cropList);
                } else {
                    const noCrop = document.createElement('span');
                    noCrop.className = 'text-gray';
                    noCrop.textContent = '작물 정보 없음';
                    parcelDiv.appendChild(noCrop);
                }

                parcelsDiv.appendChild(parcelDiv);
            });

            td.appendChild(parcelsDiv);
            tr.appendChild(th);
            tr.appendChild(td);
            this.resultTableBody.appendChild(tr);
        }

        // 주소 검증 상태 UI 초기화
        const verifyStatus = document.getElementById('addressVerifyStatus');
        const verifySpinner = document.getElementById('verifySpinner');
        const verifyResult = document.getElementById('verifyResult');
        const closeBtn = document.getElementById('closeResultBtn');
        const exportBtn = document.getElementById('exportResultBtn');
        const editBtn = document.getElementById('editResultBtn');

        if (verifyStatus) verifyStatus.style.display = 'block';
        if (verifySpinner) verifySpinner.style.display = 'flex';
        if (verifyResult) { verifyResult.style.display = 'none'; verifyResult.innerHTML = ''; }
        if (closeBtn) closeBtn.disabled = true;
        if (exportBtn) exportBtn.disabled = true;
        if (editBtn) editBtn.style.display = 'none';

        if (this.registrationResultModal) this.registrationResultModal.classList.remove('hidden');
    }

    /**
     * 필지 검증이 전부 스킵됐을 때(addressVerified === undefined) 원인별 안내 메시지 생성.
     * "API 키 또는 네트워크"는 흔한 오해 — 실제로는 기본 시·도 미설정으로 API 호출 전에
     * 스킵되는 경우가 대부분이다(validateParcelAddress의 시·도 prefix 로직 참고).
     *
     * ⚠️ 분기 순서는 validateParcelAddress의 실제 스킵 순서(offline → 기본시도 → 웹)와
     * 의도적으로 다르다(offline → 웹 → 기본시도). 웹 환경은 어떤 경우든 항상 스킵되므로
     * 웹을 기본시도보다 먼저 판정하는 편이 메시지가 더 정확하다(웹에선 기본시도 설정이 무의미).
     * 단, 향후 웹 검증(서버 프록시, validateParcelAddress 말미 TODO)이 도입되면
     * 이 순서를 재검토할 것.
     * @param {Array} logs 검증 대상 레코드
     * @returns {string} 사용자 안내 메시지
     */
    _buildVerificationSkipMessage(logs) {
        // 1) 오프라인
        if (!navigator.onLine) {
            return '주소 검증을 수행할 수 없습니다 (인터넷 연결을 확인하세요)';
        }
        // 2) 웹 환경: VWORLD는 데스크톱 앱(IPC, main 프로세스)에서만 동작 → 항상 스킵.
        //    validateParcelAddress가 window.electronAPI.vworldGeocode 없으면 null 반환하는 것과 동일 조건.
        if (!window.electronAPI?.vworldGeocode) {
            return '웹 환경에서는 주소 검증이 지원되지 않습니다 (데스크톱 앱에서 검증하세요)';
        }
        // 3) 기본 시·도 미설정 + 시·도가 없는 필지 주소가 하나라도 있으면 → 가장 흔한 원인
        let defaultSido = '';
        try { defaultSido = (localStorage.getItem('app_default_sido') || '').trim(); } catch { defaultSido = ''; }
        if (!defaultSido) {
            const SIDO_RE = window.SIDO_PATTERN || SIDO_DETECT_FALLBACK;
            const hasAddrWithoutSido = logs.some(log => {
                const addrs = (log.parcels && log.parcels.length > 0)
                    ? log.parcels.map(p => p.lotAddress)
                    : [log.lotAddress];
                return addrs.some(a => a && a !== '-' && !SIDO_RE.test(a));
            });
            if (hasAddrWithoutSido) {
                return '주소 검증을 건너뛰었습니다 — 설정에서 기본 시·도를 지정하세요 (설정 → 기본 시·도 설정)';
            }
        }
        // 4) 그 외 — 실제 API 키/네트워크 문제
        return '주소 검증을 수행할 수 없습니다 (API 키 또는 네트워크 확인)';
    }

    /**
     * 등록 완료 모달에서 주소 검증 실행 후 결과 반영
     */
    async runVerificationForModal(newLogs) {
        this._verificationInProgress = true;
        const verifySpinner = document.getElementById('verifySpinner');
        const verifyResult = document.getElementById('verifyResult');
        const closeBtn = document.getElementById('closeResultBtn');
        const exportBtn = document.getElementById('exportResultBtn');
        const editBtn = document.getElementById('editResultBtn');

        try {
            await this.validateAndMarkLogs(newLogs);
        } catch (err) {
            (window.logger?.error || console.error)('VWORLD 검증 오류:', err);
        }

        this._verificationInProgress = false;

        // 검증 결과 확인
        const invalidLogs = newLogs.filter(l => l.addressVerified === false);
        const validLogs = newLogs.filter(l => l.addressVerified === true);
        const skipLogs = newLogs.filter(l => l.addressVerified === undefined);

        // 스피너 숨기고 결과 표시
        if (verifySpinner) verifySpinner.style.display = 'none';
        if (verifyResult) {
            verifyResult.style.display = 'block';
            if (invalidLogs.length > 0) {
                // 불일치 주소 목록 (필지만)
                const invalidAddresses = [];
                invalidLogs.forEach(log => {
                    if (log.parcels) {
                        log.parcels.forEach(p => {
                            if (p.lotAddress) invalidAddresses.push(p.lotAddress);
                        });
                    }
                });
                verifyResult.className = 'verify-result verify-fail';
                verifyResult.innerHTML = `<span>&#10060; 필지 주소 ${invalidLogs.length}건 불일치</span>` +
                    (invalidAddresses.length > 0 ? `<div class="verify-addresses">${escapeHTML(invalidAddresses.join(', '))}</div>` : '');
            } else if (skipLogs.length === newLogs.length) {
                verifyResult.className = 'verify-result verify-skip';
                verifyResult.innerHTML = `<span>&#9888; ${escapeHTML(this._buildVerificationSkipMessage(newLogs))}</span>`;
            } else {
                verifyResult.className = 'verify-result verify-pass';
                verifyResult.innerHTML = `<span>&#9989; 필지 주소 ${validLogs.length}건 검증 완료</span>`;
            }
        }

        // 버튼 활성화
        if (closeBtn) closeBtn.disabled = false;
        if (exportBtn) exportBtn.disabled = false;

        // 불일치 시 수정 버튼 표시
        if (invalidLogs.length > 0 && editBtn) {
            editBtn.style.display = 'inline-block';
            editBtn.textContent = '수정';
        }
    }

    closeRegistrationResultModal() {
        if (this._verificationInProgress) return; // 검증 중 닫기 방지
        if (this.registrationResultModal) this.registrationResultModal.classList.add('hidden');
        this.currentRegistrationData = null;
    }

    // ========================================
    // 지역 선택 모달 (중복 리 이름)
    // ========================================

    showRegionSelectionModal(parseResult, parcelId, inputElement) {
        this.regionSelectionModalData = { result: parseResult, parcelId, inputElement };
        const duplicateVillageName = document.getElementById('duplicateVillageName');
        const regionOptions = document.getElementById('regionOptions');

        if (duplicateVillageName) duplicateVillageName.textContent = parseResult.villageName;

        if (regionOptions) {
            regionOptions.innerHTML = sanitizeHTML(parseResult.locations.map((location, index) => `
                <div class="region-option" data-index="${index}">
                    <div class="region-option-content">
                        <div class="region-option-title">${escapeHTML(location.fullAddress)}</div>
                        <div class="region-option-subtitle">${escapeHTML(location.region)} ${escapeHTML(location.district)}</div>
                    </div>
                    <div class="region-option-icon">→</div>
                </div>
            `).join(''));

            regionOptions.querySelectorAll('.region-option').forEach(option => {
                option.addEventListener('click', () => {
                    const index = parseInt(option.dataset.index, 10);
                    this.selectRegion(index);
                });
            });
        }

        if (this.regionSelectionModal) this.regionSelectionModal.classList.remove('hidden');
    }

    selectRegion(index) {
        if (!this.regionSelectionModalData) return;
        const location = this.regionSelectionModalData.result.locations[index];
        const lotNumber = this.regionSelectionModalData.result.lotNumber;
        const fullAddress = lotNumber ? `${location.fullAddress} ${lotNumber}` : location.fullAddress;
        this.regionSelectionModalData.inputElement.value = fullAddress;
        this.updateParcelLotAddress(this.regionSelectionModalData.parcelId);
        this.closeRegionSelectionModal();
        this.showToast('지역이 선택되었습니다', 'success');
    }

    closeRegionSelectionModal() {
        if (this.regionSelectionModal) this.regionSelectionModal.classList.add('hidden');
        this.regionSelectionModalData = null;
    }

    // ========================================
    // 데이터 평탄화
    // ========================================

    /**
     * 필지 주소 표시용 문자열 — 선두 시도(전체/약어) 토큰을 제거한다.
     * 실제 데이터(parcel.lotAddress/log.lotAddress, flattenLogsForTable이 만드는
     * row._lotAddress)는 변경하지 않고 DOM 렌더링 시점에만 사용한다(SLS-1-182).
     * @param {string} address
     * @returns {string}
     */
    formatLotAddressForDisplay(address) {
        if (!address || address === '-') return address || '-';
        if (!window.parseAddressParts) return address; // 방어: 파서 미로드
        const { sido, sigungu, eupmyeondong, rest } = window.parseAddressParts(address);
        if (!sido) return address; // 시도로 시작하지 않으면 원본 유지
        const remainder = [sigungu, eupmyeondong, rest].filter(Boolean).join(' ');
        return remainder || address; // 방어: 시도만 있고 나머지가 없으면 원본 유지
    }

    flattenLogsForTable(logs) {
        const rows = [];
        logs.forEach(log => {
            if (log.parcels && log.parcels.length > 0) {
                let subLotIndex = 1;
                const R = window.SoilLogRecord || {};
                log.parcels.forEach((parcel, pIndex) => {
                    // 최상위 권위필드는 parcels[0]을 기술 → 대표 필지에만 폴백(방어적)
                    const isPrimary = pIndex === 0;
                    let cropsDisplay = parcel.crops && parcel.crops.length > 0
                        ? parcel.crops.map(c => c.name).join(', ') : '-';
                    if (cropsDisplay === '-' && isPrimary && log.cropsDisplay && log.cropsDisplay !== '-') {
                        cropsDisplay = log.cropsDisplay;
                    }
                    let m2Total = 0;
                    let pyeongTotal = 0;
                    if (parcel.crops) {
                        parcel.crops.forEach(c => {
                            const area = parseFloat(c.area) || 0;
                            if (c.unit === 'pyeong') { pyeongTotal += area; } else { m2Total += area; }
                        });
                    }
                    const areaParts = [];
                    if (m2Total > 0) areaParts.push(`${m2Total.toLocaleString()}㎡`);
                    if (pyeongTotal > 0) areaParts.push(`${pyeongTotal.toLocaleString()}평`);
                    let areaDisplay = areaParts.length > 0 ? areaParts.join(' / ') : '-';
                    if (areaDisplay === '-' && isPrimary && log.area) {
                        const a = parseFloat(log.area);
                        if (!isNaN(a)) areaDisplay = a.toLocaleString();
                    }
                    let lotAddressDisplay = parcel.lotAddress
                        ? (parcel.isMountain ? `${parcel.lotAddress} (산)` : parcel.lotAddress) : '-';
                    if (lotAddressDisplay === '-' && isPrimary && log.lotAddress) {
                        lotAddressDisplay = parcel.isMountain ? `${log.lotAddress} (산)` : log.lotAddress;
                    }

                    rows.push({
                        ...log,
                        _isFirstRow: subLotIndex === 1,
                        _subLotIndex: subLotIndex,
                        _displayNumber: log.receptionNumber,
                        _lotAddress: lotAddressDisplay,
                        _cropsDisplay: cropsDisplay,
                        _areaDisplay: areaDisplay,
                        _parcelPurpose: R.resolveParcelPurpose ? R.resolveParcelPurpose(parcel.purpose, isPrimary ? log : {}) : (parcel.purpose || '')
                    });
                    subLotIndex++;

                    if (parcel.subLots && parcel.subLots.length > 0) {
                        parcel.subLots.forEach((subLot, idx) => {
                            const lotAddress = typeof subLot === 'string' ? subLot : subLot.lotAddress;
                            const subLotCrops = typeof subLot === 'string' ? [] : (subLot.crops || []);
                            const subLotCropsDisplay = subLotCrops.length > 0
                                ? subLotCrops.map(c => c.name).join(', ') : '-';
                            let subM2Total = 0;
                            let subPyeongTotal = 0;
                            subLotCrops.forEach(c => {
                                const area = parseFloat(c.area) || 0;
                                if (c.unit === 'pyeong') { subPyeongTotal += area; } else { subM2Total += area; }
                            });
                            const subAreaParts = [];
                            if (subM2Total > 0) subAreaParts.push(`${subM2Total.toLocaleString()}㎡`);
                            if (subPyeongTotal > 0) subAreaParts.push(`${subPyeongTotal.toLocaleString()}평`);
                            const subAreaDisplay = subAreaParts.length > 0 ? subAreaParts.join(' / ') : '-';

                            rows.push({
                                ...log,
                                _isFirstRow: false,
                                _subLotIndex: subLotIndex,
                                _displayNumber: window.SoilLogRecord.subLotDisplayNumber(log, idx),
                                _lotAddress: lotAddress,
                                _cropsDisplay: subLotCropsDisplay,
                                _areaDisplay: subAreaDisplay,
                                _parcelPurpose: parcel.purpose || ''
                            });
                            subLotIndex++;
                        });
                    }
                });

                if (subLotIndex === 1) {
                    rows.push({
                        ...log, _isFirstRow: true, _subLotIndex: 1, _displayNumber: log.receptionNumber,
                        _lotAddress: '-', _subLot: '-', _cropsDisplay: '-', _areaDisplay: '-'
                    });
                }
            } else {
                rows.push({
                    ...log, _isFirstRow: true, _subLotIndex: 1, _displayNumber: log.receptionNumber,
                    _lotAddress: log.lotAddress || '-', _subLot: '-',
                    _cropsDisplay: log.cropsDisplay || '-',
                    _areaDisplay: log.area ? parseFloat(log.area).toLocaleString() : '-'
                });
            }
        });
        // SLS-1-265: 평탄화는 하위 지번 행을 자기 레코드 바로 뒤에 붙인다. 작물 분할이
        // 있으면 하위 지번이 형제 레코드 번호를 건너뛰므로 `503, 503-2, 503-3, 503-1`처럼
        // 순서가 뒤집혀 보인다. 번호는 맞지만 읽기 불편해 표시 번호로 다시 정렬한다.
        //
        // ⚠️ **여기서 정렬해야 한다.** 호출부가 둘이다(filterAndRenderLogs·prepareDataForRender).
        //    한쪽에서만 정렬하면 화면에 따라 순서가 갈린다.
        //    기존 데이터는 `503, 503-1, 503-2, 504…`라 정렬해도 순서가 그대로다.
        rows.sort((a, b) => compareReceptionNumbers(a._displayNumber, b._displayNumber));
        return rows;
    }

    // ========================================
    // 페이지네이션
    // ========================================

    renderCurrentPage(direction = 0) {
        if (!this.tableBody) return;
        this.tableBody.innerHTML = '';

        // 공익직불제 탭 선택 시 경영체등록번호·BASEPNU 컬럼 표시
        this._syncTableModeClasses();

        if (this.currentFlatRows.length === 0) {
            this.updatePaginationUI();
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.currentFlatRows.length);
        const pageRows = this.currentFlatRows.slice(startIndex, endIndex);

        const fragment = document.createDocumentFragment();
        let prevName = startIndex > 0 ? (this.currentFlatRows[startIndex - 1]?.name || null) : null;
        const columnCount = this._columnSpan();

        pageRows.forEach((row) => {
            if (prevName !== null && row.name !== prevName) {
                fragment.appendChild(this._buildFarmSeparatorRow(columnCount));
            }
            prevName = row.name;
            fragment.appendChild(this._buildLogTableRow(row));
        });

        // 마지막 페이지가 짧아도 표 높이를 지킨다 (SLS-1-276). 안 그러면 5건짜리 끝 페이지에서
        // 표가 반토막 나고(실측 −334px) 아래 페이지 단추가 그만큼 따라 올라온다.
        // ⚠️ 페이지가 하나뿐이면 채우지 않는다 — 5건인데 페이지당 100건이면 빈 줄 95개가 생긴다.
        if (this.totalPages > 1) {
            for (let i = pageRows.length; i < this.itemsPerPage; i++) {
                fragment.appendChild(this._buildPageFillerRow(columnCount));
            }
        }

        this.tableBody.appendChild(fragment);
        this._playPageTransition(direction);
        this.updatePaginationUI();
    }

    /**
     * 표 끝까지 닿는 `colSpan`. 구분선 행과 채움 행이 **이 하나를 함께 쓴다.**
     *
     * 🚨 **지금 보이는 열만 세면 안 된다** (SLS-1-280).
     *    전체 보기 토글은 **목록을 다시 그리지 않는다** — 표의 class만 바꾼다.
     *    그래서 기본 보기에서 만들어진 행은 그때의 값을 그대로 갖고 있고, 전체 보기로
     *    열이 늘면 **끝 열에 닿지 못한다.**
     *
     *    실측(1500px): 기본 보기 17열에서 그린 구분선이 전체 보기 19열에서도 17칸만
     *    덮어, 마지막 `발송일자`·`관리`에 미치지 않았다. 사용자가 실기에서 발견했다.
     *
     *    ⚠️ SLS-1-276에서 "정확히" 세도록 바꾸며 들어온 회귀다. 그 전의 하드코딩
     *       `gongikOn ? 18 : 19`는 역설적으로 두 모드를 모두 덮고 있었다 — 기본
     *       보기에는 초과라 잘리고 전체 보기에는 딱 맞았다.
     *
     * 이 표가 **가질 수 있는 전체 열 수**를 쓴다. 숨긴 열까지 세므로 어떤 모드에서도
     * 모자라지 않는다. 남는 쪽은 브라우저가 실제 열 수로 잘라 준다 —
     * **모자라는 것과 남는 것은 대칭이 아니다.**
     *
     * ⚠️ 앞으로 머리글에 `colspan`이 들어가거나 머리글 행이 여럿이 되면 이 값이
     *    실제 그리드 열 수와 어긋난다. 그때는 그리드를 세는 방식으로 바꿔야 한다
     *    (codex 플랜 리뷰 지적). 지금은 22개 셀이 한 행에 나란히 있다.
     */
    _columnSpan() {
        const head = this.logTable?.tHead?.rows[0];
        return head?.cells.length || SOIL_TOTAL_COLUMN_COUNT;
    }

    // 농가(성명) 경계에 삽입하는 구분선 행 — colSpan은 `_columnSpan()`이 정한다
    // (숨긴 열까지 센 값이라 전체 보기로 열이 드러나도 끝까지 덮는다)
    _buildFarmSeparatorRow(columnCount) {
        const separatorTr = document.createElement('tr');
        separatorTr.className = 'farm-separator';
        const separatorTd = document.createElement('td');
        separatorTd.colSpan = columnCount;
        separatorTr.appendChild(separatorTd);
        return separatorTr;
    }

    /**
     * 마지막 페이지가 짧을 때 표 높이를 채우는 빈 줄 (SLS-1-276).
     *
     * 🚨 체크박스도 `data-id`도 넣지 않는다. 선택·삭제·내보내기·주소 검증이
     *    `.row-checkbox`와 `tr[data-id]`로 행을 찾으므로, 둘 중 하나라도 붙이면
     *    **빈 줄이 처리 대상에 섞인다.**
     */
    _buildPageFillerRow(columnCount) {
        const tr = document.createElement('tr');
        tr.className = 'page-filler';
        tr.setAttribute('aria-hidden', 'true');   // 스크린리더가 빈 줄을 읽지 않게
        const td = document.createElement('td');
        td.colSpan = columnCount;
        td.textContent = ' ';                 // 데이터 행과 같은 높이를 갖게 한다
        tr.appendChild(td);
        return tr;
    }

    /**
     * 넘긴 방향으로 짧게 밀어 넣는다 (SLS-1-276).
     *
     * 🚨 클래스를 지웠다가 다시 붙이는 사이에 리플로우를 한 번 강제해야 한다.
     *    같은 방향을 연달아 누르면(1→2→3) 클래스에 변화가 없어 CSS 애니메이션이
     *    두 번째부터 재생되지 않는다 (codex 플랜 리뷰 지적).
     */
    _playPageTransition(direction) {
        if (!direction || !this.tableBody) return;
        this.tableBody.classList.remove('page-in-next', 'page-in-prev');
        void this.tableBody.offsetWidth;
        this.tableBody.classList.add(direction > 0 ? 'page-in-next' : 'page-in-prev');
    }

    // 로그 한 건을 표 행(<tr>)으로 생성한다 (셀 구성·주소 복사 핸들러 포함)
    _buildLogTableRow(row) {
        const isComplete = row.isComplete || false;
        const tr = document.createElement('tr');
        tr.className = isComplete ? 'row-completed' : '';
        const methodText = row.receptionMethod || '-';

        const addressFull = [row.addressRoad || row.address, row.addressDetail].filter(Boolean).join(' ') || '';
        const zipMatch = addressFull.match(/^\((\d{5})\)\s*/);
        //
        // 🚨 우편번호는 **필드가 먼저**다 (SLS-1-247). 예전에는 주소 문자열 앞의
        //    `(12345)` 접두에서만 뽑았는데, addressRoad에는 그 접두가 없어서
        //    (buildAddressFields는 address에만 붙인다) **제대로 채운 건도 목록에서
        //    빈칸으로 보였다.**
        //
        // ⚠️ `address`에서도 따로 찾는다. addressFull은 `addressRoad || address`라
        //    addressRoad가 있으면 address를 아예 안 본다 — addressRoad는 있고
        //    address에만 우편번호가 있는 레거시 레코드가 그 틈으로 샌다.
        //
        // ⚠️ String()으로 감싼다. 숫자형 우편번호가 들어와도 죽지 않게.
        //
        // 🚨 **5자리인 것만** 우선한다. 그냥 "비어 있지 않으면 우선"으로 두면
        //    깨진 값('1234' 등)이 멀쩡한 폴백을 막고 **경고까지 꺼버린다** —
        //    고쳐야 할 건이 정상으로 보이는 쪽이 가장 나쁘다.
        //    정상 경로는 5자리를 보장하지만 레거시·수동 수정 데이터가 있다.
        const zipFieldRaw = String(row.addressPostcode ?? '').trim();
        const zipField = /^\d{5}$/.test(zipFieldRaw) ? zipFieldRaw : '';
        const zipInRoad = zipMatch ? zipMatch[1] : '';
        const zipInAddr = (String(row.address ?? '').match(/^\((\d{5})\)/) || [])[1] || '';
        const zipcode = zipField || zipInRoad || zipInAddr;
        const addressOnly = zipMatch ? addressFull.replace(zipMatch[0], '') : addressFull;
        const displayAddress = addressOnly && addressOnly !== '-' && typeof SIDO_PATTERN !== 'undefined' && SIDO_PATTERN.test(addressOnly)
            ? addressOnly.replace(SIDO_PATTERN, '') : (addressOnly || '-');

        const combinedNote = row.note?.trim() || '-';

        tr.dataset.id = row.id;

        this._appendRowLeadingCells(tr, row, isComplete);
        this._appendRowAddressCells(tr, row, zipcode, displayAddress, addressOnly);
        this._appendRowContentCells(tr, row, methodText, combinedNote);

        return tr;
    }

    /**
     * 접수번호~경영체등록번호까지의 선두 sticky 셀들을 tr에 추가.
     */
    _appendRowLeadingCells(tr, row, isComplete) {
        // 체크박스
        const tdCheckbox = document.createElement('td');
        tdCheckbox.className = 'col-checkbox sticky-col';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'row-checkbox';
        checkbox.dataset.id = row.id;
        tdCheckbox.appendChild(checkbox);
        tr.appendChild(tdCheckbox);

        // 완료 버튼
        const tdComplete = document.createElement('td');
        tdComplete.className = 'col-complete sticky-col';
        const btnComplete = document.createElement('button');
        btnComplete.className = `btn-complete ${isComplete ? 'completed' : ''}`;
        btnComplete.dataset.id = row.id;
        btnComplete.title = isComplete ? '완료 취소' : '완료';
        btnComplete.textContent = isComplete ? '✔' : '';
        tdComplete.appendChild(btnComplete);
        tr.appendChild(tdComplete);

        // 접수번호
        const tdNumber = document.createElement('td');
        tdNumber.className = 'col-num sticky-col';
        tdNumber.textContent = row._displayNumber;
        tr.appendChild(tdNumber);

        // 공익직불제 전용: 차수 편집 셀 (접수번호 다음, gongik-on일 때만 표시)
        const tdOrder = document.createElement('td');
        tdOrder.className = 'col-order gongik-col sticky-col';
        const orderSelect = document.createElement('select');
        orderSelect.className = 'gongik-order-select';
        orderSelect.dataset.id = row.id;
        [['1', '1차'], ['2', '2차']].forEach(([val, label]) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = label;
            orderSelect.appendChild(opt);
        });
        orderSelect.value = row.gongikOrder || '1';
        tdOrder.appendChild(orderSelect);
        tr.appendChild(tdOrder);

        // 날짜
        const tdDate = document.createElement('td');
        tdDate.className = 'col-date sticky-col';
        tdDate.textContent = row.date;
        tr.appendChild(tdDate);

        // 하위 카테고리
        const tdSubCategory = document.createElement('td');
        tdSubCategory.className = 'col-category sticky-col';
        tdSubCategory.textContent = row.subCategory || '-';
        tr.appendChild(tdSubCategory);

        // 목적
        const tdPurpose = document.createElement('td');
        tdPurpose.className = 'col-purpose sticky-col gongik-hide';
        tdPurpose.textContent = row._parcelPurpose || row.purpose || '-';
        tr.appendChild(tdPurpose);

        // 경지구분 1차
        const tdLandClass1 = document.createElement('td');
        tdLandClass1.className = 'col-landclass1 sticky-col';
        tdLandClass1.textContent = row.landClass1 || LAND_CLASS1_DEFAULT;
        tr.appendChild(tdLandClass1);

        // 성명 (클릭 시 같은 이름 일괄 선택)
        const tdName = document.createElement('td');
        tdName.className = 'col-name sticky-col';
        tdName.dataset.name = row.name;
        tdName.dataset.farmerKey = `${row.name}|${row.phoneNumber || ''}`;
        tdName.textContent = row.name;
        tdName.title = `"${row.name}" 클릭하면 같은 이름+전화번호 일괄 선택`;
        tr.appendChild(tdName);

        // 공익직불제 전용: 경영체등록번호 (성명 다음, gongik-on일 때만 표시)
        const tdBizReg = document.createElement('td');
        tdBizReg.className = 'col-bizreg gongik-col';
        tdBizReg.textContent = row.businessRegNo || '-';
        tr.appendChild(tdBizReg);
    }

    /**
     * 우편번호·주소·필지주소·기타주소 셀들을 tr에 추가.
     */
    _appendRowAddressCells(tr, row, zipcode, displayAddress, addressOnly) {
        // 우편번호
        const tdZipcode = document.createElement('td');
        tdZipcode.className = 'col-zipcode';
        tdZipcode.textContent = zipcode || '-';
        tr.appendChild(tdZipcode);

        // 주소 (클릭 시 시도 포함 전체 주소 복사)
        const tdAddress = document.createElement('td');
        tdAddress.className = 'col-address';
        tdAddress.textContent = displayAddress;
        if (addressOnly && addressOnly !== '-') {
            // 시도 약어→전체명 매핑은 address-parser SSOT(window.SIDO_SHORT_MAP) 재사용
            const sidoMap = window.SIDO_SHORT_MAP || {};
            const copyAddress = addressOnly.replace(
                SHORT_SIDO_RE,
                (_, sido, sp) => (sidoMap[sido] || sido) + sp
            );
            tdAddress.style.cursor = 'pointer';
            tdAddress.title = '클릭하여 주소 복사';
            tdAddress.addEventListener('click', () => {
                navigator.clipboard.writeText(copyAddress).then(() => {
                    this.showToast('주소가 복사되었습니다.', 'success');
                }).catch(() => {
                    this.showToast('주소 복사에 실패했습니다.', 'error');
                });
            });
        }
        // 농가의뢰만 결과를 농가로 발송한다. 주소가 있는데 우편번호가 없으면
        // 반송될 수 있어 목록에서 바로 눈에 띄게 한다 (SLS-1-247).
        //
        // ⚠️ 세 조건이 모두 필요하다.
        //    농가의뢰 아님 → 발송 대상이 아니라 우편번호가 없는 것이 정상이다
        //    주소 없음     → 빈 칸은 이미 보인다. 칠하면 정작 고칠 대상이 묻힌다
        //    우편번호 있음 → 경고할 이유가 없다
        if (row.landClass1 === '농가의뢰' && addressOnly && addressOnly !== '-' && !zipcode) {
            tdAddress.classList.add('postcode-missing');
            // 주소 복사 안내를 덮지 않고 합친다
            tdAddress.title = ['우편번호가 없습니다 — 발송 전 주소를 확인해 주세요', tdAddress.title]
                .filter(Boolean).join(' · ');
        }
        tr.appendChild(tdAddress);

        // 필지 주소
        const tdLotAddress = document.createElement('td');
        tdLotAddress.className = 'col-lot-address';
        tdLotAddress.textContent = this.formatLotAddressForDisplay(row._lotAddress);
        if (row.addressVerified === false) {
            tdLotAddress.classList.add('address-invalid');
            tdLotAddress.title = '지번 주소가 VWORLD에서 확인되지 않았습니다';
        }
        tr.appendChild(tdLotAddress);

        // 기타주소
        const tdParcelNote = document.createElement('td');
        const parcelNoteText = row.parcels && row.parcels[0] ? (row.parcels[0].note || '-') : '-';
        tdParcelNote.textContent = parcelNoteText;
        tr.appendChild(tdParcelNote);
    }

    /**
     * 작물~액션 버튼까지의 나머지 콘텐츠 셀들을 tr에 추가.
     */
    _appendRowContentCells(tr, row, methodText, combinedNote) {
        // 작물
        const tdCrops = document.createElement('td');
        tdCrops.className = 'text-truncate';
        tdCrops.setAttribute('data-tooltip', row._cropsDisplay);
        tdCrops.textContent = row._cropsDisplay;
        tr.appendChild(tdCrops);

        // 면적
        const tdArea = document.createElement('td');
        tdArea.textContent = row._areaDisplay;
        tr.appendChild(tdArea);

        // 전화번호
        const tdPhone = document.createElement('td');
        tdPhone.textContent = row.phoneNumber || '-';
        tr.appendChild(tdPhone);

        // 수령방법
        const tdMethod = document.createElement('td');
        tdMethod.className = 'col-method gongik-hide';
        tdMethod.textContent = methodText;
        tr.appendChild(tdMethod);

        // 비고
        const tdNote = document.createElement('td');
        tdNote.className = 'col-note gongik-hide';
        tdNote.title = combinedNote;
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-cell';
        noteDiv.textContent = combinedNote;
        tdNote.appendChild(noteDiv);
        tr.appendChild(tdNote);

        // 우편일자
        const tdMailDate = document.createElement('td');
        tdMailDate.className = 'col-mail-date gongik-hide';
        tdMailDate.textContent = row.mailDate || '-';
        tr.appendChild(tdMailDate);

        // 공익직불제 전용: 기준년도 편집 셀
        const tdBaseYear = document.createElement('td');
        tdBaseYear.className = 'col-baseyear gongik-col';
        const baseYearSelect = document.createElement('select');
        baseYearSelect.className = 'gongik-baseyear-select';
        baseYearSelect.dataset.id = row.id;
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '(선택)';
        baseYearSelect.appendChild(emptyOpt);
        GONGIK_BASE_YEAR_OPTIONS.forEach((val) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            baseYearSelect.appendChild(opt);
        });
        baseYearSelect.value = row.gongikBaseYear || '';
        tdBaseYear.appendChild(baseYearSelect);
        tr.appendChild(tdBaseYear);

        // 액션 버튼
        const tdAction = document.createElement('td');
        // thead의 <th class="col-action">과 짝을 맞춘다. 이게 없으면
        // 본문 칸을 겨냥한 CSS(오른쪽 고정 포함)가 머리글에만 걸린다.
        tdAction.className = 'col-action sticky-col';
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'table-actions';
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-edit';
        btnEdit.dataset.id = row.id;
        btnEdit.textContent = '수정';
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn-delete';
        btnDelete.dataset.id = row.id;
        btnDelete.textContent = '삭제';
        actionsDiv.appendChild(btnEdit);
        actionsDiv.appendChild(btnDelete);
        tdAction.appendChild(actionsDiv);
        tr.appendChild(tdAction);
    }

    updatePaginationUI() {
        const totalItems = this.currentFlatRows.length;
        const startItem = totalItems === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);

        if (this.paginationInfo) {
            this.paginationInfo.textContent = `${totalItems.toLocaleString()}건 중 ${startItem.toLocaleString()}-${endItem.toLocaleString()}`;
        }
        if (this.firstPageBtn) this.firstPageBtn.disabled = this.currentPage === 1;
        if (this.prevPageBtn) this.prevPageBtn.disabled = this.currentPage === 1;
        if (this.nextPageBtn) this.nextPageBtn.disabled = this.currentPage === this.totalPages;
        if (this.lastPageBtn) this.lastPageBtn.disabled = this.currentPage === this.totalPages;
        this.renderPageNumbers();
    }

    renderPageNumbers() {
        if (!this.pageNumbersContainer) return;
        if (this.totalPages <= 1) { this.pageNumbersContainer.innerHTML = ''; return; }
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        const fragment = document.createDocumentFragment();
        if (startPage > 1) {
            fragment.appendChild(this.createPageButton(1));
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                fragment.appendChild(ellipsis);
            }
        }
        for (let i = startPage; i <= endPage; i++) {
            fragment.appendChild(this.createPageButton(i));
        }
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                fragment.appendChild(ellipsis);
            }
            fragment.appendChild(this.createPageButton(this.totalPages));
        }
        this.pageNumbersContainer.innerHTML = '';
        this.pageNumbersContainer.appendChild(fragment);
    }

    createPageButton(pageNum) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (pageNum === this.currentPage ? ' active' : '');
        btn.textContent = pageNum;
        btn.addEventListener('click', () => this.goToPage(pageNum));
        return btn;
    }

    goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;
        const direction = Math.sign(page - this.currentPage);
        this.currentPage = page;
        this.renderCurrentPage(direction);

        // 🚨 예전에는 `.table-container`를 찾았는데 **그런 요소는 이 저장소에 없다**
        //    (SLS-1-276). HTML에도 CSS에도 없고 그 한 줄이 유일한 등장이었다.
        //    `if`로 감싸 놓아 오류도 나지 않아, 페이지를 넘겨도 **표가 그 자리에 그대로
        //    남았다** — 아래쪽을 보다가 다음 페이지를 누르면 새 페이지의 한가운데부터
        //    보였다. 실측(1440×900, 45건/20건씩): 300px 내린 뒤 넘겨도 300 그대로.
        //
        // ⚠️ `behavior: 'smooth'`는 쓰지 않는다. 표 안쪽 스크롤을 부드럽게 하면 새 행이
        //    이미 그려진 채 옛 위치에서 천천히 올라와 오히려 반응이 늦게 느껴진다.
        //    자리는 즉시 잡고, 내용만 짧게 넣는다(`_playPageTransition`).
        const tableWrapper = document.querySelector('.table-wrapper');
        if (tableWrapper) tableWrapper.scrollTop = 0;
    }

    // ========================================
    // 자동 저장 관련
    // ========================================

    async autoSaveToFile() {
        return await SampleUtils.performAutoSave({
            FileAPI: this.FileAPI,
            moduleKey: 'soil',
            data: this.sampleLogs,
            webFileHandle: this.autoSaveFileHandle,
            log: (...args) => this.log(...args)
        });
    }

    async loadAutoSaveForSelectedYear() {
        if (!window.isElectron || !this.FileAPI?.autoSavePath || this.sampleLogs.length > 0) return;
        const autoSaveData = await window.loadFromAutoSaveFile();
        if (autoSaveData && autoSaveData.length > 0) {
            this.sampleLogs = autoSaveData;
            // SLS-1-198: quota 사고의 복구 수단이 quota로 죽는 아이러니 차단 —
            // 캐싱 실패해도 메모리 반영·렌더는 계속한다
            this._safeSetYearStorage();
            this.filterAndRenderLogs();
            if (this.receptionNumberInput) {
                this.receptionNumberInput.value = this.generateNextReceptionNumber();
            }
            this.log(`${this.selectedYear}년 자동 저장 데이터 로드:`, autoSaveData.length, '건');
        }
    }

    /**
     * SLS-1-198: 복원 경로 전용 — 연도 키 캐싱을 quota로부터 격리.
     * 플랜 D-8b는 "try/catch + 토스트"였으나 **의도적으로 warn만 남긴다** — 복원 캐싱 실패는
     * 화면 동작에 무해하고(메모리 데이터가 진실), 초기화 중 토스트는 사용자를 불필요하게
     * 놀라게 한다. 이 이탈은 코드리뷰 MINOR-7에서 합리적 판단으로 확인됨.
     */
    _safeSetYearStorage() {
        try {
            localStorage.setItem(this.getStorageKey(this.selectedYear), JSON.stringify(this.sampleLogs));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                (window.logger?.warn || console.warn)('복원 데이터 캐싱 중 localStorage 용량 초과(무시):', e);
            } else {
                throw e;
            }
        }
    }

    // ========================================
    // 헬퍼
    // ========================================

    updateListViewTitle() {
        if (this.listViewTitle) {
            this.listViewTitle.textContent = '토양 접수 목록';
        }
    }

    resetFormKeepReceptionInfo() {
        const receptionNumber = this.receptionNumberInput?.value;
        const date = this.dateInput?.value;
        this._resetFormPreservingSelects();
        setTimeout(() => {
            if (receptionNumber && this.receptionNumberInput) this.receptionNumberInput.value = receptionNumber;
            if (date && this.dateInput) this.dateInput.value = date;
        }, 10);
    }

    // ========================================
    // Override: setupTypeSpecificEvents - ALL soil-specific event handlers
    // ========================================

    setupTypeSpecificEvents() {
        // 그룹별 바인딩 메서드를 원래 순서대로 호출한다.
        // ⚠️ 일부 메서드는 초기화 부작용(AddressManager 인스턴스화·addParcel·드롭다운 채우기)을
        //    포함하므로 호출 순서를 바꾸면 안 된다(SLS-1-106 zero-move 분해).
        this._initFormControls();
        this._bindParcelContainerEvents();
        this._bindCropAreaModalEvents();
        this._bindTableEvents();
        this._bindViewToggle();
        this._bindSearchModal();
        this._bindBulkActions();
        this._bindStatisticsAndLegacyModals();
        this._bindExportImportAndIO();
        this._bindViewerAndResultModals();
        this._bindNavAndPagination();
    }

    _initFormControls() {
        // 시료 타입 네비게이션 선택
        const sampleTypeBtns = document.querySelectorAll('.type-btn');
        sampleTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                sampleTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.switchView('form');
            });
        });

        // 주소 검색 모듈
        this.addressManager = new window.AddressManager({
            searchBtn: document.getElementById('searchAddressBtn'),
            postcodeInput: this.addressPostcode,
            roadInput: this.addressRoad,
            detailInput: this.addressDetail,
            hiddenInput: this.addressHidden,
            modal: document.getElementById('addressModal'),
            closeBtn: document.getElementById('closeAddressModal'),
            container: document.getElementById('daumPostcodeContainer')
        });

        // 빈 상태 버튼
        const btnGoForm = document.querySelector('.btn-go-form');
        if (btnGoForm) btnGoForm.addEventListener('click', () => this.switchView('form'));

        const btnAddParcelEmpty = document.querySelector('.btn-add-parcel-empty');
        if (btnAddParcelEmpty) btnAddParcelEmpty.addEventListener('click', () => this.addParcel());

        // 구분 변경 시 접수번호 업데이트 (수정 모드에서는 원본 접수번호 유지)
        if (this.subCategorySelect) {
            this.subCategorySelect.addEventListener('change', (e) => {
                const isFill = e.target.value === '성토';
                if (this.receptionNumberInput && !this.editingLogId && !this.editingGroupId) {
                    this.receptionNumberInput.value = isFill
                        ? this.generateNextFillReceptionNumber()
                        : this.generateNextReceptionNumber();
                }
                this.updateParcelCardsMode(isFill);
            });
        }

        // 경지구분 1차 변경 시 접수번호를 해당 분류 기준으로 재추천 (수정 모드 제외)
        if (this.landClass1Select) {
            this.landClass1Select.addEventListener('change', () => {
                if (this.receptionNumberInput && !this.editingLogId && !this.editingGroupId) {
                    const isFill = this.subCategorySelect?.value === '성토';
                    this.receptionNumberInput.value = isFill
                        ? this.generateNextFillReceptionNumber()
                        : this.generateNextReceptionNumber();
                }
            });
        }

        // 초기 필지 1개 추가
        this.addParcel();

        // 접수번호 변경 시 모든 필지 번호 업데이트
        if (this.receptionNumberInput) {
            this.receptionNumberInput.addEventListener('input', () => this.updateAllParcelNumbers());
        }

        // 필지 추가 버튼
        if (this.addParcelBtn) {
            this.addParcelBtn.addEventListener('click', () => this.addParcel());
        }

    }

    _bindParcelContainerEvents() {
        // 필지 컨테이너 이벤트 위임
        if (this.parcelsContainer) {
            this.parcelsContainer.addEventListener('click', (e) => this._onParcelContainerClick(e));

            this.parcelsContainer.addEventListener('input', (e) => {
                if (e.target.classList.contains('lot-address-input')) {
                    const parcelId = e.target.dataset.id;
                    const parcel = this.parcels.find(p => p.id === parcelId);
                    parcel._tempLotAddress = e.target.value;
                    parcel.lotAddress = e.target.value;
                    this.updateParcelsData();
                }
                if (e.target.classList.contains('area-direct-input')) {
                    this.updateFirstCrop(e.target.dataset.id);
                }
                if (e.target.classList.contains('parcel-note-input')) {
                    const parcelId = e.target.dataset.id;
                    const parcel = this.parcels.find(p => p.id === parcelId);
                    if (parcel) { parcel.note = e.target.value; this.updateParcelsData(); }
                }
            });

            this.parcelsContainer.addEventListener('blur', (e) => {
                if (e.target.classList.contains('parcel-note-input')) {
                    const parcel = this.parcels.find(p => p.id === e.target.dataset.id);
                    if (parcel) { parcel.note = e.target.value; this.updateParcelsData(); }
                }
                if (e.target.classList.contains('lot-address-input')) {
                    const parcel = this.parcels.find(p => p.id === e.target.dataset.id);
                    if (parcel) { parcel.lotAddress = e.target.value.trim(); this.updateParcelsData(); }
                }
            }, true);

            // (산 필지 토글 핸들러는 위쪽 click 위임에 통합됨)

            this.parcelsContainer.addEventListener('keypress', (e) => {
                if (e.target.classList.contains('sub-lot-input') && e.key === 'Enter') {
                    e.preventDefault();
                    const addBtn = document.querySelector(`.btn-add-sub-lot-icon[data-id="${e.target.dataset.id}"]`);
                    if (addBtn) addBtn.click();
                }
            });
        }

    }

    /**
     * 필지 컨테이너 click 위임 핸들러 (필지/하위필지/작물 삭제·추가, 산 토글).
     */
    _onParcelContainerClick(e) {
        const target = e.target;
        if (target.classList.contains('btn-remove-parcel')) {
            this.removeParcel(target.dataset.id);
        }
        if (target.classList.contains('btn-add-sub-lot-icon')) {
            const parcelId = target.dataset.id;
            const input = document.querySelector(`.sub-lot-input[data-id="${parcelId}"]`);
            const value = input.value.trim();
            if (value) {
                const parcel = this.parcels.find(p => p.id === parcelId);
                parcel.subLots.push({ lotAddress: value, crops: [] });
                this.updateSubLotsDisplay(parcelId);
                this.updateParcelSummary(parcelId);
                this.updateParcelsData();
                input.value = '';
            }
        }
        if (target.classList.contains('remove-sub-lot')) {
            const subLotIndex = parseInt(target.dataset.index, 10);
            const container = target.closest('.sub-lots-container');
            const parcelId = container.id.replace('subLots-', '');
            const parcel = this.parcels.find(p => p.id === parcelId);
            parcel.subLots.splice(subLotIndex, 1);
            this.updateSubLotsDisplay(parcelId);
            this.updateParcelSummary(parcelId);
            this.updateParcelsData();
        }
        if (target.classList.contains('btn-add-sublot-crop')) {
            this.openSubLotCropModal(target.dataset.parcelId, parseInt(target.dataset.sublotIndex, 10));
        }
        if (target.classList.contains('remove-sublot-crop')) {
            const subLotIndex = parseInt(target.dataset.sublotIndex, 10);
            const cropIndex = parseInt(target.dataset.cropIndex, 10);
            const container = target.closest('.sub-lots-container');
            const parcelId = container.id.replace('subLots-', '');
            const parcel = this.parcels.find(p => p.id === parcelId);
            if (parcel.subLots[subLotIndex] && parcel.subLots[subLotIndex].crops) {
                parcel.subLots[subLotIndex].crops.splice(cropIndex, 1);
                this.updateSubLotsDisplay(parcelId);
                this.updateParcelSummary(parcelId);
                this.updateParcelsData();
            }
        }
        if (target.classList.contains('btn-add-crop-area') || target.classList.contains('btn-add-crop-compact')) {
            this.openCropAreaModal(target.dataset.id);
        }
        if (target.classList.contains('remove-crop-area')) {
            const item = target.closest('.crop-area-item');
            const container = target.closest('.crops-area-container');
            if (!container) return;
            const parcelId = container.id.replace('cropsArea-', '');
            const index = parseInt(item.dataset.index, 10);
            const parcel = this.parcels.find(p => p.id === parcelId);
            if (parcel && parcel.crops[index]) {
                parcel.crops.splice(index, 1);
                this.updateCropsAreaDisplay(parcelId);
                this.updateParcelSummary(parcelId);
                this.updateParcelsData();
            }
        }
        // 산 필지 토글 버튼 (한 번 누르면 ON, 다시 누르면 OFF)
        const mountainBtn = target.closest('.mountain-btn');
        if (mountainBtn) {
            e.preventDefault();
            const parcelId = mountainBtn.dataset.id;
            const next = mountainBtn.dataset.active !== 'true';
            const parcel = this.parcels.find(p => p.id === parcelId);
            if (parcel) { parcel.isMountain = next; this.updateParcelsData(); }
            this.applyMountainToggleStyle(parcelId, next);
        }
    }

    _bindCropAreaModalEvents() {
        // 작물 모달 이벤트
        if (this.closeCropAreaModalBtn) this.closeCropAreaModalBtn.addEventListener('click', () => this.closeCropAreaModalFn());
        if (this.cancelCropAreaBtn) this.cancelCropAreaBtn.addEventListener('click', () => this.closeCropAreaModalFn());
        if (this.cropAreaModal) {
            const overlay = this.cropAreaModal.querySelector('.modal-overlay');
            if (overlay) overlay.addEventListener('click', () => this.closeCropAreaModalFn());
        }
        if (this.addCropAreaBtn) this.addCropAreaBtn.addEventListener('click', () => {
            this.tempCropAreas.push({ name: '', area: '', code: '' });
            this.renderCropAreaModal();
        });
        if (this.confirmCropAreaBtn) this.confirmCropAreaBtn.addEventListener('click', () => this.confirmCropArea());

    }

    _bindTableEvents() {
        // 테이블 이벤트 위임
        if (this.tableBody) {
            this.tableBody.addEventListener('click', (e) => this._onTableBodyClick(e));

            // 체크박스 이벤트
            this.tableBody.addEventListener('change', (e) => this._onTableBodyChange(e));
        }

        // 전체 선택 체크박스
        if (this.selectAllCheckbox) {
            this.selectAllCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const rowCheckboxes = this.tableBody.querySelectorAll('.row-checkbox');
                rowCheckboxes.forEach(cb => { cb.checked = isChecked; });
                this.updateSelectedCount();
            });
        }

        // 성명 클릭 시 같은 이름 일괄 선택
        if (this.tableBody) {
            this.tableBody.addEventListener('click', (e) => {
                const nameCell = e.target.closest('.col-name');
                if (nameCell && nameCell.dataset.farmerKey) {
                    this.selectByName(nameCell.dataset.farmerKey);
                }
            });
        }

        // 전역 등록
        window.getSelectedIds = () => this.getSelectedIds();

    }

    /**
     * 완료 상태 변경을 해당 id의 테이블 행(들)에 즉시 반영한다 (row-completed 클래스, 완료 버튼 아이콘/타이틀).
     * 재필터링(filterAndRenderLogs) 없이 DOM만 패치하므로, 완료 필터가 "미완료"인 화면에서도
     * 방금 처리한 행이 즉시 사라지지 않는다. 개별 완료·일괄 완료 두 경로가 공유하는 SSOT.
     */
    _patchCompletionDom(logId, newStatus) {
        const rows = this.tableBody.querySelectorAll(`tr[data-id="${logId}"]`);
        rows.forEach(row => {
            const button = row.querySelector('.btn-complete');
            if (!button) return;
            row.classList.toggle('row-completed', newStatus);
            button.classList.toggle('completed', newStatus);
            button.textContent = newStatus ? '✔' : '';
            button.title = newStatus ? '완료 취소' : '완료';
        });
    }

    /**
     * 테이블 body click 위임 핸들러 (완료 토글·삭제·수정).
     */
    _onTableBodyClick(e) {
        const completeBtn = e.target.closest('.btn-complete');
        if (completeBtn) {
            const id = completeBtn.dataset.id;
            const log = this.sampleLogs.find(l => String(l.id) === id);
            if (log) {
                const newCompletedStatus = !log.isComplete;
                const receptionNumber = log.receptionNumber || '';
                // 본필지+하위필지 연동: 같은 본번(F접두/일반 분리) 그룹 전체를 함께 토글.
                // 503, 503-1, 503-2 → 같은 그룹 / 503 ↔ F503 → 별개 그룹 (ReceptionGroup SSOT)
                const relatedLogs = window.ReceptionGroup.findRelatedLogs(this.sampleLogs, receptionNumber);
                relatedLogs.forEach(relatedLog => {
                    relatedLog.isComplete = newCompletedStatus;
                    relatedLog.updatedAt = new Date().toISOString();
                    this._patchCompletionDom(relatedLog.id, newCompletedStatus);
                });
                this.persistRecords(relatedLogs);
                const count = relatedLogs.length;
                if (newCompletedStatus) {
                    this.showToast(count > 1 ? `${count}개 시료가 완료 처리되었습니다` : '완료 처리되었습니다', 'success');
                } else {
                    this.showToast(count > 1 ? `${count}개 시료가 완료 취소되었습니다` : '완료 취소되었습니다', 'success');
                }
            }
        }

        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const targetLog = this.sampleLogs.find(log => String(log.id) === String(id));

            if (targetLog?.groupId) {
                const groupLogs = this.sampleLogs.filter(log => log.groupId === targetLog.groupId);

                if (groupLogs.length > 1) {
                    const baseNumber = (targetLog.receptionNumber || '').split('-')[0];
                    const numbers = groupLogs.map(l => l.receptionNumber).join(', ');
                    const choice = confirm(
                        `같은 접수 그룹(${numbers})이 ${groupLogs.length}건 있습니다.\n` +
                        `[확인] 그룹 전체 삭제 (삭제 후 ${baseNumber}번으로 재입력 가능)\n` +
                        `[취소] 이 항목만 삭제`
                    );

                    if (choice) {
                        this.deleteGroup(targetLog.groupId, baseNumber);
                    } else {
                        this.deleteSample(id, targetLog.receptionNumber);
                    }
                    return;
                }
            }

            if (confirm('정말 삭제하시겠습니까?')) {
                this.deleteSample(id, targetLog?.receptionNumber);
            }
        }

        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) {
            this.editSample(editBtn.dataset.id);
        }
    }

    /**
     * 테이블 body change 위임 핸들러 (행 체크박스·공익직불제 차수/기준년도).
     */
    _onTableBodyChange(e) {
        if (e.target.classList.contains('row-checkbox')) {
            this.updateSelectAllState();
            this.updateSelectedCount();
            return;
        }
        // 공익직불제 전용: 차수/기준년도 행별 편집
        const isOrder = e.target.classList.contains('gongik-order-select');
        const isBaseYear = e.target.classList.contains('gongik-baseyear-select');
        if (isOrder || isBaseYear) {
            const id = e.target.dataset.id;
            const log = this.sampleLogs.find(l => l.id === id);
            if (log) {
                const val = e.target.value;
                if (isOrder) log.gongikOrder = val;
                else log.gongikBaseYear = val;
                log.updatedAt = new Date().toISOString();
                this.persistRecords(log);
                // 같은 log가 여러 행(필지)으로 펼쳐진 경우 형제 select 값 동기화
                const cls = isOrder ? 'gongik-order-select' : 'gongik-baseyear-select';
                this.tableBody.querySelectorAll(`.${cls}[data-id="${id}"]`).forEach(sel => {
                    if (sel !== e.target) sel.value = val;
                });
            }
        }
    }

    _bindViewToggle() {
        // 전체 보기/기본 보기 토글
        const viewToggleBtn = document.getElementById('viewToggleBtn');
        if (viewToggleBtn) {
            viewToggleBtn.addEventListener('click', () => {
                // SLS-1-278: 열이 늘고 줄면 그 뒤 일반 열이 전부 밀린다(실측 +151px).
                // 바꾸기 전에 기준을 잡아 두고 바꾼 뒤에 되돌린다.
                const restoreColumnAnchor = window.captureColumnAnchor?.(this.logTable);

                this.isFullView = !this.isFullView;
                const toggleText = viewToggleBtn.querySelector('.toggle-text');
                const toggleIcon = viewToggleBtn.querySelector('.toggle-icon');
                if (this.isFullView) {
                    if (this.logTable) this.logTable.classList.add('full-view');
                    if (toggleText) toggleText.textContent = '기본 보기';
                    if (toggleIcon) toggleIcon.textContent = '👁️‍🗨️';
                    viewToggleBtn.classList.add('active');
                } else {
                    if (this.logTable) this.logTable.classList.remove('full-view');
                    if (toggleText) toggleText.textContent = '전체 보기';
                    if (toggleIcon) toggleIcon.textContent = '👁️';
                    viewToggleBtn.classList.remove('active');
                }
                // 🚨 순서가 중요하다. 보던 열을 **먼저** 제자리로 돌리고,
                //    고정 열 좌표는 그 뒤에 잰다. 반대로 하면 보정 전 위치에서
                //    재게 되고, 그 값이 그대로 굳는다 (SLS-1-275의 latch 사고).
                restoreColumnAnchor?.();

                // SLS-1-264: 열이 늘고 준다. 이 토글은 목록을 다시 그리지 않으므로
                // 여기서 직접 불러야 고정 좌표가 따라간다.
                window.scheduleStickyColumns?.(this.logTable);
            });
        }

    }

    _bindSearchModal() {
        // 검색 모달
        const openSearchModalBtn = document.getElementById('openSearchModalBtn');
        const closeSearchModalBtn = document.getElementById('closeSearchModal');
        const searchDateFromInput = document.getElementById('searchDateFromInput');
        const searchDateToInput = document.getElementById('searchDateToInput');
        const searchNameInput = document.getElementById('searchNameInput');
        const searchReceptionFromInput = document.getElementById('searchReceptionFromInput');
        const searchReceptionToInput = document.getElementById('searchReceptionToInput');
        const searchLotInput = document.getElementById('searchLotInput');
        const clearSearchDateBtn = document.getElementById('clearSearchDate');
        const clearSearchReceptionBtn = document.getElementById('clearSearchReception');
        const clearSearchLotBtn = document.getElementById('clearSearchLot');
        const resetSearchBtn = document.getElementById('resetSearchBtn');
        const applySearchBtn = document.getElementById('applySearchBtn');
        const purposeFilter = document.getElementById('purposeFilter');
        const completedFilter = document.getElementById('completedFilter');

        this._bindSearchFilterControls(purposeFilter, completedFilter);

        if (openSearchModalBtn) {
            openSearchModalBtn.addEventListener('click', () => {
                if (searchDateFromInput) searchDateFromInput.value = this.currentSearchFilter.dateFrom;
                if (searchDateToInput) searchDateToInput.value = this.currentSearchFilter.dateTo;
                if (searchNameInput) searchNameInput.value = this.currentSearchFilter.name;
                if (searchReceptionFromInput) searchReceptionFromInput.value = this.currentSearchFilter.receptionFrom;
                if (searchReceptionToInput) searchReceptionToInput.value = this.currentSearchFilter.receptionTo;
                if (searchLotInput) searchLotInput.value = this.currentSearchFilter.lot;
                if (this.listSearchModal) this.listSearchModal.classList.remove('hidden');
                if (searchNameInput) searchNameInput.focus();
            });
        }

        const closeSearchModal = () => { if (this.listSearchModal) this.listSearchModal.classList.add('hidden'); };
        if (closeSearchModalBtn) closeSearchModalBtn.addEventListener('click', closeSearchModal);
        if (this.listSearchModal) {
            const overlay = this.listSearchModal.querySelector('.modal-overlay');
            if (overlay) overlay.addEventListener('click', closeSearchModal);
        }

        if (clearSearchDateBtn) clearSearchDateBtn.addEventListener('click', () => {
            if (searchDateFromInput) searchDateFromInput.value = '';
            if (searchDateToInput) searchDateToInput.value = '';
        });
        if (clearSearchReceptionBtn) clearSearchReceptionBtn.addEventListener('click', () => {
            if (searchReceptionFromInput) searchReceptionFromInput.value = '';
            if (searchReceptionToInput) searchReceptionToInput.value = '';
        });
        if (clearSearchLotBtn) clearSearchLotBtn.addEventListener('click', () => {
            if (searchLotInput) searchLotInput.value = '';
        });

        if (resetSearchBtn) {
            resetSearchBtn.addEventListener('click', () => {
                if (searchDateFromInput) searchDateFromInput.value = '';
                if (searchDateToInput) searchDateToInput.value = '';
                if (searchNameInput) searchNameInput.value = '';
                if (searchReceptionFromInput) searchReceptionFromInput.value = '';
                if (searchReceptionToInput) searchReceptionToInput.value = '';
                if (searchLotInput) searchLotInput.value = '';
                if (purposeFilter) purposeFilter.value = '';
                if (completedFilter) completedFilter.value = 'incomplete';
                // 경지구분 1차 탭 선택은 고급검색 초기화 대상이 아니므로 유지
                this.currentSearchFilter = { dateFrom: '', dateTo: '', name: '', receptionFrom: '', receptionTo: '', lot: '', purpose: '', completed: 'incomplete', landClass1: this.currentSearchFilter.landClass1 || '' };
                this.filterAndRenderLogs();
                closeSearchModal();
            });
        }

        if (applySearchBtn) {
            applySearchBtn.addEventListener('click', () => {
                this.currentSearchFilter.dateFrom = searchDateFromInput?.value || '';
                this.currentSearchFilter.dateTo = searchDateToInput?.value || '';
                this.currentSearchFilter.name = (searchNameInput?.value || '').toLowerCase();
                this.currentSearchFilter.receptionFrom = searchReceptionFromInput?.value || '';
                this.currentSearchFilter.receptionTo = searchReceptionToInput?.value || '';
                this.currentSearchFilter.lot = (searchLotInput?.value || '').toLowerCase();
                this.filterAndRenderLogs();
                closeSearchModal();
            });
        }

        const searchInputs = [searchNameInput, searchReceptionFromInput, searchReceptionToInput, searchLotInput];
        searchInputs.forEach(input => {
            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && applySearchBtn) applySearchBtn.click();
                });
            }
        });

    }

    /**
     * 검색 모달의 목적/완료/경지구분 필터 및 공익직불제 일괄 적용 컨트롤 바인딩.
     */
    _bindSearchFilterControls(purposeFilter, completedFilter) {
        if (purposeFilter) {
            purposeFilter.addEventListener('change', (e) => {
                this.currentSearchFilter.purpose = e.target.value;
                this.filterAndRenderLogs();
            });
        }

        if (completedFilter) {
            completedFilter.addEventListener('change', (e) => {
                this.currentSearchFilter.completed = e.target.value;
                this.filterAndRenderLogs();
            });
        }

        // 경지구분 1차 목록 탭
        const landClass1Tab = document.getElementById('landClass1Tab');
        if (landClass1Tab) {
            landClass1Tab.addEventListener('change', (e) => {
                this.currentSearchFilter.landClass1 = e.target.value;
                this.filterAndRenderLogs();
            });
        }

        // 공익직불제 일괄 적용 바: 기준년도 옵션 채우기 + 적용 버튼
        const gbBaseYear = document.getElementById('gongikBulkBaseYear');
        if (gbBaseYear) {
            gbBaseYear.innerHTML = '<option value="">기준년도(선택)</option>'
                + GONGIK_BASE_YEAR_OPTIONS.map(v => `<option value="${v}">${v}</option>`).join('');
        }
        const gbApplyBtn = document.getElementById('gongikBulkApplyBtn');
        if (gbApplyBtn) gbApplyBtn.addEventListener('click', () => this.applyGongikBulk());
    }

    _bindBulkActions() {
        // 라벨 인쇄
        const btnLabelPrint = document.getElementById('btnLabelPrint');
        if (btnLabelPrint) {
            btnLabelPrint.addEventListener('click', () => {
                const selectedIds = this.getSelectedIds();
                if (selectedIds.length === 0) {
                    if (this.sampleLogs.length === 0) { alert('인쇄할 데이터가 없습니다.'); return; }
                    if (!confirm(`선택된 항목이 없습니다.\n전체 ${this.sampleLogs.length}건을 라벨 인쇄하시겠습니까?`)) return;
                    this.openLabelPrintWithData(this.sampleLogs);
                } else {
                    const selectedLogs = this.sampleLogs.filter(log => selectedIds.includes(String(log.id)));
                    this.openLabelPrintWithData(selectedLogs);
                }
            });
        }

        // 일괄 완료
        const btnBulkComplete = document.getElementById('btnBulkComplete');
        if (btnBulkComplete) {
            btnBulkComplete.addEventListener('click', () => {
                const selectedIds = this.getSelectedIds();
                if (selectedIds.length === 0) { alert('완료 처리할 항목을 선택해주세요.'); return; }

                // 연관 접수번호(같은 본번 + 성토여부) 포함한 실제 처리 대상 사전 계산 (ReceptionGroup SSOT)
                const targetIds = window.ReceptionGroup.computeBulkTargetIds(this.sampleLogs, selectedIds);
                // 선택 대상이 모두 완료 상태면 → 일괄 해제, 아니면 → 일괄 완료
                const allComplete = [...targetIds].every(id => {
                    const log = this.sampleLogs.find(l => String(l.id) === id);
                    return log?.isComplete === true;
                });
                const newStatus = !allComplete;
                const actionLabel = newStatus ? '완료 처리' : '완료 해제';

                const extraCount = targetIds.size - selectedIds.length;
                const confirmMsg = extraCount > 0
                    ? `선택한 ${selectedIds.length}건 + 연관 접수번호 ${extraCount}건 포함\n총 ${targetIds.size}건을 ${actionLabel}하시겠습니까?`
                    : `선택한 ${selectedIds.length}건을 ${actionLabel}하시겠습니까?`;
                if (!confirm(confirmMsg)) return;

                const now = new Date().toISOString();
                const changedLogs = [];
                this.sampleLogs.forEach(log => {
                    if (targetIds.has(String(log.id))) {
                        log.isComplete = newStatus;
                        log.updatedAt = now;
                        changedLogs.push(log);
                    }
                });
                this.persistRecords(changedLogs);
                changedLogs.forEach(log => this._patchCompletionDom(log.id, newStatus));
                this.updateRecordCount();
                this.tableBody.querySelectorAll('.row-checkbox:checked').forEach(cb => { cb.checked = false; });
                this.updateSelectAllState();
                this.updateSelectedCount();
                this.showToast(`${changedLogs.length}건이 ${actionLabel}되었습니다.`, 'success');
            });
        }

        // 선택 삭제
        const btnBulkDelete = document.getElementById('btnBulkDelete');
        if (btnBulkDelete) {
            btnBulkDelete.addEventListener('click', () => {
                const selectedIds = this.getSelectedIds();
                if (selectedIds.length === 0) { alert('삭제할 항목을 선택해주세요.'); return; }
                if (!confirm(`선택한 ${selectedIds.length}건을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
                this.sampleLogs = this.sampleLogs.filter(log => !selectedIds.includes(String(log.id)));
                this.saveLogs();
                this.firebaseDeleteRecords(selectedIds);
                this.filterAndRenderLogs();
                if (this.selectAllCheckbox) { this.selectAllCheckbox.checked = false; this.selectAllCheckbox.indeterminate = false; }
                if (selectedIds.map(String).includes(String(this.editingLogId))) this.cancelEditMode();
                this.showToast(`${selectedIds.length}건이 삭제되었습니다.`, 'success');
            });
        }

        this._bindBulkMailDate();
    }

    /**
     * 일괄 우편발송일자 모달 관련 이벤트 바인딩.
     */
    _bindBulkMailDate() {
        const btnBulkMailDate = document.getElementById('btnBulkMailDate');
        const closeMailDateModal = document.getElementById('closeMailDateModal');
        const cancelMailDateBtn = document.getElementById('cancelMailDateBtn');
        const confirmMailDateBtn = document.getElementById('confirmMailDateBtn');
        const mailDateInput = document.getElementById('mailDateInput');
        const mailDateInfo = document.getElementById('mailDateInfo');

        const closeMailDateModalFn = () => {
            if (this.mailDateModal) this.mailDateModal.classList.add('hidden');
            this.pendingMailDateIds = [];
        };

        if (closeMailDateModal) closeMailDateModal.addEventListener('click', closeMailDateModalFn);
        if (cancelMailDateBtn) cancelMailDateBtn.addEventListener('click', closeMailDateModalFn);
        if (this.mailDateModal) {
            const overlay = this.mailDateModal.querySelector('.modal-overlay');
            if (overlay) overlay.addEventListener('click', closeMailDateModalFn);
        }

        if (confirmMailDateBtn) {
            confirmMailDateBtn.addEventListener('click', () => {
                const inputDate = mailDateInput?.value;
                if (!inputDate) { this.showToast('날짜를 선택해주세요.', 'warning'); return; }
                let updatedCount = 0;
                const changedLogs = [];
                // in-place 갱신: 배열을 새 참조로 교체하지 않고 매칭 log 객체를 제자리에서 수정해
                // 외부 참조 고아화를 방지한다 (SLS-1-25 saveLogs in-place 취지와 통일)
                this.sampleLogs.forEach(log => {
                    if (this.pendingMailDateIds.includes(String(log.id))) {
                        updatedCount++;
                        log.mailDate = inputDate;
                        log.updatedAt = new Date().toISOString();
                        changedLogs.push(log);
                    }
                });
                this.persistRecords(changedLogs);
                this.filterAndRenderLogs();
                if (this.selectAllCheckbox) { this.selectAllCheckbox.checked = false; this.selectAllCheckbox.indeterminate = false; }
                closeMailDateModalFn();
                this.showToast(`${updatedCount}건의 발송일자가 입력되었습니다.`, 'success');
            });
        }

        if (btnBulkMailDate) {
            btnBulkMailDate.addEventListener('click', () => {
                const selectedIds = this.getSelectedIds();
                if (selectedIds.length === 0) { this.showToast('발송일자를 입력할 항목을 선택해주세요.', 'warning'); return; }
                this.pendingMailDateIds = selectedIds;
                const today = new Date().toISOString().split('T')[0];
                if (mailDateInput) mailDateInput.value = today;
                if (mailDateInfo) mailDateInfo.textContent = `선택한 ${selectedIds.length}건의 우편발송일자를 입력하세요.`;
                if (this.mailDateModal) this.mailDateModal.classList.remove('hidden');
            });
        }
    }

    _bindStatisticsAndLegacyModals() {
        // 통계
        const btnStatistics = document.getElementById('btnStatistics');
        const closeStatisticsModal = document.getElementById('closeStatisticsModal');
        const closeStatisticsBtn = document.getElementById('closeStatisticsBtn');

        if (btnStatistics) btnStatistics.addEventListener('click', () => this.openStatisticsModal());
        if (closeStatisticsModal) closeStatisticsModal.addEventListener('click', () => { if (this.statisticsModal) this.statisticsModal.classList.add('hidden'); });
        if (closeStatisticsBtn) closeStatisticsBtn.addEventListener('click', () => { if (this.statisticsModal) this.statisticsModal.classList.add('hidden'); });
        if (this.statisticsModal) {
            this.statisticsModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) this.statisticsModal.classList.add('hidden');
            });
        }

        // ⚠️ 작물 검색 모달 배선은 통째로 try/catch 안에 둔다 (SLS-1-228).
        //    여기서 예외가 나면 뒤따르는 _bindExportImportAndIO / _bindViewerAndResultModals /
        //    _bindNavAndPagination(:4159-4162)이 **하나도 실행되지 않는다.**
        //    접수 등록 버튼은 그 마지막 그룹에서 배선되므로(:4997), 조회 기능 하나 때문에
        //    접수 자체가 막힌다. 게다가 BaseSampleManager.init()의 전체 try/catch가
        //    예외를 삼켜 **아무 소리 없이** 그렇게 된다.
        try {
            this._bindCropSearchModal();
        } catch (err) {
            (window.logger?.error || console.error)('[작물검색] 배선 실패 — 기능만 비활성화합니다.', err);
            // 눌러도 안 되는 버튼을 남기지 않는다
            const btn = document.getElementById('cropSearchBtn');
            if (btn) btn.style.display = 'none';
        }
    }

    /**
     * 작물 검색 모달 (SLS-1-228) — **조회 전용**.
     *
     * 엑셀 서식에 작물명을 적을 때 정확한 이름을 찾아 복사하는 창구다.
     * 폼 입력 흐름(.crop-direct-input 자동완성, :1513-1556)은 건드리지 않는다.
     */
    _bindCropSearchModal() {
        const openBtn = document.getElementById('cropSearchBtn');
        const modal = document.getElementById('cropModal');
        const input = document.getElementById('cropSearchInput');
        const filter = document.getElementById('cropCategoryFilter');
        const listEl = document.getElementById('cropList');
        const countEl = document.getElementById('cropResultCount');
        if (!modal || !listEl) return;

        // ⚠️ ESC 핸들러는 **열 때 등록하고 닫을 때 해제**한다.
        //    전역에 남겨 두면 모달이 닫힌 뒤에도 ESC가 다른 화면에서 반응한다.
        //    (soil-result-importer.js:1127-1164와 같은 방식)
        const escHandler = (e) => { if (e.key === 'Escape') closeModal(); };

        const closeModal = () => {
            modal.classList.add('hidden');
            document.removeEventListener('keydown', escHandler);
        };

        const render = () => {
            const CS = window.CropSearch;
            // ⚠️ 열 때마다 window에서 다시 읽는다. 작물 데이터는 3계층으로 런타임에
            //    교체된다(crop-data-loader.js:175-180) — 캡처하면 갱신이 반영되지 않는다.
            const crops = Array.isArray(window.CROP_DATA) ? window.CROP_DATA : [];
            if (!CS) return;

            const r = CS.filterCrops(crops, {
                keyword: input ? input.value : '',
                category: filter ? filter.value : '전체',
            });

            listEl.innerHTML = '';
            for (const c of r.items) {
                const li = document.createElement('li');
                li.className = 'crop-row';
                li.dataset.name = c.name || '';
                li.title = '클릭하여 작물명 복사';
                // ⚠️ textContent만 쓴다. CROP_DATA는 사용자가 올린 .xlsx에서도 온다(SLS-1-179).
                const nameEl = document.createElement('span');
                nameEl.className = 'crop-row-name';
                nameEl.textContent = c.name || '';
                const catEl = document.createElement('span');
                catEl.className = 'crop-row-cat';
                catEl.textContent = c.category || '';
                const codeEl = document.createElement('span');
                codeEl.className = 'crop-row-code';
                codeEl.textContent = c.code || '';
                li.append(nameEl, catEl, codeEl);
                listEl.appendChild(li);
            }

            if (countEl) {
                // 자른 수만 적으면 "전체가 200개"로 읽혀 자기 작물이 없다고 오해한다
                countEl.textContent = r.truncated
                    ? `${r.items.length}개 표시 / 전체 ${r.total}개 — 검색으로 좁혀 주세요`
                    : `${r.total}개 작물`;
            }
        };

        /** 분류 옵션 재구성 — 로더가 CROP_CATEGORIES를 나중에 교체하므로 열 때마다 다시 만든다 */
        const rebuildCategories = () => {
            if (!filter) return;
            const CS = window.CropSearch;
            const prev = filter.value || '전체';
            const cats = CS
                ? CS.categoriesOf(window.CROP_DATA, window.CROP_CATEGORIES)
                : (Array.isArray(window.CROP_CATEGORIES) ? window.CROP_CATEGORIES : []);
            filter.innerHTML = '';
            const all = document.createElement('option');
            all.value = '전체';
            all.textContent = '전체 카테고리';
            filter.appendChild(all);
            for (const cat of cats) {
                if (cat === '전체') continue;
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                filter.appendChild(opt);
            }
            // 고르고 있던 분류는 유지한다 (다시 열었다고 초기화되면 성가시다)
            filter.value = cats.includes(prev) ? prev : '전체';
        };

        const openModal = () => {
            rebuildCategories();
            if (input) input.value = '';
            render();
            modal.classList.remove('hidden');
            document.addEventListener('keydown', escHandler);
            input?.focus();
        };

        if (openBtn) openBtn.addEventListener('click', openModal);
        input?.addEventListener('input', render);
        filter?.addEventListener('change', render);

        // 행 클릭 → 작물명 복사 (대상이 앱 밖의 엑셀이라 폼 채우기가 아니라 복사다)
        listEl.addEventListener('click', (e) => {
            const li = e.target.closest('li.crop-row');
            if (!li) return;
            const name = li.dataset.name || '';
            if (!name) return;
            // ⚠️ clipboard가 없는 환경에서는 writeText 호출 **자체가 동기 예외**라
            //    아래 .catch()가 돌지 않는다 — 아무 안내 없이 조용히 실패한다.
            //    복사가 전부인 기능이므로 먼저 막고 사유를 알린다.
            if (!navigator.clipboard?.writeText) {
                this.showToast('이 환경에서는 작물명 복사를 쓸 수 없습니다. 이름을 직접 옮겨 적어 주세요.', 'error');
                return;
            }
            navigator.clipboard.writeText(name).then(() => {
                this.showToast(`'${name}' 복사됨 — 엑셀에 붙여넣으세요.`, 'success');
            }).catch(() => {
                this.showToast('작물명 복사에 실패했습니다.', 'error');
            });
        });

        document.getElementById('closeCropModal')?.addEventListener('click', closeModal);
        document.getElementById('cancelCropSelection')?.addEventListener('click', closeModal);
        modal.querySelector('.modal-overlay')?.addEventListener('click', closeModal);
    }

    _bindExportImportAndIO() {
        // 엑셀 내보내기
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.addEventListener('click', () => {
            this.exportToExcel();
        });

        // JSON 저장/불러오기
        const saveJsonBtn = document.getElementById('saveJsonBtn');
        const loadJsonInput = document.getElementById('loadJsonInput');

        SampleUtils.setupJSONSaveHandler({
            buttonElement: saveJsonBtn,
            sampleType: SAMPLE_TYPE,
            getData: () => this.sampleLogs,
            FileAPI: this.FileAPI,
            filePrefix: '시료접수대장',
            showToast: (msg, type) => this.showToast(msg, type)
        });

        SampleUtils.setupJSONLoadHandler({
            inputElement: loadJsonInput,
            getData: () => this.sampleLogs,
            setData: (data) => { this.sampleLogs = data; },
            saveData: () => { this.saveLogs(); this.firebaseBatchSync(); },
            renderData: () => this.filterAndRenderLogs(),
            showToast: (msg, type) => this.showToast(msg, type),
            deduplicateById: true
        });

        // 자동 저장 설정
        SampleUtils.setupAutoSaveFolderButton({
            moduleKey: 'soil',
            FileAPI: this.FileAPI,
            selectedYear: this.selectedYear,
            getWebFileHandle: () => this.autoSaveFileHandle,
            setWebFileHandle: (handle) => { this.autoSaveFileHandle = handle; },
            autoSaveCallback: () => this.autoSaveToFile(),
            showToast: (msg, type) => this.showToast(msg, type)
        });

        SampleUtils.setupAutoSaveToggle({
            moduleKey: 'soil',
            FileAPI: this.FileAPI,
            getWebFileHandle: () => this.autoSaveFileHandle,
            setWebFileHandle: (handle) => { this.autoSaveFileHandle = handle; },
            autoSaveCallback: () => this.autoSaveToFile(),
            showToast: (msg, type) => this.showToast(msg, type),
            log: (...args) => this.log(...args)
        });

        // 흙토람 내보내기 버튼 (별도 창으로 열기)
        const heuktoramBtn = document.getElementById('heuktoramBtn');
        if (heuktoramBtn) heuktoramBtn.addEventListener('click', () => {
            const selectedIds = this.getSelectedIds();
            // SLS-1-198: labelPrintData와 동일한 "setItem → 이동" 패턴 — quota 상태에서
            // throw하면 흙토람 창 열기가 아무 반응 없이 죽는다. 실패를 알리고 중단한다.
            try {
                localStorage.setItem('heuktoram_year', this.selectedYear);
                localStorage.setItem('heuktoram_selected_ids', JSON.stringify(selectedIds));
            } catch (e) {
                if (e.name === 'QuotaExceededError' || e.code === 22) {
                    this.showToast('저장 공간 부족으로 흙토람 데이터를 전달하지 못했습니다. 설정에서 오래된 연도의 데이터를 정리해 주세요.', 'error');
                    return;
                }
                throw e;
            }

            const isElectron = window.electronAPI?.isElectron === true;
            if (isElectron) {
                window.electronAPI.openHeuktoram();
            } else {
                const popup = window.open('../heuktoram/index.html', '_blank');
                if (!popup) {
                    window.location.href = '../heuktoram/index.html';
                }
            }

            // H-2: 흙토람 로드 실패 시 잔류 데이터 정리 (5초 후)
            setTimeout(() => {
                localStorage.removeItem('heuktoram_year');
                localStorage.removeItem('heuktoram_selected_ids');
            }, 5000);
        });

    }

    _bindViewerAndResultModals() {
        // 전체화면 뷰어
        const openViewerBtn = document.getElementById('openViewerBtn');
        if (openViewerBtn) {
            openViewerBtn.addEventListener('click', () => {
                const viewerWindow = window.open('viewer.html', 'DataViewer', 'width=1400,height=800,scrollbars=yes,resizable=yes');
                if (!viewerWindow) alert('팝업이 차단되었습니다.\n브라우저 설정에서 팝업을 허용해주세요.');
            });
        }

        // 등록 결과 모달 이벤트
        const closeRegistrationModal = document.getElementById('closeRegistrationModal');
        const closeResultBtn = document.getElementById('closeResultBtn');
        const exportResultBtn = document.getElementById('exportResultBtn');
        const editResultBtn = document.getElementById('editResultBtn');

        if (closeRegistrationModal) closeRegistrationModal.addEventListener('click', () => this.closeRegistrationResultModal());
        if (closeResultBtn) closeResultBtn.addEventListener('click', () => this.closeRegistrationResultModal());
        if (this.registrationResultModal) {
            const overlay = this.registrationResultModal.querySelector('.modal-overlay');
            if (overlay) overlay.addEventListener('click', () => this.closeRegistrationResultModal());
        }
        if (editResultBtn) {
            editResultBtn.addEventListener('click', () => {
                if (this.currentRegistrationData) {
                    const dataToEdit = this.currentRegistrationData;
                    this.closeRegistrationResultModal();
                    this.populateFormForEdit(dataToEdit);
                }
            });
        }
        if (exportResultBtn) exportResultBtn.addEventListener('click', () => this.exportRegistrationResult());

        // 지역 선택 모달 이벤트
        const closeRegionModal = document.getElementById('closeRegionModal');
        const cancelRegionSelection = document.getElementById('cancelRegionSelection');
        if (closeRegionModal) closeRegionModal.addEventListener('click', () => this.closeRegionSelectionModal());
        if (cancelRegionSelection) cancelRegionSelection.addEventListener('click', () => this.closeRegionSelectionModal());
        if (this.regionSelectionModal) {
            const overlay = this.regionSelectionModal.querySelector('.modal-overlay');
            if (overlay) overlay.addEventListener('click', () => this.closeRegionSelectionModal());
        }

    }

    _bindNavAndPagination() {
        // 네비게이션 바 버튼
        if (this.navResetBtn) this.navResetBtn.addEventListener('click', () => this.resetFormKeepReceptionInfo());
        if (this.navSubmitBtn) this.navSubmitBtn.addEventListener('click', () => this.form.requestSubmit());

        // 페이지네이션 이벤트
        if (this.firstPageBtn) this.firstPageBtn.addEventListener('click', () => this.goToPage(1));
        if (this.prevPageBtn) this.prevPageBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        if (this.nextPageBtn) this.nextPageBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        if (this.lastPageBtn) this.lastPageBtn.addEventListener('click', () => this.goToPage(this.totalPages));
        if (this.itemsPerPageSelect) {
            this.itemsPerPageSelect.addEventListener('change', (e) => {
                this.itemsPerPage = parseInt(e.target.value, 10);
                localStorage.setItem('soilItemsPerPage', this.itemsPerPage);
                this.currentPage = 1;
                this.filterAndRenderLogs();
            });
        }
    }

    // ========================================
    // 엑셀 내보내기
    // ========================================

    exportToExcel() {
        // 현재 경지구분 1차 탭 기준 데이터로 내보내기 (선택 항목이 있으면 그 항목 우선)
        const tabLogs = this.getTabFilteredLogs();
        if (tabLogs.length === 0) { alert('내보낼 데이터가 없습니다.'); return; }
        const selectedIds = this.getSelectedIds();
        const logsToExport = selectedIds.length > 0
            ? tabLogs.filter(log => selectedIds.includes(String(log.id))) : tabLogs;
        if (selectedIds.length > 0) this.showToast(`선택한 ${logsToExport.length}건을 내보냅니다.`, 'info');

        const reversedLogs = [...logsToExport].sort((a, b) => {
            const partsA = (a.receptionNumber || '').replace(/^F/, '').split('-').map(Number);
            const partsB = (b.receptionNumber || '').replace(/^F/, '').split('-').map(Number);
            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                const va = partsA[i] || 0;
                const vb = partsB[i] || 0;
                if (va !== vb) return va - vb;
            }
            return 0;
        });
        const excelData = [];

        reversedLogs.forEach(log => {
            const addressParts = parseAddressParts(log.addressRoad || log.address || '');
            const fullAddress = [log.addressRoad, log.addressDetail].filter(Boolean).join(' ') || '-';
            if (log.parcels && log.parcels.length > 0) {
                log.parcels.forEach((parcel) => {
                    const cropsDisplay = parcel.crops && parcel.crops.length > 0
                        ? parcel.crops.map(c => c.name).join(', ') : '-';
                    const totalArea = parcel.crops ? parcel.crops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0) : 0;
                    const excelLotAddress = parcel.lotAddress ? (parcel.isMountain ? `${parcel.lotAddress} (산)` : parcel.lotAddress) : '-';
                    excelData.push({
                        '접수번호': log.receptionNumber, '접수일자': log.date, '구분': log.subCategory || '-',
                        '경지구분1차': log.landClass1 || LAND_CLASS1_DEFAULT,
                        '목적(용도)': parcel.purpose || log.purpose || '-', '성명': log.name, '전화번호': log.phoneNumber,
                        '시도': addressParts.sido || '-', '시군구': addressParts.sigungu || '-',
                        '읍면동': addressParts.eupmyeondong || '-', '나머지주소': addressParts.rest || '-',
                        '전체주소': fullAddress, '필지 주소': excelLotAddress, '작물': cropsDisplay,
                        '면적(m²)': totalArea > 0 ? totalArea : '-', '수령 방법': log.receptionMethod || '-',
                        '비고': log.note || '-', '완료여부': log.isComplete ? '완료' : '미완료',
                        '등록일시': log.createdAt ? new Date(log.createdAt).toLocaleString('ko-KR') : '-'
                    });
                    if (parcel.subLots && parcel.subLots.length > 0) {
                        parcel.subLots.forEach((subLot, sIdx) => {
                            const subLotAddress = typeof subLot === 'string' ? subLot : subLot.lotAddress;
                            const subLotCrops = typeof subLot === 'string' ? [] : (subLot.crops || []);
                            const subLotCropsDisplay = subLotCrops.length > 0 ? subLotCrops.map(c => c.name).join(', ') : '-';
                            const subLotTotalArea = subLotCrops.length > 0 ? subLotCrops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0) : 0;
                            excelData.push({
                                '접수번호': window.SoilLogRecord.subLotDisplayNumber(log, sIdx), '접수일자': log.date,
                                '구분': log.subCategory || '-', '경지구분1차': log.landClass1 || LAND_CLASS1_DEFAULT,
                                '목적(용도)': parcel.purpose || log.purpose || '-',
                                '성명': log.name, '전화번호': log.phoneNumber, '시도': addressParts.sido || '-',
                                '시군구': addressParts.sigungu || '-', '읍면동': addressParts.eupmyeondong || '-',
                                '나머지주소': addressParts.rest || '-', '전체주소': fullAddress,
                                '필지 주소': subLotAddress, '작물': subLotCropsDisplay,
                                '면적(m²)': subLotTotalArea > 0 ? subLotTotalArea : '-',
                                '수령 방법': log.receptionMethod || '-', '비고': log.note || '-',
                                '완료여부': log.isComplete ? '완료' : '미완료',
                                '등록일시': log.createdAt ? new Date(log.createdAt).toLocaleString('ko-KR') : '-'
                            });
                        });
                    }
                });
            } else {
                excelData.push({
                    '접수번호': log.receptionNumber, '접수일자': log.date, '구분': log.subCategory || '-',
                    '경지구분1차': log.landClass1 || LAND_CLASS1_DEFAULT,
                    '목적(용도)': log.purpose || '-', '성명': log.name, '전화번호': log.phoneNumber,
                    '시도': addressParts.sido || '-', '시군구': addressParts.sigungu || '-',
                    '읍면동': addressParts.eupmyeondong || '-', '나머지주소': addressParts.rest || '-',
                    '전체주소': fullAddress, '필지 주소': log.lotAddress || '-',
                    '작물': log.cropsDisplay || '-', '면적(m²)': log.area || '-',
                    '수령 방법': log.receptionMethod || '-', '비고': log.note || '-',
                    '완료여부': log.isComplete ? '완료' : '미완료',
                    '등록일시': log.createdAt ? new Date(log.createdAt).toLocaleString('ko-KR') : '-'
                });
            }
        });

        // 코드리뷰 MINOR-4: 시트 분리로 실패 표면이 1 → N+1로 늘었다. throw가 클릭 핸들러
        // 밖으로 나가면 무반응으로 죽으므로(198이 labelPrintData에서 고친 그 양식) 안내한다.
        try {
            const wb = this._buildExportWorkbook(excelData);
            const today = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `토양_접수대장_${today}.xlsx`);
        } catch (e) {
            (window.logger?.error || console.error)('엑셀 내보내기 실패:', e);
            this.showToast('엑셀 파일을 만들지 못했습니다. 경지구분 값에 사용할 수 없는 문자가 있는지 확인해 주세요.', 'error');
        }
    }

    /**
     * SLS-1-199: 접수대장 워크북 조립 — 첫 시트는 전체 목록(하위 호환),
     * 이후 경지구분1차별 시트. 순서는 LAND_CLASS1_OPTIONS 순 → 목록 외 값(가져오기 유래)은
     * 데이터 등장 순. 시트명은 window.SheetName.sanitizeSheetName으로 정규화한다.
     * @param {Array<Object>} excelData - '경지구분1차' 필드가 채워진 행 배열
     * @returns {Object} XLSX workbook
     */
    _buildExportWorkbook(excelData) {
        const EXPORT_COLS = [
            { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 },
            { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 30 }, { wch: 15 },
            { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 18 }
        ];
        const wb = XLSX.utils.book_new();
        const usedSheetNames = new Set();
        const appendSheet = (rows, name) => {
            const ws = XLSX.utils.json_to_sheet(sanitizeExcelData(rows));
            // 배열 참조 공유 방지 — 향후 시트별 너비 조정이 전 시트에 전파되지 않도록 복사
            ws['!cols'] = EXPORT_COLS.map(c => ({ ...c }));
            XLSX.utils.book_append_sheet(wb, ws, window.SheetName.sanitizeSheetName(name, usedSheetNames));
        };

        appendSheet(excelData, '시료접수대장');   // 전체 (기존과 동일)

        // '경지구분1차'는 excelData 생성 3곳 모두 landClass1 || LAND_CLASS1_DEFAULT로 채우므로
        // 빈 행이 없다 — 폴백은 방어용
        const groups = new Map();
        excelData.forEach(row => {
            const key = row['경지구분1차'] || LAND_CLASS1_DEFAULT;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(row);
        });
        const orderedKeys = [
            ...LAND_CLASS1_OPTIONS.filter(k => groups.has(k)),
            ...[...groups.keys()].filter(k => !LAND_CLASS1_OPTIONS.includes(k))
        ];
        // 코드리뷰 MAJOR-1: 그룹이 1종이면 전체 시트와 내용이 동일하다 — 특히 기본 탭이
        // '농가의뢰'라 탭을 바꾸지 않은 대다수 사용자가 무의미한 중복 시트 2장을 받게 된다.
        // 분리는 구분이 2종 이상일 때(사실상 '전체' 탭 내보내기)만 발동한다.
        if (orderedKeys.length <= 1) return wb;
        orderedKeys.forEach(key => appendSheet(groups.get(key), key));
        return wb;
    }

    // ========================================
    // 등록 결과 엑셀 내보내기
    // ========================================

    exportRegistrationResult() {
        if (!this.currentRegistrationData) return;
        const formatArea = this.formatArea || window.SampleUtils?.formatArea || ((v) => v);
        const excelData = [];
        excelData.push({ '항목': '접수번호', '내용': this.currentRegistrationData.receptionNumber });
        excelData.push({ '항목': '접수일자', '내용': this.currentRegistrationData.date });
        excelData.push({ '항목': '구분', '내용': this.currentRegistrationData.subCategory || '-' });
        excelData.push({ '항목': '목적 (용도)', '내용': this.currentRegistrationData.purpose || '-' });
        excelData.push({ '항목': '성명', '내용': this.currentRegistrationData.name });
        excelData.push({ '항목': '전화번호', '내용': this.currentRegistrationData.phoneNumber });
        excelData.push({ '항목': '주소', '내용': this.currentRegistrationData.address || '-' });
        excelData.push({ '항목': '수령 방법', '내용': this.currentRegistrationData.receptionMethod || '-' });
        excelData.push({ '항목': '비고', '내용': this.currentRegistrationData.note || '-' });

        if (this.currentRegistrationData.parcels && this.currentRegistrationData.parcels.length > 0) {
            excelData.push({ '항목': '', '내용': '' });
            excelData.push({ '항목': '=== 필지 정보 ===', '내용': '' });
            this.currentRegistrationData.parcels.forEach((parcel, idx) => {
                excelData.push({ '항목': `필지 ${idx + 1}`, '내용': parcel.lotAddress });
                if (parcel.subLots && parcel.subLots.length > 0) {
                    excelData.push({ '항목': '  하위 필지', '내용': parcel.subLots.map(s => typeof s === 'string' ? s : s.lotAddress).join(', ') });
                }
                if (parcel.crops && parcel.crops.length > 0) {
                    parcel.crops.forEach(crop => {
                        excelData.push({ '항목': '  작물', '내용': `${crop.name} (${formatArea(crop.area)}m²)` });
                    });
                }
            });
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sanitizeExcelData(excelData));
        ws['!cols'] = [{ wch: 20 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, ws, '등록결과');
        XLSX.writeFile(wb, `등록결과_${this.currentRegistrationData.receptionNumber}_${this.currentRegistrationData.name}.xlsx`);
        this.showToast('엑셀 파일로 내보내기 완료', 'success');
    }

    // ========================================
    // Override: 초기화 후 추가 로직
    // ========================================

    async postInit() {
        // 초기 접수번호 설정
        if (this.receptionNumberInput) {
            this.receptionNumberInput.value = this.generateNextReceptionNumber();
        }

        // 로컬 모드에서만 auto-save 로드 (Firebase 모드에서는 로드 안함)
        if (window.isElectron && this.FileAPI?.autoSavePath && !window.firebaseConfig?.isEnabled()) {
            const autoSaveData = await window.loadFromAutoSaveFile();
            if (autoSaveData && autoSaveData.length > 0 && this.sampleLogs.length === 0) {
                this.sampleLogs = autoSaveData;
                this._safeSetYearStorage();   // SLS-1-198: 복원 경로 quota 격리
                this.log('로컬 모드: 자동 저장 파일에서 데이터 로드됨:', autoSaveData.length, '건');
                this.filterAndRenderLogs();
                if (this.receptionNumberInput) {
                    this.receptionNumberInput.value = this.generateNextReceptionNumber();
                }
            }
        }

        this.log('토양 시료 접수 페이지 초기화 완료');

        // 기존 addressVerified: false 데이터 처리
        const invalidLogs = this.sampleLogs.filter(l => l.addressVerified === false);
        if (invalidLogs.length > 0) {
            // Electron: IPC로 재검증 가능
            if (window.electronAPI?.vworldGeocode) {
                this.validateAndMarkLogs(invalidLogs).catch(err =>
                    (window.logger?.error || console.error)('기존 필지 재검증 오류:', err)
                );
            } else {
                // 웹: CORS로 VWORLD 접근 불가 → 잘못된 검증 결과 초기화
                let cleared = false;
                invalidLogs.forEach(log => {
                    delete log.addressVerified;
                    cleared = true;
                });
                if (cleared) {
                    try {
                        localStorage.setItem(this.getStorageKey(this.selectedYear), JSON.stringify(this.sampleLogs));
                    } catch { /* ignore */ }
                    this.filterAndRenderLogs();
                }
            }
        }
    }

    // ========================================
    // VWORLD 지번 주소 검증
    // ========================================

    async validateParcelAddress(lotAddress) {
        if (!lotAddress || lotAddress === '-') return null;
        if (!navigator.onLine) return null;

        // 시·도 결정 (전국 기관용 — 봉화군/경상북도 가정 제거)
        //  1) 주소에 시·도가 이미 있으면(자동완성 선택 시 JUSO siNm 포함) 약어를 정식명으로 펼쳐 사용
        //     (예: '경북 봉화군…' → '경상북도 봉화군…')
        //  2) 시·도가 없으면 설정의 '기본 시·도'(app_default_sido)로 prefix
        //  3) 설정값도 없으면 시·도 미상 → null 반환(검증 스킵). 강제 prefix로 인한 오검증 방지.
        // 탐지는 constants.js의 완전한 SIDO_PATTERN 재사용(특별자치도 표기 포함). 누락 시 모듈 폴백.
        const SIDO_RE = window.SIDO_PATTERN || SIDO_DETECT_FALLBACK;
        // 선두 약어 시·도 → 정식명 매핑은 address-parser SSOT(window.SIDO_SHORT_MAP) 재사용
        // (정식명/장음 표기는 뒤 글자가 공백이 아니어서 매칭되지 않음 → no-op)
        // SHORT_SIDO_RE는 모듈 상수(파일 상단)로 통일됨
        const SHORT_SIDO_EXPAND = window.SIDO_SHORT_MAP || {};
        let fullAddress;
        if (SIDO_RE.test(lotAddress)) {
            fullAddress = lotAddress.replace(SHORT_SIDO_RE, (_, sido, sp) => (SHORT_SIDO_EXPAND[sido] || sido) + sp);
        } else {
            let defaultSido = '';
            try { defaultSido = (localStorage.getItem('app_default_sido') || '').trim(); } catch { defaultSido = ''; }
            if (!defaultSido) return null; // 시·도 미상 → 검증 스킵(오검증 방지)
            fullAddress = `${defaultSido} ${lotAddress}`;
        }

        // Electron: main process IPC (apiKey는 main의 process.env에서 직접 사용 → 렌더러 노출 없음)
        if (window.electronAPI?.vworldGeocode) {
            try {
                return await window.electronAPI.vworldGeocode(fullAddress);
            } catch {
                return null;
            }
        }

        // 웹 환경: VWORLD API 키를 렌더러/번들에 노출하지 않기 위해 직접 fetch 경로를 제거함.
        // (과거: window.NETWORK_CONFIG.VWORLD_API_KEY 직접 사용 → docs/ 빌드 산출물에 키 평문 노출 보안 결함)
        // 좌표 기반 필지 검증은 Electron(IPC, main 프로세스 process.env)에서만 수행하며,
        // 웹 환경에서는 검증을 생략한다(null = 미검증). 웹에서 검증이 필요하면 서버 프록시를 도입할 것.
        return null;
    }

    async validateAndMarkLogs(logs) {
        const BATCH_SIZE = 5;
        let changed = false;

        for (let i = 0; i < logs.length; i += BATCH_SIZE) {
            const batch = logs.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map(async (log) => {
                    // 필지 주소만 검증 (하위필지는 지번만 저장되므로 제외)
                    const addresses = [];
                    if (log.parcels && log.parcels.length > 0) {
                        log.parcels.forEach(p => {
                            if (p.lotAddress) addresses.push(p.lotAddress);
                        });
                    } else if (log.lotAddress) {
                        addresses.push(log.lotAddress);
                    }
                    if (addresses.length === 0) return null;
                    const verifications = await Promise.allSettled(
                        addresses.map(addr => this.validateParcelAddress(addr))
                    );
                    const values = verifications
                        .filter(r => r.status === 'fulfilled' && r.value !== null)
                        .map(r => r.value);
                    if (values.length === 0) return null;
                    return values.every(v => v === true);
                })
            );
            results.forEach((r, idx) => {
                if (r.status === 'fulfilled' && r.value !== null) {
                    batch[idx].addressVerified = r.value;
                    // 안전망(defense-in-depth): SLS-1-25에서 saveLogs를 in-place로 바꿔
                    // 더 이상 고아 참조가 생기지 않지만, 만약 전달된 log가 실제 this.sampleLogs
                    // 항목과 다른 참조이면 id로 실제 항목을 찾아 동기화한다. (동일 참조면 스킵)
                    const liveLog = this.sampleLogs.find(l => String(l.id) === String(batch[idx].id));
                    if (liveLog && liveLog !== batch[idx]) liveLog.addressVerified = r.value;
                    changed = true;
                }
            });
        }

        if (changed) {
            // localStorage + Firebase 개별 저장 (addressVerified 영속화)
            try {
                localStorage.setItem(this.getStorageKey(this.selectedYear), JSON.stringify(this.sampleLogs));
            } catch { /* 저장 실패 시 무시 */ }
            const verifiedLogs = logs.filter(l => l.addressVerified !== undefined);
            if (verifiedLogs.length > 0) this.firebaseSaveRecords(verifiedLogs);
            // 전체 재렌더링 대신 검증 결과 셀만 DOM에서 직접 업데이트
            logs.forEach(log => {
                const invalidClass = log.addressVerified === false;
                this.tableBody?.querySelectorAll(`tr[data-id="${log.id}"] td.col-lot-address`).forEach(td => {
                    td.classList.toggle('address-invalid', invalidClass);
                    td.title = invalidClass ? '지번 주소가 VWORLD에서 확인되지 않았습니다' : '';
                });
            });
            const invalidCount = logs.filter(l => l.addressVerified === false).length;
            if (invalidCount > 0) {
                this.showToast(`${invalidCount}건의 필지 주소를 확인하세요 (지번 불일치)`, 'warning');
            }
        }
    }
}

// 전역 노출 (단위 테스트 및 디버깅용 — 인스턴스화는 DOMContentLoaded에서만 수행)
window.SoilSampleManager = SoilSampleManager;

// ========================================
// 인스턴스 생성 및 초기화
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    const manager = new SoilSampleManager();
    await manager.init();
    await manager.postInit();
    window.soilManager = manager;
});
