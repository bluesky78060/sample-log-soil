/**
 * @fileoverview 흙토람 토양검정 일괄입력 서식 내보내기
 * 토양 접수 데이터(soilSampleLogs)를 읽어와 검정 결과를 입력하고
 * 흙토람 서식(.xlsx)으로 내보내는 페이지 스크립트
 */

// ========================================
// 상수 정의
// ========================================

const PYEONG_TO_SQM = 3.3058;

// 시군구 → 시도 추론 테이블
// SIGUNGU_TO_SIDO는 src/shared/lot-address-parser.js로 이동 (SLS-1-200)

// ========================================
// 흙토람 일괄입력 양식 — 헤더 템플릿 (41열, 2026-07-14 개인정보 일괄삭제 이후 흙토람 서식 기준)
// 컬럼 인덱스→값 맵으로 헤더를 정의(매직 인덱스 가시화). buildWorksheetData가 재사용.
// ========================================
const HEUKTORAM_WS_COLS = 41;
const HEUKTORAM_WS_TITLE = '토양검정 일괄입력 양식';
// ⚠️ 실물 서식(tests/fixtures/heuktoram-soil-form.xlsx)의 A2를 그대로 옮기되
//    **예시행 문장 2개만 뺀다**(SLS-1-210 코드리뷰 HIGH).
//    실물은 사용자가 직접 채우는 빈 템플릿이라 5행에 예시가 들어 있지만,
//    우리가 내보내는 파일은 **5행부터 사용자의 실제 시료**다.
//    "5번 행은 예시…삭제 후 작성"을 그대로 두면 안내를 따른 사용자가
//    자기 첫 시료를 지운다 — 이 티켓이 고친 버그보다 나쁜 결과다.
const HEUKTORAM_WS_GUIDE = "아래 형식과 같이 입력되어야만 일괄입력을 할 수 있습니다. \n"
    + "  - 필지구분은 \"필지\" 또는 \"하위필지\" 로 입력하며, 필수 입력\n"
    + "  - 채취년도는 숫자(4자리)를 입력하며, 필수 입력\n"
    + "  - 분석의뢰일(접수일자)은 숫자(4)-숫자(2)-숫자(2) 형태로 입력하며, 필수 입력\n"
    + "  - 경지구분은 1차와 2차를 나눠 입력하며, 필수 입력\n"
    + "  - 용도구분은 필수 입력하며, 코드를 [일반적인토양검정-0] 선택 시에는 시행(재배) 전후를 선택 하지 마세요.(추가 내용)\n"
    + "  - 시료번호는 숫자로 입력하며, 필수 입력\n"
    + "  - 검정 대상지 주소는 시도, 시군구, 읍면동, 리를 나눠 입력하며, 필수 입력\n"
    + "  - 지번구분은 일반은 빈공백으로 산은 산이라고 명시하며 검정대상지번은 지번1과 지번2로 나눠 입력하며, 지번1은 필수 입력, 지번2가 없을 경우 비워놓음\n"
    + "  - 주소매핑여부는 자동으로 체크 됩니다. 작성하지 마세요.\n"
    + "  - 면적의 단위는 ㎡로, 숫자 형태로 입력하며, 필수 입력\n"
    + "  - 토양검정일은 채취년도보다 이후 날짜로 작성, 현재 날짜보다 이전으로 작성, 숫자(4)-숫자(2)-숫자(2) 형태로 입력하며, 필수 입력\n"
    + "  - 작물을 입력할 시에는 작물명 또는 숫자 5자리로 이루어진 작물코드 입력하며, 필수 입력\n"
    + "  - 성토여부는 미해당, 해당으로 입력하며, 필수 입력\n"
    + "  - 화학성 분석값 입력 시 \"유효범위보기\" 참고하여 입력\n"
    + "  - 하위필지는 반드시 대표필지 아래에 연속으로 입력하고 채취년도,경지구분,시료번호,검정대상지 시도 및 시군구 주소를 대표필지와 일치\n"
    + "\n"
    + "원활한 일괄입력을 위하여 1회당 300건 이하의 자료 입력을 권장드립니다.";

// 3행: 대분류 헤더 (A~AH = 데이터 영역 0~33, AI = 스페이서(34, 무색), AJ~AO = 코드 범례 35~40)
const HEUKTORAM_WS_HEADER3 = {
    0: " *필지구분",
    1: " *채취년도",
    2: "*분석의뢰일\n(접수일자)",
    3: " *경지구분",
    5: "*용도구분",
    7: "*시료번호",
    8: "*대상지 주소",
    12: "지번 구분",
    13: "*지번",
    15: "주소매핑여부",
    16: "기타주소",
    17: "*면적(㎡)",
    18: "*토양검정일",
    19: " *작물명 또는\n작물코드",
    20: "*성토여부",
    21: "점토함량",
    22: " pH",
    23: " 유기물",
    24: "유효인산",
    25: "교환성 칼륨",
    26: "교환성 칼슘",
    27: "교환성\n마그네슘",
    28: "유효규산",
    29: "전기전도도",
    30: "석회소요량",
    31: "질산태질소",
    32: "양이온\n치환용량",
    33: "암모니아태\n질소",
    35: "일반적인토양검정-0",
    36: "토양개량제 규산-1",
    37: "토양개량제 석회질-2",
    38: "녹비작물-3",
    39: "전-N",
    40: "후-Y"
};

// 4행: 소분류 헤더
const HEUKTORAM_WS_HEADER4 = {
    3: '1차', 4: '2차', 5: '코드', 6: '시행(재배)전후',
    8: '시도', 9: '시군구', 10: '읍면동', 11: '리', 13: '지번1', 14: '지번2'
};

// 용도코드 → 라벨 (데이터 행 [6])
const HEUKTORAM_WS_USAGE_LABELS = {
    '0': '일반적인토양검정-0',
    '1': '토양개량제 규산-1',
    '2': '토양개량제 석회질-2',
    '3': '녹비작물-3'
};

/**
 * 41열 행 생성 + 컬럼 인덱스→값 맵 적용.
 * 외부(흙토람) 양식이 컬럼 수에 민감하므로, 0~40 범위를 벗어난 키는 무시하고 경고한다.
 */
function makeWsRow(map) {
    const r = new Array(HEUKTORAM_WS_COLS).fill('');
    if (map) {
        for (const k in map) {
            const i = Number(k);
            if (Number.isInteger(i) && i >= 0 && i < HEUKTORAM_WS_COLS) {
                r[i] = map[k];
            } else {
                (window.logger?.warn || console.warn)(`[흙토람양식] 컬럼 인덱스 범위 초과 무시: ${k}`);
            }
        }
    }
    return r;
}

// ========================================
// 공익직불제 이행점검 일괄입력 양식 — 헤더 템플릿
// 데이터는 C열(절대 인덱스 2)부터 시작. 헤더맵 키는 C 기준 상대 인덱스(0=C, 1=D, ...).
// ========================================
const GONGIK_WS_TOTAL_COLS = 40;  // 데이터 열 수 (C~AN)
const GONGIK_WS_C = 2;            // 데이터 시작 절대 인덱스(C열) — A,B는 빈 열(숨김)
const GONGIK_WS_GUIDE = '* 아래 형식과 같이 입력되어야만 일괄입력을 할 수 있습니다.\n'
    + '  - 경영체등록번호는 10자리 숫자로 입력하세요.\n'
    + '  - 신청자 전화번호는 \'-\' 없이 입력하세요(예: 01023456789).\n'
    + '  - 대상지면적의 단위는 ㎡(제곱미터)로 숫자만 입력하세요.\n'
    + '  - 기준년도는 \'직불제 - 이행점검 적합기준 보기\' 메뉴의 \'이행점검명\'을 입력하세요.\n'
    + '  - 원활한 일괄입력을 위하여 1회당 300건 이하의 자료 입력을 권장드립니다.';

// 2행: 대분류 헤더 (C 기준 상대 인덱스)
const GONGIK_WS_HEADER2 = {
    0: '차수', 1: '시료채취일자', 2: '토양검정일', 3: '분석의뢰일(접수일자)', 4: '용도구분',
    6: '채취자명', 7: '시료번호', 8: '경영체등록번호', 9: '경작자명', 10: '대상지',
    17: '상세주소', 18: '경지구분', 20: '경작자 주소', 21: '신청자 전화번호', 22: '대상지면적(㎡)',
    23: '작물명 또는 작물코드', 24: '기준년도', 25: '화학성분값'
};

// 3행: 소분류 헤더 (C 기준 상대 인덱스)
const GONGIK_WS_HEADER3 = {
    4: '구분', 5: '시행전후', 10: '시도', 11: '시군구', 12: '읍면동', 13: '리', 14: '일반·산',
    15: '지번 1', 16: '지번 2', 18: '1차', 19: '2차',
    25: '점토함량', 26: 'pH', 27: '유기물', 28: '유효인산', 29: '교환성칼륨', 30: '교환성칼슘',
    31: '교환성마그네슘', 32: '유효규산', 33: '전기전도도', 34: '석회소요량', 35: '질산태질소',
    36: '양이온치환용량', 37: '암모니아태질소'
};

/**
 * 공익직불제 양식 행 생성. 맵 키는 C 기준 상대 인덱스 → C 오프셋 적용해 절대 인덱스에 배치.
 * 0~39 범위를 벗어난 키는 무시하고 경고(외부 양식 열 수 보호).
 */
function makeGongikRow(map) {
    const r = new Array(GONGIK_WS_TOTAL_COLS + GONGIK_WS_C).fill('');
    if (map) {
        for (const k in map) {
            const i = Number(k);
            if (Number.isInteger(i) && i >= 0 && i < GONGIK_WS_TOTAL_COLS) {
                r[GONGIK_WS_C + i] = map[k];
            } else {
                (window.logger?.warn || console.warn)(`[공익직불양식] 컬럼 인덱스 범위 초과 무시: ${k}`);
            }
        }
    }
    return r;
}

// ========================================
// HeuktoramManager 클래스
// ========================================

class HeuktoramManager {
    constructor() {
        this.selectedYear = new Date().getFullYear().toString();
        this.sampleLogs = [];      // 토양 접수 데이터
        this.testResults = {};     // { [rowKey]: { testDate, soiling, clay, pH, ... } }
        this.flatRows = [];        // 테이블에 표시할 flat 행 목록
        this.selectedKeys = new Set();
        this.focusedCell = null;   // { rowIdx, colIdx } 붙여넣기 시작점

        // 검정 결과 필드 정의 (순서 중요)
        this.resultFields = [
            'testDate', 'soiling', 'clay', 'pH', 'organicMatter', 'availableP',
            'exK', 'exCa', 'exMg', 'silica', 'ec', 'limeReq', 'NO3N', 'cec', 'NH4N', 'usageCode'
        ];

        // 검정 결과 유효 범위 (흙토람 기준)
        this.fieldRanges = {
            pH: { min: 3.5, max: 9.5, label: 'pH', unit: '' },
            organicMatter: { min: 1, max: 300, label: '유기물', unit: 'g/kg' },
            availableP: { min: 1, max: 9999, label: '유효인산', unit: 'mg/kg' },
            exK: { min: 0.01, max: 15, label: '교환성 칼륨', unit: 'cmol+/kg' },
            exCa: { min: 0.1, max: 35, label: '교환성 칼슘', unit: 'cmol+/kg' },
            exMg: { min: 0.1, max: 25, label: '교환성 마그네슘', unit: 'cmol+/kg' },
            silica: { min: 5, max: 2000, label: '유효규산', unit: 'mg/kg' },
            ec: { min: 0.01, max: 30, label: '전기전도도', unit: 'dS/m' }
        };

        // 기본 숨김 필드
        this.hiddenFields = new Set(['soiling', 'clay', 'NO3N', 'NH4N']);
        this.showAllColumns = false;

        this.init();
    }

    // ========================================
    // 초기화
    // ========================================

    async init() {
        this.cacheElements();
        this.setDefaultYear();
        this.restoreFromSoilPage();  // 토양 접수 대장에서 전달된 데이터 복원
        this.bindEvents();
        // 분석결과 IDB 초기화 + localStorage 자동 마이그레이션(멱등)
        try { await window.AnalysisDB?.init(); } catch (e) {
            (window.logger?.warn || console.warn)('AnalysisDB 초기화 실패(LS 폴백):', e);
        }
        await this.loadData();
        this.render();
        this.setupResultImporter();

        // 테마 초기화
        if (typeof ThemeManager !== 'undefined') {
            ThemeManager.init();
            this.setupThemeToggle();
        }
    }

    /**
     * 엑셀 결과 가져오기 모달 (Phase 1 — 텍스트 붙여넣기) 연결
     * 설계: docs-internal/HEUKTORAM_RESULT_EXCEL_IMPORT_MODAL_DESIGN.md
     */
    setupResultImporter() {
        if (!window.HeuktoramResultImporter) return;

        const fieldLabels = {
            pH: 'pH', organicMatter: '유기물', availableP: '유효인산',
            exK: '치환성칼륨(K)', exCa: '치환성칼슘(Ca)', exMg: '치환성마그네슘(Mg)',
            silica: '유효규산', ec: 'EC', limeReq: '석회요구량', cec: 'CEC',
        };

        // 흙토람 결과값 소수점 자리수 default (사용자가 모달에서 변경 가능)
        // 0 = 정수 (반올림), 1/2/3 = 해당 소수점 자리수까지
        const fieldDecimals = {
            pH: 1,             // 5.3, 6.7
            organicMatter: 0,  // 29 g/kg (정수)
            availableP: 0,     // 234 mg/kg (정수)
            exK: 2,            // 0.45 cmolc/kg
            exCa: 2,           // 4.20 cmolc/kg
            exMg: 2,           // 1.05 cmolc/kg
            silica: 0,         // 132 mg/kg (정수)
            ec: 2,             // 0.25 dS/m
            limeReq: 0,        // 350 kg/10a (정수)
            cec: 0,            // 13 cmolc/kg (정수)
        };

        // 모달 매핑 UI에서 제외할 필드
        // - testDate: 도구바의 "토양검정일" 일괄적용을 사용
        // - NO3N/NH4N/usageCode/soiling/clay: 흙토람 결과 입력 대상 외
        const IMPORTER_EXCLUDED_FIELDS = new Set(['testDate', 'NO3N', 'NH4N', 'usageCode', 'soiling', 'clay']);
        const importerFields = this.resultFields.filter(f => !IMPORTER_EXCLUDED_FIELDS.has(f));

        this.resultImporter = new window.HeuktoramResultImporter({
            resultFields: importerFields,
            fieldLabels,
            fieldDecimals,
            fieldRanges: this.fieldRanges,
            getFlatRows:    () => this.flatRows,
            getTestResults: () => this.testResults,
            applyResult:    (rowKey, field, value) => {
                if (!this.testResults[rowKey]) this.testResults[rowKey] = {};
                this.testResults[rowKey][field] = value;
            },
            syncToSiblings: (rowKey, field, value) => this.syncToSiblings(rowKey, field, value),
            saveTestResults: () => this.saveTestResults(),
            rerender: () => {
                this.render();
                this.validateAllRanges();
            },
        });
        this.resultImporter.init();
    }

    cacheElements() {
        this.yearSelect = document.getElementById('yearSelect');
        this.collectYearInput = document.getElementById('collectYear');
        this.collectorInput = document.getElementById('collector');
        this.bulkTestDateInput = document.getElementById('bulkTestDate');
        this.bulkUsageCodeSelect = document.getElementById('bulkUsageCode');
        this.bulkBeforeAfterSelect = document.getElementById('bulkBeforeAfter');
        this.exportFormatSelect = document.getElementById('exportFormatSelect');
        this.selectAllCheckbox = document.getElementById('selectAll');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.applyBulkBtn = document.getElementById('applyBulkBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.toggleColumnsBtn = document.getElementById('toggleColumnsBtn');
        this.tableBody = document.getElementById('tableBody');
        this.emptyState = document.getElementById('emptyState');
        this.recordCount = document.getElementById('recordCount');
    }

    /**
     * 토양 접수 대장에서 넘어온 경우 sessionStorage에서 연도/선택 ID 복원
     */
    restoreFromSoilPage() {
        // localStorage 임시 키에서 데이터 복원 (팝업 방식 호환)
        const year = localStorage.getItem('heuktoram_year');
        const selectedIdsJson = localStorage.getItem('heuktoram_selected_ids');

        if (year) {
            this.selectedYear = year;
            if (this.yearSelect) this.yearSelect.value = year;
            if (this.collectYearInput) this.collectYearInput.value = year;
            localStorage.removeItem('heuktoram_year');
        }

        if (selectedIdsJson) {
            try {
                const ids = JSON.parse(selectedIdsJson);
                this.preSelectedLogIds = Array.isArray(ids) && ids.length > 0 ? new Set(ids) : null;
            } catch (e) {
                this.preSelectedLogIds = null;
            }
            localStorage.removeItem('heuktoram_selected_ids');
        }

        // 뒤로가기/닫기 버튼 설정
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.close();
            });
        }
    }

    setDefaultYear() {
        const year = new Date().getFullYear().toString();
        this.selectedYear = year;
        if (this.yearSelect) {
            this.yearSelect.value = year;
        }
        if (this.collectYearInput) {
            this.collectYearInput.value = year;
        }
    }

    setupThemeToggle() {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        const current = document.documentElement.getAttribute('data-theme');
        if (current === 'dark') btn.classList.add('dark');

        btn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            ThemeManager.setTheme(isDark ? 'light' : 'dark');
            btn.classList.toggle('dark', !isDark);
        });
    }

    bindEvents() {
        // 연도 변경
        this.yearSelect?.addEventListener('change', async () => {
            this.selectedYear = this.yearSelect.value;
            this.preSelectedLogIds = null;  // 연도 변경 시 필터 초기화 (전체 표시)
            await this.loadData();
            this.render();
        });

        // 전체 선택 체크박스
        this.selectAllCheckbox?.addEventListener('change', () => {
            this.toggleSelectAll(this.selectAllCheckbox.checked);
        });

        // 전체 선택 버튼
        this.selectAllBtn?.addEventListener('click', () => {
            const allSelected = this.selectedKeys.size === this.flatRows.length;
            this.toggleSelectAll(!allSelected);
            if (this.selectAllCheckbox) {
                this.selectAllCheckbox.checked = !allSelected;
            }
        });

        // 토양검정일 선택 시 모든 행에 자동 입력
        this.bulkTestDateInput?.addEventListener('change', () => {
            const testDate = this.bulkTestDateInput.value;
            if (!testDate) return;
            for (const row of this.flatRows) {
                if (!this.testResults[row.key]) this.testResults[row.key] = {};
                this.testResults[row.key].testDate = testDate;
            }
            this.saveTestResults();
            this.render();
            if (window.showToast) window.showToast(`검정일이 전체 ${this.flatRows.length}건에 적용되었습니다.`, 'info');
        });

        // 검정일 일괄 삭제
        document.getElementById('clearTestDateBtn')?.addEventListener('click', () => {
            if (!confirm('모든 행의 검정일을 삭제하시겠습니까?')) return;
            for (const row of this.flatRows) {
                if (this.testResults[row.key]) {
                    this.testResults[row.key].testDate = '';
                }
            }
            if (this.bulkTestDateInput) this.bulkTestDateInput.value = '';
            this.saveTestResults();
            this.render();
            if (window.showToast) window.showToast(`검정일이 전체 ${this.flatRows.length}건에서 삭제되었습니다.`, 'info');
        });

        // 일괄 적용
        this.applyBulkBtn?.addEventListener('click', () => this.applyBulkValues());

        // 내보내기
        // 내보내기 버튼: 선택된 양식으로 분기
        this.exportBtn?.addEventListener('click', () => {
            const fmt = this.exportFormatSelect?.value || 'heuktoram';
            if (fmt === 'gongik') {
                this.exportToGongik();
            } else {
                this.exportToHeuktoram();
            }
        });

        // 전체 보기 토글
        this.toggleColumnsBtn?.addEventListener('click', () => this.toggleHiddenColumns());
        // 초기 숨김 적용
        this.applyColumnVisibility();

        // 붙여넣기 핸들러 (테이블 영역)
        document.addEventListener('paste', (e) => this.handlePaste(e));

        // 키보드 네비게이션
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    // ========================================
    // 데이터 로드/저장
    // ========================================

    async loadData() {
        // 토양 접수 데이터 로드
        this.sampleLogs = this.loadSampleLogs();

        // 검정 결과 로드 (IDB 우선, 실패 시 localStorage 폴백)
        this.testResults = await this.loadTestResults();

        // flat rows 생성
        this.buildFlatRows();
    }

    loadSampleLogs() {
        const key = `soilSampleLogs_${this.selectedYear}`;
        try {
            const data = localStorage.getItem(key);
            if (!data) return [];
            const parsed = JSON.parse(data);
            if (!Array.isArray(parsed)) return [];
            // 접수번호 오름차순 정렬 (숫자 우선, F접두사 포함, -N 접미사 포함)
            return parsed.sort((a, b) => {
                const toNum = s => {
                    if (!s) return Infinity;
                    const str = String(s).replace(/^F/i, '');
                    const match = str.match(/^(\d+(?:\.\d+)?)-(\d+)$/);
                    if (match) return parseFloat(match[1]) + parseInt(match[2]) * 0.001;
                    const n = parseFloat(str);
                    return isNaN(n) ? Infinity : n;
                };
                return toNum(a.receptionNumber) - toNum(b.receptionNumber);
            });
        } catch (e) {
            (window.logger?.error || console.error)('토양 접수 데이터 로드 실패:', e);
            return [];
        }
    }

    async loadTestResults() {
        // IDB 우선 (init에서 마이그레이션 완료 보장)
        const lsKey = `soilTestResults_${this.selectedYear}`;
        if (window.AnalysisDB?.isReady?.()) {
            try {
                // fire-and-forget IDB write의 갭 차단: 진행 중 저장 완료까지 대기
                if (this._pendingIdbSave) { await this._pendingIdbSave.catch(() => {}); }
                const map = await window.AnalysisDB.getMap('soil', this.selectedYear);
                return map || {};
            } catch (e) {
                (window.logger?.warn || console.warn)('IDB 검정 결과 로드 실패, LS 폴백:', e);
            }
        }
        // 폴백: localStorage (IDB 미초기화 또는 오류 시)
        try {
            const data = localStorage.getItem(lsKey);
            if (!data) return {};
            return JSON.parse(data) || {};
        } catch (e) {
            (window.logger?.error || console.error)('검정 결과 로드 실패:', e);
            return {};
        }
    }

    /**
     * 검정 결과 저장: 동기 호출 호환을 위해 inner는 fire-and-forget.
     * 1) IDB(영속 주 저장소)에 비동기 저장
     * 2) localStorage(LS)에 백업 미러(rollback 안전 + 동기 폴백 지원)
     */
    saveTestResults() {
        const lsKey = `soilTestResults_${this.selectedYear}`;
        // 진짜 스냅샷(깊은 복사): 이후 this.testResults 변경이 IDB 비동기 write에 영향 주지 않도록
        let snapshot;
        try { snapshot = JSON.parse(JSON.stringify(this.testResults || {})); }
        catch { snapshot = { ...(this.testResults || {}) }; } // 순환참조 등 극단 케이스 폴백
        // LS 백업(용량 초과 시 무시 — IDB가 진짜 저장소)
        try { localStorage.setItem(lsKey, JSON.stringify(snapshot)); }
        catch (e) { (window.logger?.warn || console.warn)('LS 백업 실패(IDB는 계속):', e); }
        // IDB 영속 저장 — 진행 중 promise를 보관해 loadTestResults에서 await(fire-and-forget 갭 차단)
        if (window.AnalysisDB?.isReady?.()) {
            this._pendingIdbSave = window.AnalysisDB.saveMap('soil', this.selectedYear, snapshot)
                .catch(e => {
                    (window.logger?.error || console.error)('IDB 검정 결과 저장 실패:', e);
                });
        }
    }

    /**
     * 접수 데이터를 필지 단위로 flat 행 목록으로 변환
     */
    buildFlatRows() {
        this.flatRows = [];

        // 토양 접수 대장에서 선택된 ID가 있으면 해당 로그만 표시
        const logsToProcess = (this.preSelectedLogIds && this.preSelectedLogIds.size > 0)
            ? this.sampleLogs.filter(log => this.preSelectedLogIds.has(log.id))
            : this.sampleLogs;

        for (const log of logsToProcess) {
            if (!log.parcels || log.parcels.length === 0) {
                // 접수번호에 '-숫자' 패턴이 있으면 하위필지로 인식 (예: 468-1)
                const rNum = String(log.receptionNumber || '');
                const subLotMatch = rNum.match(/^(.+)-(\d+)$/);
                this.flatRows.push({
                    key: `${log.id}_0_0`,
                    displayNumber: log.receptionNumber,
                    baseReceptionNumber: subLotMatch ? subLotMatch[1] : rNum,
                    log: log,
                    parcel: null,
                    parcelIdx: 0,
                    subLot: null,
                    subLotIdx: -1,
                    isSubLot: !!subLotMatch
                });
                continue;
            }

            // 첫 번째 필지 첫 작물이 '필지', 이후 모든 항목(다른 필지 포함)은 '하위필지'
            // 접수번호에 '-숫자' 패턴이 있으면 (예: 468-1) 전체가 하위필지
            const hasSubLotNumber = /^.+-\d+$/.test(String(log.receptionNumber || ''));
            let entryCounter = 0; // 접수 건 전체 카운터 (0=필지, 1+=하위필지)
            for (let pi = 0; pi < log.parcels.length; pi++) {
                const parcel = log.parcels[pi];
                const crops = parcel.crops || [{ name: '', area: '', code: '' }];

                for (let ci = 0; ci < crops.length; ci++) {
                    this.flatRows.push({
                        key: `${log.id}_${pi}_c${ci}`,
                        displayNumber: (hasSubLotNumber || entryCounter === 0)
                            ? log.receptionNumber
                            : `${log.receptionNumber}-${entryCounter}`,
                        log: log,
                        parcel: parcel,
                        parcelIdx: pi,
                        crop: crops[ci],
                        cropIdx: ci,
                        subLot: null,
                        subLotIdx: -1,
                        isSubLot: hasSubLotNumber || entryCounter > 0
                    });
                    entryCounter++;
                }

                // 하위필지 (실제 하위 지번)
                if (parcel.subLots) {
                    for (let si = 0; si < parcel.subLots.length; si++) {
                        // string 형식으로 저장된 subLot 정규화
                        const rawSub = parcel.subLots[si];
                        const sub = typeof rawSub === 'string'
                            ? { lotAddress: rawSub, crops: [] }
                            : rawSub;
                        const subCrops = (sub.crops && sub.crops.length > 0) ? sub.crops : [{ name: '', area: '', code: '' }];

                        for (let sci = 0; sci < subCrops.length; sci++) {
                            this.flatRows.push({
                                key: `${log.id}_${pi}_s${si}_c${sci}`,
                                displayNumber: `${log.receptionNumber}-${entryCounter}`,
                                log: log,
                                parcel: parcel,
                                parcelIdx: pi,
                                crop: subCrops[sci],
                                cropIdx: sci,
                                subLot: sub,
                                subLotIdx: si,
                                isSubLot: true
                            });
                            entryCounter++;
                        }
                    }
                }
            }
        }

        this.preSelectedLogIds = null;
    }

    // ========================================
    // 렌더링
    // ========================================

    render() {
        if (!this.tableBody) return;

        if (this.flatRows.length === 0) {
            this.tableBody.innerHTML = '';
            if (this.emptyState) this.emptyState.style.display = 'flex';
            if (this.recordCount) this.recordCount.textContent = '0건';
            return;
        }

        if (this.emptyState) this.emptyState.style.display = 'none';
        if (this.recordCount) this.recordCount.textContent = `${this.flatRows.length}건`;

        const fragment = document.createDocumentFragment();

        for (let ri = 0; ri < this.flatRows.length; ri++) {
            const row = this.flatRows[ri];
            const tr = this.createTableRow(row, ri);
            fragment.appendChild(tr);
        }

        this.tableBody.innerHTML = '';
        this.tableBody.appendChild(fragment);

        // 기존 검정결과 범위 검증
        this.validateAllRanges();
    }

    createTableRow(row, rowIdx) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-log-id', row.log.id);
        if (row.isSubLot) tr.classList.add('sublot-row');
        if (row.log.isComplete) tr.classList.add('row-completed');

        this._appendHeuktoramFixedCells(tr, row);
        this._appendHeuktoramResultCells(tr, row, rowIdx);
        return tr;
    }

    /** 고정 정보 셀(체크박스·접수번호·성명·주소·작물·경지구분·용도·면적·접수일자)을 tr에 추가 */
    _appendHeuktoramFixedCells(tr, row) {
        const isChecked = this.selectedKeys.has(row.key);

        // 체크박스
        const tdCheck = document.createElement('td');
        tdCheck.className = 'col-checkbox sticky-col';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isChecked;
        cb.addEventListener('change', () => {
            if (cb.checked) {
                this.selectedKeys.add(row.key);
            } else {
                this.selectedKeys.delete(row.key);
            }
            this.updateSelectAllState();
        });
        tdCheck.appendChild(cb);
        tr.appendChild(tdCheck);

        // 접수번호
        const tdNum = document.createElement('td');
        tdNum.className = 'col-num sticky-col';
        tdNum.textContent = row.displayNumber || row.log.receptionNumber || '';
        tr.appendChild(tdNum);

        // 성명
        const tdName = document.createElement('td');
        tdName.className = 'col-name sticky-col';
        tdName.textContent = row.log.name || '';
        tr.appendChild(tdName);

        // 필지주소
        const tdAddr = document.createElement('td');
        tdAddr.className = 'col-address sticky-col';
        if (row.isSubLot && row.subLot) {
            tdAddr.textContent = row.subLot.lotAddress || '';
            tdAddr.classList.add('sublot-indent');
        } else if (row.parcel) {
            tdAddr.textContent = row.parcel.lotAddress || '';
        }
        tr.appendChild(tdAddr);

        // 작물
        const tdCrop = document.createElement('td');
        tdCrop.className = 'col-crop sticky-col';
        tdCrop.textContent = row.crop?.name || '';
        tr.appendChild(tdCrop);

        // 경지구분
        const tdCat = document.createElement('td');
        tdCat.className = 'col-category sticky-col';
        tdCat.textContent = (row.parcel?.category || row.log.subCategory || '');
        tr.appendChild(tdCat);

        // 용도
        const tdPurpose = document.createElement('td');
        tdPurpose.className = 'col-purpose sticky-col';
        tdPurpose.textContent = (row.parcel?.purpose || row.log.purpose || '');
        tr.appendChild(tdPurpose);

        // 면적 (평→㎡ 변환)
        const tdArea = document.createElement('td');
        tdArea.className = 'col-area sticky-col';
        let displayArea = row.crop?.area || '';
        if (displayArea && row.crop?.unit === 'pyeong') {
            const parsed = parseFloat(displayArea);
            if (!isNaN(parsed)) displayArea = Math.round(parsed * PYEONG_TO_SQM);
        }
        tdArea.textContent = displayArea;
        tr.appendChild(tdArea);

        // 접수일자
        const tdDate = document.createElement('td');
        tdDate.className = 'col-date sticky-col';
        tdDate.textContent = row.log.date || '';
        tr.appendChild(tdDate);
    }

    /** 편집 가능한 검정 결과 셀들(contentEditable)을 tr에 추가 */
    _appendHeuktoramResultCells(tr, row, rowIdx) {
        const result = this.testResults[row.key] || {};

        // 경지구분/작물에 따라 필수 입력 필드 결정
        const requiredFields = this.getRequiredFields(
            row.parcel?.category || row.log.subCategory || '',
            row.crop?.name || ''
        );

        // 검정 결과 필드들 (편집 가능)
        for (let ci = 0; ci < this.resultFields.length; ci++) {
            const field = this.resultFields[ci];
            const td = document.createElement('td');
            const isRequired = requiredFields.has(field);
            const isHidden = this.hiddenFields.has(field) && !this.showAllColumns;
            td.className = `col-result editable-cell${isRequired ? ' required-field' : ''}${isHidden ? ' hideable-col hidden' : this.hiddenFields.has(field) ? ' hideable-col' : ''}`;
            td.setAttribute('data-row', rowIdx);
            td.setAttribute('data-col', ci);
            td.setAttribute('data-field', field);
            td.contentEditable = true;
            td.textContent = result[field] || '';

            // 포커스 이벤트
            td.addEventListener('focus', () => {
                this.focusedCell = { rowIdx, colIdx: ci };
                td.classList.add('focused');
            });
            td.addEventListener('blur', () => {
                td.classList.remove('focused');
                this.focusedCell = null;  // M-3: 포커스 해제 시 초기화
                this.handleCellEdit(row.key, field, td.textContent.trim());
            });

            // Enter 키로 아래 셀로 이동
            td.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    td.blur();
                    this.moveFocus(rowIdx + 1, ci, 1);
                } else if (e.key === 'Tab') {
                    e.preventDefault();
                    td.blur();
                    if (e.shiftKey) {
                        this.moveFocusResult(rowIdx, ci - 1, -1);
                    } else {
                        this.moveFocusResult(rowIdx, ci + 1, 1);
                    }
                }
            });

            tr.appendChild(td);
        }
    }

    moveFocus(rowIdx, colIdx, direction = 1) {
        // 다음 행/열로 포커스 이동
        if (colIdx >= this.resultFields.length) {
            colIdx = 0;
            rowIdx++;
        }
        if (colIdx < 0) {
            colIdx = this.resultFields.length - 1;
            rowIdx--;
        }
        if (rowIdx < 0 || rowIdx >= this.flatRows.length) return;

        // 숨김 컬럼 건너뛰기 — while 루프로 스택 오버플로우 방지
        while (!this.showAllColumns && this.hiddenFields.has(this.resultFields[colIdx])) {
            colIdx += direction;
            if (colIdx >= this.resultFields.length) { colIdx = 0; rowIdx++; }
            if (colIdx < 0) { colIdx = this.resultFields.length - 1; rowIdx--; }
            if (rowIdx < 0 || rowIdx >= this.flatRows.length) return;
        }

        const cell = this.tableBody?.querySelector(
            `td[data-row="${rowIdx}"][data-col="${colIdx}"]`
        );
        if (cell) {
            cell.focus();
            // 텍스트 선택
            const range = document.createRange();
            range.selectNodeContents(cell);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    /**
     * Tab 키 전용 포커스 이동
     * - 이동 범위: pH(index 3) ~ cec(index 13)
     * - cec에서 Tab → 다음 행의 pH
     * - isSubLot=true 행은 건너뜀 (syncToSiblings가 값 복사 담당)
     */
    moveFocusResult(rowIdx, colIdx, direction = 1) {
        const START_COL = this.resultFields.indexOf('pH');   // 3
        const END_COL   = this.resultFields.indexOf('cec');  // 13
        // 최대 반복 횟수: 전체 행 × 범위 열 수 (무한루프 방지)
        const maxIter = (this.flatRows.length + 1) * (END_COL - START_COL + 2);
        let iter = 0;

        while (iter++ < maxIter) {
            // 열 범위 벗어나면 행 이동
            if (direction >= 0 && colIdx > END_COL) {
                colIdx = START_COL;
                rowIdx++;
            } else if (direction < 0 && colIdx < START_COL) {
                colIdx = END_COL;
                rowIdx--;
            }

            if (rowIdx < 0 || rowIdx >= this.flatRows.length) return;

            // isSubLot 행 건너뛰기
            if (this.flatRows[rowIdx]?.isSubLot) {
                rowIdx += direction;
                colIdx = direction >= 0 ? START_COL : END_COL;
                continue;
            }

            // 숨김 컬럼 건너뛰기
            if (!this.showAllColumns && this.hiddenFields.has(this.resultFields[colIdx])) {
                colIdx += direction;
                continue;
            }

            // 유효한 셀 발견 → 포커스 이동
            const cell = this.tableBody?.querySelector(
                `td[data-row="${rowIdx}"][data-col="${colIdx}"]`
            );
            if (cell) {
                cell.focus();
                const range = document.createRange();
                range.selectNodeContents(cell);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
            return;
        }
    }

    handleCellEdit(key, field, value) {
        if (!this.testResults[key]) {
            this.testResults[key] = {};
        }
        let sanitized = value.slice(0, window.SampleConstants?.VALIDATION?.MAX_CELL_INPUT_LENGTH ?? 200);

        // 최소값 미만/음수 입력 시 min으로 자동 보정
        const range = this.fieldRanges[field];
        if (range && sanitized.trim() !== '') {
            const num = parseFloat(sanitized);
            if (!isNaN(num) && num < range.min) {
                const original = num;
                sanitized = String(range.min);
                const rowIdx = this.flatRows.findIndex(r => r.key === key);
                const colIdx = this.resultFields.indexOf(field);
                const cell = this.tableBody?.querySelector(`td[data-row="${rowIdx}"][data-col="${colIdx}"]`);
                if (cell && cell.textContent !== sanitized) {
                    cell.textContent = sanitized;
                }
                const unitText = range.unit ? ` ${range.unit}` : '';
                if (window.showToast) {
                    window.showToast(`ℹ️ ${range.label}: ${original}${unitText} → 최소값 ${range.min}${unitText}으로 보정됨`, 'info');
                }
            }
        }

        this.testResults[key][field] = sanitized;
        this.syncToSiblings(key, field, sanitized);
        this.saveTestResults();

        // 범위 검증
        this.validateFieldRange(key, field, sanitized);
    }

    validateFieldRange(key, field, value) {
        const range = this.fieldRanges[field];
        if (!range) return; // 범위가 정의되지 않은 필드는 스킵

        // 해당 셀 찾기
        const rowIdx = this.flatRows.findIndex(r => r.key === key);
        const colIdx = this.resultFields.indexOf(field);
        const cell = this.tableBody?.querySelector(`td[data-row="${rowIdx}"][data-col="${colIdx}"]`);

        if (!value || value.trim() === '') {
            // 빈 값이면 경고 제거
            if (cell) cell.classList.remove('out-of-range');
            return;
        }

        const num = parseFloat(value);
        if (isNaN(num)) {
            if (cell) cell.classList.remove('out-of-range');
            return;
        }

        const unitText = range.unit ? ` ${range.unit}` : '';

        if (num < range.min || num > range.max) {
            // 범위 초과
            if (cell) cell.classList.add('out-of-range');
            if (window.showToast) window.showToast(`⚠️ ${range.label}: ${num}${unitText} → 입력 범위 ${range.min} ~ ${range.max}${unitText}`, 'warning');
        } else {
            // 범위 내
            if (cell) cell.classList.remove('out-of-range');
        }
    }

    validateAllRanges() {
        for (const [key, result] of Object.entries(this.testResults)) {
            for (const field of Object.keys(this.fieldRanges)) {
                if (result[field]) {
                    this.validateFieldRange(key, field, result[field]);
                }
            }
        }
    }

    /**
     * 같은 접수번호의 모든 행(본필지 + 하위필지)에 검정 결과 동기화
     * 실제 시료는 1개이므로 -1, -2 등 모든 하위필지도 같은 결과
     */
    syncToSiblings(key, field, value) {
        const editedRow = this.flatRows.find(r => r.key === key);
        if (!editedRow) return;

        // 같은 log.id이거나, base 접수번호(468-1 → 468)가 같은 log도 sibling으로 처리
        const editedBase = String(editedRow.log.receptionNumber || '').replace(/-\d+$/, '');
        const siblingRows = this.flatRows.filter(r => {
            if (r.key === key) return false;
            if (r.log.id === editedRow.log.id) return true;
            const rBase = String(r.log.receptionNumber || '').replace(/-\d+$/, '');
            return editedBase && rBase === editedBase;
        });
        for (const sibling of siblingRows) {
            if (!this.testResults[sibling.key]) {
                this.testResults[sibling.key] = {};
            }
            this.testResults[sibling.key][field] = value;
        }
        this.updateSiblingCells(siblingRows, field, value);
    }

    updateSiblingCells(siblingRows, field, value) {
        const siblingKeys = new Set(siblingRows.map(r => r.key));
        for (let i = 0; i < this.flatRows.length; i++) {
            if (siblingKeys.has(this.flatRows[i].key)) {
                const row = this.tableBody?.querySelectorAll('tr')[i];
                if (row) {
                    const cell = row.querySelector(`[data-field="${field}"]`);
                    if (cell && cell !== document.activeElement) {
                        cell.textContent = value;
                    }
                }
            }
        }
    }

    // ========================================
    // 붙여넣기 처리
    // ========================================

    handlePaste(event) {
        if (!this.focusedCell) return;

        const activeEl = document.activeElement;
        if (!activeEl || !activeEl.classList.contains('editable-cell')) return;

        event.preventDefault();

        const clipData = event.clipboardData || window.clipboardData;
        const text = clipData.getData('text/plain');
        if (!text) return;

        const rows = text.split(/\r?\n/).filter(r => r.length > 0);
        let startRow = this.focusedCell.rowIdx;
        let startCol = this.focusedCell.colIdx;

        let pastedCount = 0;

        for (let ri = 0; ri < rows.length; ri++) {
            const targetRow = startRow + ri;
            if (targetRow >= this.flatRows.length) break;

            const cols = rows[ri].split('\t');
            for (let ci = 0; ci < cols.length; ci++) {
                const targetCol = startCol + ci;
                if (targetCol >= this.resultFields.length) break;

                const field = this.resultFields[targetCol];
                const value = cols[ci].trim().slice(0, window.SampleConstants?.VALIDATION?.MAX_CELL_INPUT_LENGTH ?? 200);
                const rowKey = this.flatRows[targetRow].key;

                if (!this.testResults[rowKey]) {
                    this.testResults[rowKey] = {};
                }
                this.testResults[rowKey][field] = value;
                this.syncToSiblings(rowKey, field, value);

                // UI 업데이트
                const cell = this.tableBody?.querySelector(
                    `td[data-row="${targetRow}"][data-col="${targetCol}"]`
                );
                if (cell) {
                    cell.textContent = value;
                    cell.classList.add('paste-highlight');
                    setTimeout(() => cell.classList.remove('paste-highlight'), 1500);
                }
                pastedCount++;
            }
        }

        this.saveTestResults();

        if (window.showToast && pastedCount > 0) {
            window.showToast(`${pastedCount}개 셀에 데이터를 붙여넣었습니다.`, 'success');
        }
    }

    /**
     * contentEditable 셀에서 (선택) 시작 경계 앞에 텍스트가 없으면(맨 앞) true.
     * moveFocus 진입 시 전체 선택 상태여도 시작 경계가 셀 앞이면 true → 좌측 즉시 이동.
     */
    _caretAtCellStart(el) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return false;
        try {
            const r = sel.getRangeAt(0);
            const pre = r.cloneRange();
            pre.selectNodeContents(el);
            pre.setEnd(r.startContainer, r.startOffset);
            return pre.toString().length === 0;
        } catch { return false; }
    }

    /**
     * contentEditable 셀에서 (선택) 끝 경계 뒤에 텍스트가 없으면(맨 뒤) true.
     * 전체 선택 상태여도 끝 경계가 셀 뒤면 true → 우측 즉시 이동.
     */
    _caretAtCellEnd(el) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return false;
        try {
            const r = sel.getRangeAt(0);
            const post = r.cloneRange();
            post.selectNodeContents(el);
            post.setStart(r.endContainer, r.endOffset);
            return post.toString().length === 0;
        } catch { return false; }
    }

    handleKeydown(e) {
        // Arrow key navigation in editable cells
        const activeEl = document.activeElement;
        if (!activeEl || !activeEl.classList.contains('editable-cell')) return;

        // IME(한글 등) 조합 중 방향키는 후보/조합 확정용이므로 셀 이동으로 가로채지 않음
        if (e.isComposing) return;

        if (!this.focusedCell) return;

        const { rowIdx, colIdx } = this.focusedCell;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeEl.blur();
            this.moveFocus(rowIdx + 1, colIdx);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeEl.blur();
            this.moveFocus(rowIdx - 1, colIdx);
        } else if (e.key === 'ArrowLeft') {
            // 커서(또는 선택 시작)가 셀 맨 앞일 때만 왼쪽 셀로 이동.
            // 값 중간의 collapsed 커서는 기본 동작(텍스트 커서 좌로 이동) 유지 → 오타 수정 가능.
            if (this._caretAtCellStart(activeEl)) {
                e.preventDefault();
                activeEl.blur();
                this.moveFocus(rowIdx, colIdx - 1, -1);
            }
        } else if (e.key === 'ArrowRight') {
            // 커서(또는 선택 끝)가 셀 맨 뒤일 때만 오른쪽 셀로 이동.
            if (this._caretAtCellEnd(activeEl)) {
                e.preventDefault();
                activeEl.blur();
                this.moveFocus(rowIdx, colIdx + 1, 1);
            }
        }
    }

    // ========================================
    // 전체 선택 / 일괄 적용
    // ========================================

    toggleSelectAll(checked) {
        this.selectedKeys.clear();
        if (checked) {
            for (const row of this.flatRows) {
                this.selectedKeys.add(row.key);
            }
        }
        // UI 업데이트
        const checkboxes = this.tableBody?.querySelectorAll('input[type="checkbox"]');
        checkboxes?.forEach(cb => { cb.checked = checked; });
        this.updateSelectAllState();
    }

    updateSelectAllState() {
        if (this.selectAllCheckbox) {
            this.selectAllCheckbox.checked =
                this.flatRows.length > 0 && this.selectedKeys.size === this.flatRows.length;
            this.selectAllCheckbox.indeterminate =
                this.selectedKeys.size > 0 && this.selectedKeys.size < this.flatRows.length;
        }
    }

    applyBulkValues() {
        if (this.selectedKeys.size === 0) {
            if (window.showToast) window.showToast('선택된 항목이 없습니다.', 'warning');
            return;
        }

        const testDate = this.bulkTestDateInput?.value || '';
        const usageCode = this.bulkUsageCodeSelect?.value || '0';
        let applied = 0;

        for (const key of this.selectedKeys) {
            if (!this.testResults[key]) this.testResults[key] = {};

            if (testDate) {
                this.testResults[key].testDate = testDate;
            }
            this.testResults[key].usageCode = usageCode;
            applied++;
        }

        this.saveTestResults();
        this.render();

        if (window.showToast) {
            window.showToast(`${applied}건에 일괄 적용했습니다.`, 'success');
        }
    }

    // ========================================
    // 컬럼 표시/숨김
    // ========================================

    toggleHiddenColumns() {
        this.showAllColumns = !this.showAllColumns;
        this.applyColumnVisibility();

        const btn = this.toggleColumnsBtn;
        if (btn) {
            const icon = btn.querySelector('.material-icons-outlined');
            const label = btn.querySelector('.util-btn-label');
            if (icon) icon.textContent = this.showAllColumns ? 'visibility_off' : 'visibility';
            if (label) label.textContent = this.showAllColumns ? '간략보기' : '전체보기';
        }
    }

    applyColumnVisibility() {
        const allHideable = document.querySelectorAll('.hideable-col');
        allHideable.forEach(el => {
            if (this.showAllColumns) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    }

    // ========================================
    // 주소 파싱
    // ========================================

    /**
     * 필지 주소를 시도/시군구/읍면동/리/지번으로 파싱
     * "경상북도 봉화군 봉화읍 문단리 699-2" 형식
     */
    /**
     * 지번 주소 분해 — src/shared/lot-address-parser.js 위임 (SLS-1-200)
     * 퇴·액비 검정결과 페이지가 같은 규칙을 써야 해서 공유 모듈로 뺐다.
     */
    parseLotAddress(lotAddress) {
        return window.parseLotAddress(lotAddress);
    }

    // ========================================
    // 용도구분/경지구분 변환
    // ========================================

    /**
     * 용도구분 문자열 → 흙토람 코드 변환
     */
    getUsageCode(purpose, resultUsageCode, bulkValue) {
        // 검정 결과에 개별 지정된 용도구분이 있으면 우선
        if (resultUsageCode !== undefined && resultUsageCode !== '') {
            return resultUsageCode;
        }
        // 네비게이션 바 용도구분 선택값 사용
        if (bulkValue !== undefined && bulkValue !== '') {
            return bulkValue;
        }
        // 기본: 일반적인토양검정
        return '0';
    }

    /**
     * 경지구분 → 흙토람 1차 경지구분
     */
    getCategoryCode(subCategory) {
        const map = {
            '논': '논', '밭': '밭', '과수': '과수',
            '시설': '시설', '임야': '임야', '성토': '밭'
        };
        return map[subCategory] || '밭';
    }

    /**
     * 경지구분/작물에 따른 필수 검정 필드 반환
     */
    getRequiredFields(category, cropName) {
        const common = ['pH', 'organicMatter', 'availableP', 'exK', 'exCa', 'exMg', 'ec'];
        if (cropName && cropName.includes('블루베리')) {
            return new Set([...common, 'cec']);
        }
        if (category === '논') {
            return new Set([...common, 'silica']);
        }
        // 밭, 과수, 시설, 임야, 성토 등
        return new Set([...common, 'limeReq']);
    }

    /**
     * 용도(목적) → 흙토람 경지구분 2차
     */
    getCategory2(purpose) {
        const map = {
            '무농약': '무농약', '유기': '유기', 'GAP': 'GAP',
            '저탄소': '저탄소'
        };
        return map[purpose] || '';
    }

    /**
     * 시행전후 결정
     * 용도구분이 0(일반적인토양검정)이면 빈값
     */
    getBeforeAfter(usageCode) {
        if (usageCode === '0' || usageCode === '') return '';
        // bulkBeforeAfterSelect 값('N'/'Y')을 BC3/BD3 범례 표기('전-N'/'후-Y')와 일치시켜 출력
        const v = this.bulkBeforeAfterSelect?.value || 'N';
        return v === 'Y' ? '후-Y' : '전-N';
    }

    // ========================================
    // 흙토람 서식 내보내기
    // ========================================

    async exportToHeuktoram() {
        // 선택된 행만 내보내기 (선택 없으면 전체)
        let targetRows = this.flatRows;
        if (this.selectedKeys.size > 0) {
            targetRows = this.flatRows.filter(r => this.selectedKeys.has(r.key));
        }

        if (targetRows.length === 0) {
            if (window.showToast) window.showToast('내보낼 데이터가 없습니다.', 'warning');
            return;
        }

        if (targetRows.length > 300) {
            if (!confirm(`${targetRows.length}건을 내보냅니다. 흙토람은 300건 이하를 권장합니다. 계속하시겠습니까?`)) {
                return;
            }
        }

        try {
            const wb = XLSX.utils.book_new();
            const wsData = this.buildWorksheetData(targetRows);
            const ws = XLSX.utils.aoa_to_sheet(sanitizeExcelAoa(wsData));

            // 열 너비 설정
            ws['!cols'] = this.getColumnWidths();

            // 3행(대분류), 4행(소분류) 헤더 배경색 + 셀 병합 적용
            this.applyHeaderStyles(ws, wsData);
            this.applyHeaderMerges(ws);

            // 1행(제목)·2행(안내문) 행 높이 설정 — 서식.xlsx 원본 기준
            ws['!rows'] = ws['!rows'] || [];
            // 실물 서식 값 그대로 (SLS-1-210에서 대조).
            // 이전 값 30 / 369.5는 근거 없이 물려받은 것이었다.
            ws['!rows'][0] = { hpt: 31.5 };   // 1행 제목
            ws['!rows'][1] = { hpt: 309.75 }; // 2행 안내문 (wrapText 19줄)
            ws['!rows'][2] = { hpt: 17.45 };  // 3행 헤더

            // 1행(제목) 셀 스타일: 좌측 정렬 + 굵게 (서식.xlsx 원본 기준)
            const cellA1 = ws['A1'];
            if (cellA1) {
                cellA1.s = {
                    alignment: { horizontal: 'left' },
                    font: { bold: true, sz: 20, name: '맑은 고딕' }
                };
            }
            // 2행(안내문) 셀 스타일: 좌측·중앙 정렬 + wrapText
            const cellA2 = ws['A2'];
            if (cellA2) {
                cellA2.s = {
                    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
                    // 실물은 굵은 빨강 + 아래 테두리다 (fontId 4 = <b/> + color indexed="10",
                    // borderId 4 = bottom thin). A1은 테두리가 없어 우연이 아니다.
                    // 경고문이 눈에 띄어야 사용자가 읽는다 (SLS-1-212).
                    font: { bold: true, sz: 11, color: { rgb: 'FFFF0000' }, name: '맑은 고딕' },
                    border: { bottom: { style: 'thin', color: { rgb: 'FF000000' } } }
                };
            }

            // 실물 서식의 시트명이다. 흙토람 파서가 이름으로 찾을 경우를 대비해 맞춘다
            // (퇴비 내보내기도 같은 이름을 쓴다). 공익직불제는 별개 서식이라 그대로 둔다.
            XLSX.utils.book_append_sheet(wb, ws, '검정정보일괄입력');

            // xlsx-js-style은 dataValidation을 출력하지 않으므로 JSZip으로 후처리하여
            // 사용자가 엑셀에서 용도구분(G열) 셀을 클릭 시 드롭다운이 나타나도록 함
            const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const validations = this.buildDataValidations(targetRows.length);
            const patchedBuffer = await this.injectDataValidations(arrayBuffer, validations);

            const fileName = `흙토람_토양검정_${this.selectedYear}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            this.downloadBuffer(patchedBuffer, fileName);

            if (window.showToast) {
                window.showToast(`${targetRows.length}건 흙토람 서식으로 내보냈습니다.`, 'success');
            }
        } catch (e) {
            (window.logger?.error || console.error)('흙토람 내보내기 실패:', e);
            if (window.showToast) window.showToast('내보내기에 실패했습니다.', 'error');
        }
    }

    /**
     * 데이터 유효성 검사 규칙 목록 빌드.
     * F(용도구분)·G(시행 재배 전후)·U(성토여부) 세 열에 목록 검증을 건다.
     *
     * ⚠️ 열 문자를 바꿀 때는 buildWorksheetData의 헤더 위치와 반드시 맞출 것.
     *    어긋나면 showErrorMessage="1" 때문에 사용자가 그 칸에 값을 넣지 못한다 —
     *    v1.14.0에서 실제로 시료번호(H)·암모니아태질소(AH) 입력이 막혔다(SLS-1-210).
     */
    buildDataValidations(dataRowCount) {
        if (dataRowCount <= 0) return [];
        const startRow = 5;
        // 실물은 열 전체를 검증한다(F3:F1048576 등). 데이터 행 수로 끊으면 사용자가
        // 엑셀에서 행을 덧붙였을 때 그 행에는 드롭다운도 오입력 차단도 없다.
        const endRow = 1048576;
        // ⚠️ 열이 어긋나 있었다(SLS-1-210). 용도구분을 G, 시행전후를 H, 성토여부를 AH에
        //    걸고 있었는데 실제로는 각각 F·G·U다. showErrorMessage="1"이라 Excel이
        //    목록 밖 값을 거부하므로 **시료번호(H)에 숫자를, 암모니아태질소(AH)에
        //    수치를 넣을 수 없었다.** 정작 용도구분·성토여부에는 드롭다운이 없었다.
        //    실물 서식(tests/fixtures/heuktoram-soil-form.xlsx)·getColumnWidths()의
        //    주석·5행 예시값 셋이 F/G/U로 일치한다.
        //
        // 앞 둘은 실물처럼 **범례 셀 참조**를 쓴다. 범례(AJ~AO)가 시트에 이미 있으므로
        // 목록을 두 벌로 두지 않는다.
        return [
            {
                // F열: 용도구분 코드 → AJ3:AM3 범례
                sqref: `F${startRow}:F${endRow}`,
                formula: '$AJ$3:$AM$3'
            },
            {
                // G열: 시행(재배)전후 → AN3:AO3 범례
                // 빈값 허용(allowBlank=1) — 용도구분 0(일반)일 때 사용 안 함
                sqref: `G${startRow}:G${endRow}`,
                formula: '$AN$3:$AO$3'
            },
            {
                // U열: 성토여부 — 흙토람 안내문 "성토여부는 미해당, 해당으로 입력"
                sqref: `U${startRow}:U${endRow}`,
                options: ['미해당', '해당']
            }
        ];
    }

    /**
     * xlsx 파일은 ZIP 컨테이너이므로 JSZip으로 sheet XML을 풀어
     * <dataValidations> XML을 직접 삽입한 뒤 재압축한다.
     * SheetJS Community/xlsx-js-style이 dataValidation 출력을 지원하지 않아 사용.
     */
    async injectDataValidations(arrayBuffer, validations) {
        if (!validations || validations.length === 0) return arrayBuffer;
        const JSZip = window.JSZip;
        if (!JSZip) {
            (window.logger?.warn || console.warn)('JSZip 미사용. 드롭다운 적용 생략.');
            return arrayBuffer;
        }

        const zip = await JSZip.loadAsync(arrayBuffer);
        const sheetXmlPath = 'xl/worksheets/sheet1.xml';
        const sheetFile = zip.file(sheetXmlPath);
        if (!sheetFile) return arrayBuffer;

        let xml = await sheetFile.async('string');
        const dvXml = this.buildDataValidationsXml(validations);

        // Excel 스펙: dataValidations는 mergeCells 다음 위치에 와야 함
        if (xml.indexOf('</mergeCells>') !== -1) {
            xml = xml.replace('</mergeCells>', '</mergeCells>' + dvXml);
        } else if (xml.indexOf('</sheetData>') !== -1) {
            xml = xml.replace('</sheetData>', '</sheetData>' + dvXml);
        }

        zip.file(sheetXmlPath, xml);
        return await zip.generateAsync({ type: 'arraybuffer' });
    }

    /**
     * dataValidations XML 빌드
     * formula1 안의 인라인 목록은 큰따옴표로 감싸고 콤마로 구분 (Excel 스펙).
     * XML 안의 큰따옴표는 &quot;로 이스케이프.
     */
    buildDataValidationsXml(validations) {
        const parts = validations.map(v => {
            // formula가 있으면 셀 참조($AJ$3:$AM$3), 없으면 인라인 목록("가,나").
            // 참조는 따옴표로 감싸면 안 된다 — 감싸면 문자열 리터럴이 되어 드롭다운이 깨진다.
            const f1 = v.formula
                ? v.formula
                : `&quot;${v.options.join(',')}&quot;`;
            return (
                '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"'
                + ` sqref="${v.sqref}">`
                + `<formula1>${f1}</formula1>`
                + '</dataValidation>'
            );
        });
        return `<dataValidations count="${validations.length}">${parts.join('')}</dataValidations>`;
    }

    /**
     * ArrayBuffer를 Blob으로 변환 후 다운로드
     */
    downloadBuffer(arrayBuffer, fileName) {
        const blob = new Blob([arrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    buildWorksheetData(rows) {
        const collectYear = this.collectYearInput?.value || this.selectedYear;

        // 헤더 4행(제목·안내문·대분류·소분류)은 정적 템플릿 상수에서 생성
        const data = [
            makeWsRow({ 0: HEUKTORAM_WS_TITLE }),
            makeWsRow({ 0: HEUKTORAM_WS_GUIDE }),
            makeWsRow(HEUKTORAM_WS_HEADER3),
            makeWsRow(HEUKTORAM_WS_HEADER4),
        ];

        // 5행부터 데이터
        for (const row of rows) {
            data.push(this._buildHeuktoramDataRow(row, collectYear));
        }
        return data;
    }

    /**
     * 흙토람 양식 데이터 행 1건 생성 (열 0~33, 34는 스페이서 공백).
     * @param {Object} row - { key, isSubLot, parcel, subLot, log, crop, baseReceptionNumber }
     * @param {string} collectYear
     * @returns {Array} 41열 데이터 행
     */
    _buildHeuktoramDataRow(row, collectYear) {
        const result = this.testResults[row.key] || {};
        const lotAddr = row.isSubLot && row.subLot
            ? (row.subLot.lotAddress || row.parcel?.lotAddress || '')
            : (row.parcel?.lotAddress || '');

        // isMountain 판정: subLot에도 있을 수 있고, parcel에도 있을 수 있음
        let isMountain = false;
        if (row.isSubLot && row.subLot) {
            isMountain = row.subLot.isMountain || false;
        } else if (row.parcel) {
            isMountain = row.parcel.isMountain || false;
        }

        const lotParsed = this.parseLotAddress(lotAddr);
        if (isMountain) lotParsed.isMountain = true;

        const category = row.parcel?.category || row.log.subCategory || '';
        const purpose = row.parcel?.purpose || row.log.purpose || '';
        const usageCode = this.getUsageCode(purpose, result.usageCode, this.bulkUsageCodeSelect?.value);
        const soiling = (result.soiling === '해당' || category === '성토') ? '해당' : '미해당';

        // 면적: 평 단위면 ㎡로 변환
        let areaM2 = row.crop?.area || '';
        if (areaM2 && row.crop?.unit === 'pyeong') {
            const parsed = parseFloat(areaM2);
            if (!isNaN(parsed)) areaM2 = Math.round(parsed * PYEONG_TO_SQM);
        }

        const dataRow = new Array(HEUKTORAM_WS_COLS).fill('');
        dataRow[0] = row.isSubLot ? '하위필지' : '필지';
        dataRow[1] = collectYear;
        dataRow[2] = row.log.date || '';
        dataRow[3] = (row.log.landClass1 && String(row.log.landClass1).trim()) || '농가의뢰';
        dataRow[4] = this.getCategoryCode(category);
        dataRow[5] = HEUKTORAM_WS_USAGE_LABELS[usageCode] || '일반적인토양검정-0';
        dataRow[6] = this.getBeforeAfter(usageCode);
        dataRow[7] = row.baseReceptionNumber || String(row.log.receptionNumber || '').replace(/-\d+$/, '') || '';
        dataRow[8] = lotParsed.sido;
        dataRow[9] = lotParsed.sigungu;
        dataRow[10] = lotParsed.eupmyeondong;
        dataRow[11] = lotParsed.ri;
        dataRow[12] = lotParsed.isMountain ? '산' : '';
        dataRow[13] = lotParsed.jibun1;
        dataRow[14] = lotParsed.jibun2;
        dataRow[15] = ''; // 주소매핑여부
        dataRow[16] = row.parcel?.note || ''; // 기타주소
        dataRow[17] = areaM2;
        dataRow[18] = result.testDate || '';
        dataRow[19] = row.crop?.name || row.crop?.code || '';
        dataRow[20] = soiling;
        dataRow[21] = result.clay || '';
        dataRow[22] = result.pH || '';
        dataRow[23] = result.organicMatter || '';
        dataRow[24] = result.availableP || '';
        dataRow[25] = result.exK || '';
        dataRow[26] = result.exCa || '';
        dataRow[27] = result.exMg || '';
        dataRow[28] = result.silica || '';
        dataRow[29] = result.ec || '';
        dataRow[30] = result.limeReq || '';
        dataRow[31] = result.NO3N || '';
        dataRow[32] = result.cec || '';
        dataRow[33] = result.NH4N || '';
        // [34]~[40]은 스페이서/코드범례 전용 — 데이터 행에는 항상 공백(배열 초기화값 유지)
        return dataRow;
    }

    getColumnWidths() {
        return [
            { wch: 12 }, // [0]  필지구분
            { wch: 10 }, // [1]  채취년도
            { wch: 20 }, // [2]  분석의뢰일(접수일자)
            { wch: 10 }, // [3]  경지구분 1차
            { wch: 8 },  // [4]  경지구분 2차
            { wch: 20 }, // [5]  용도구분 코드
            { wch: 16 }, // [6]  시행(재배)전후
            { wch: 10 }, // [7]  시료번호
            { wch: 12 }, // [8]  대상지 시도
            { wch: 10 }, // [9]  시군구
            { wch: 10 }, // [10] 읍면동
            { wch: 8 },  // [11] 리
            { wch: 10 }, // [12] 지번 구분
            { wch: 8 },  // [13] 지번1
            { wch: 8 },  // [14] 지번2
            { wch: 14 }, // [15] 주소매핑여부
            { wch: 10 }, // [16] 기타주소
            { wch: 10 }, // [17] 면적(㎡)
            { wch: 14 }, // [18] 토양검정일
            { wch: 22 }, // [19] 작물명 또는 작물코드
            { wch: 12 }, // [20] 성토여부
            { wch: 10 }, // [21] 점토함량
            { wch: 6 },  // [22] pH
            { wch: 8 },  // [23] 유기물
            { wch: 10 }, // [24] 유효인산
            { wch: 12 }, // [25] 교환성 칼륨
            { wch: 12 }, // [26] 교환성 칼슘
            { wch: 12 }, // [27] 교환성 마그네슘
            { wch: 10 }, // [28] 유효규산
            { wch: 12 }, // [29] 전기전도도
            { wch: 12 }, // [30] 석회소요량
            { wch: 12 }, // [31] 질산태질소
            { wch: 12 }, // [32] 양이온 치환용량
            { wch: 12 }, // [33] 암모니아태 질소
            // 스페이서와 범례는 실물 서식에서 숨김이다(SLS-1-210). 안 숨기면 사용자가
            // '일반적인토양검정-0' 같은 범례를 입력해야 할 데이터 열로 착각한다.
            // 데이터 검증이 이 범례를 참조하므로 열 자체를 지우면 안 된다.
            { wch: 12, hidden: true }, // [34] (스페이서)
            { wch: 22, hidden: true }, // [35] 일반적인토양검정-0
            { wch: 18, hidden: true }, // [36] 토양개량제 규산-1
            { wch: 20, hidden: true }, // [37] 토양개량제 석회질-2
            { wch: 12, hidden: true }, // [38] 녹비작물-3
            { wch: 8,  hidden: true }, // [39] 전-N
            { wch: 8,  hidden: true }, // [40] 후-Y
        ];
    }

    /**
     * 엑셀 3행(대분류), 4행(소분류) 헤더에 배경색 적용
     */
    applyHeaderStyles(ws, wsData) {
        const colCount = wsData[0]?.length || HEUKTORAM_WS_COLS;

        // 3행 (인덱스 2): 대분류 - 회색 (서식.xlsx 원본 indexed=22 = #C0C0C0)
        const row3Style = {
            fill: { fgColor: { rgb: 'C0C0C0' } },
            font: { bold: true, sz: 10 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: '808080' } },
                bottom: { style: 'thin', color: { rgb: '808080' } },
                left: { style: 'thin', color: { rgb: '808080' } },
                right: { style: 'thin', color: { rgb: '808080' } }
            }
        };

        // 4행 (인덱스 3): 소분류 - 회색 (서식.xlsx 원본 indexed=22 = #C0C0C0)
        const row4Style = {
            fill: { fgColor: { rgb: 'C0C0C0' } },
            font: { bold: true, sz: 9 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: '808080' } },
                bottom: { style: 'thin', color: { rgb: '808080' } },
                left: { style: 'thin', color: { rgb: '808080' } },
                right: { style: 'thin', color: { rgb: '808080' } }
            }
        };

        // 데이터 행 스타일 (5행~): 가운데 정렬 + 테두리
        const dataStyle = {
            // 실물은 전 데이터 셀이 텍스트 서식이다(numFmtId 49). 없으면 사용자가 내보낸 뒤
            // 날짜 칸을 고칠 때 Excel이 일련번호로 바꿔 업로드가 깨진다 (SLS-1-212).
            // 퇴비 내보내기는 SLS-1-200에서 이미 강제했는데 토양만 빠져 있었다.
            numFmt: '@',
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: '808080' } },
                bottom: { style: 'thin', color: { rgb: '808080' } },
                left: { style: 'thin', color: { rgb: '808080' } },
                right: { style: 'thin', color: { rgb: '808080' } }
            }
        };

        const rowCount = wsData.length;
        // 데이터 영역은 0~33만 스타일 적용, 스페이서(34)/코드 범례 영역(35~40)은 무색
        const DATA_COL_END = 34;

        for (let c = 0; c < colCount; c++) {
            const col = XLSX.utils.encode_col(c);

            // 3행 (엑셀 행3 = 인덱스 2) — 헤더 스타일은 데이터 영역(0~33)에만 적용
            const cell3Addr = col + '3';
            if (c < DATA_COL_END) {
                if (!ws[cell3Addr]) ws[cell3Addr] = { v: '', t: 's' };
                ws[cell3Addr].s = row3Style;
            } else if (ws[cell3Addr] && ws[cell3Addr].v !== '' && ws[cell3Addr].v !== undefined) {
                // 코드 범례 영역(35~40): 배경/굵기/테두리 없이 일반 셀 (서식.xlsx 원본 기준)
                // 스페이서(34)는 값이 항상 빈 문자열이라 이 분기를 타도 스타일이 부여되지 않음(무색 유지)
                ws[cell3Addr].s = {
                    font: { sz: 11, name: '맑은 고딕' },
                    alignment: { horizontal: 'center', vertical: 'center' }
                };
            }

            // 4행 (엑셀 행4 = 인덱스 3) — 데이터 영역만
            if (c < DATA_COL_END) {
                const cell4Addr = col + '4';
                if (!ws[cell4Addr]) ws[cell4Addr] = { v: '', t: 's' };
                ws[cell4Addr].s = row4Style;
            }

            // 5행~ 데이터 행: 데이터 영역(0~33)만 스타일 적용
            if (c < DATA_COL_END) {
                for (let r = 4; r < rowCount; r++) {
                    const addr = col + (r + 1);
                    if (!ws[addr]) ws[addr] = { v: '', t: 's' };
                    ws[addr].s = dataStyle;
                }
            }
        }
    }

    /**
     * 엑셀 3-4행 헤더 셀 병합 적용
     * 3행-4행 세로 병합: 단독 컬럼 (채취년도, 분석의뢰일 등)
     * 3행 가로 병합: 하위 분류가 있는 그룹 (경지구분, 대상지 주소 등)
     */
    applyHeaderMerges(ws) {
        const merges = [
            // 1행: 제목 A1:AH1 병합 (0~33, 스페이서 34는 제외)
            { s: { r: 0, c: 0 }, e: { r: 0, c: 33 } },
            // 2행: 안내 A2:AH2 병합
            { s: { r: 1, c: 0 }, e: { r: 1, c: 33 } },

            // 3행-4행 세로 병합 (단독 컬럼)
            { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },   // 필지구분
            { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },   // 채취년도
            { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } },   // 분석의뢰일
            { s: { r: 2, c: 7 }, e: { r: 3, c: 7 } },   // 시료번호
            { s: { r: 2, c: 12 }, e: { r: 3, c: 12 } }, // 지번 구분
            { s: { r: 2, c: 15 }, e: { r: 3, c: 15 } }, // 주소매핑여부
            { s: { r: 2, c: 16 }, e: { r: 3, c: 16 } }, // 기타주소
            { s: { r: 2, c: 17 }, e: { r: 3, c: 17 } }, // 면적
            { s: { r: 2, c: 18 }, e: { r: 3, c: 18 } }, // 토양검정일
            { s: { r: 2, c: 19 }, e: { r: 3, c: 19 } }, // 작물명
            { s: { r: 2, c: 20 }, e: { r: 3, c: 20 } }, // 성토여부
            { s: { r: 2, c: 21 }, e: { r: 3, c: 21 } }, // 점토함량
            { s: { r: 2, c: 22 }, e: { r: 3, c: 22 } }, // pH
            { s: { r: 2, c: 23 }, e: { r: 3, c: 23 } }, // 유기물
            { s: { r: 2, c: 24 }, e: { r: 3, c: 24 } }, // 유효인산
            { s: { r: 2, c: 25 }, e: { r: 3, c: 25 } }, // 교환성칼륨
            { s: { r: 2, c: 26 }, e: { r: 3, c: 26 } }, // 교환성칼슘
            { s: { r: 2, c: 27 }, e: { r: 3, c: 27 } }, // 교환성마그네슘
            { s: { r: 2, c: 28 }, e: { r: 3, c: 28 } }, // 유효규산
            { s: { r: 2, c: 29 }, e: { r: 3, c: 29 } }, // 전기전도도
            { s: { r: 2, c: 30 }, e: { r: 3, c: 30 } }, // 석회소요량
            { s: { r: 2, c: 31 }, e: { r: 3, c: 31 } }, // 질산태질소
            { s: { r: 2, c: 32 }, e: { r: 3, c: 32 } }, // 양이온치환용량
            { s: { r: 2, c: 33 }, e: { r: 3, c: 33 } }, // 암모니아태질소

            // 3행 가로 병합 (그룹 헤더)
            { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } },   // 경지구분
            { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } },   // 용도구분
            { s: { r: 2, c: 8 }, e: { r: 2, c: 11 } },  // 대상지 주소
            { s: { r: 2, c: 13 }, e: { r: 2, c: 14 } }, // 지번
        ];

        ws['!merges'] = (ws['!merges'] || []).concat(merges);
    }

    // ========================================
    // 공익직불제 이행점검 서식 내보내기 (40열, C열부터)
    // ========================================

    /**
     * 공익직불제 "직불제 이행점검 1차 신규입력" 양식으로 내보내기.
     * 검정값·토양검정일 등 데이터 소스는 흙토람 export(buildWorksheetData)와 동일.
     * 데이터는 C열(인덱스 2)부터, A·B열은 비움. 헤더 2단(대분류 2행, 소분류 3행).
     */
    async exportToGongik() {
        let targetRows = this.flatRows;
        if (this.selectedKeys.size > 0) {
            targetRows = this.flatRows.filter(r => this.selectedKeys.has(r.key));
        }

        if (targetRows.length === 0) {
            if (window.showToast) window.showToast('내보낼 데이터가 없습니다.', 'warning');
            return;
        }

        if (targetRows.length > 300) {
            if (!confirm(`${targetRows.length}건을 내보냅니다. 공익직불제 일괄등록은 1회 300건 이하를 권장합니다. 계속하시겠습니까?`)) {
                return;
            }
        }

        try {
            const wb = XLSX.utils.book_new();
            const wsData = this.buildGongikWorksheetData(targetRows);
            const ws = XLSX.utils.aoa_to_sheet(sanitizeExcelAoa(wsData));

            ws['!cols'] = this.getGongikColumnWidths();
            this.applyGongikHeaderStyles(ws, wsData);
            this.applyGongikHeaderMerges(ws);

            // 1행(안내문) 높이 — wrapText 멀티라인
            ws['!rows'] = ws['!rows'] || [];
            ws['!rows'][0] = { hpt: 150 };

            XLSX.utils.book_append_sheet(wb, ws, '일괄등록양식');

            const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const validations = this.buildGongikDataValidations(targetRows.length);
            const patchedBuffer = await this.injectDataValidations(arrayBuffer, validations);

            const fileName = `공익직불제_이행점검_${this.selectedYear}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            this.downloadBuffer(patchedBuffer, fileName);

            if (window.showToast) {
                window.showToast(`${targetRows.length}건 공익직불제 양식으로 내보냈습니다.`, 'success');
            }
        } catch (e) {
            (window.logger?.error || console.error)('공익직불제 내보내기 실패:', e);
            if (window.showToast) window.showToast('내보내기에 실패했습니다.', 'error');
        }
    }

    /**
     * 공익직불제 용도구분 코드 → 라벨 (흙토람 용도구분 라벨과 동일 기준)
     */
    getGongikUsageLabel(usageCode) {
        const usageLabels = {
            '0': '일반적인토양검정',
            '1': '토양개량제 규산',
            '2': '토양개량제 석회질',
            '3': '녹비작물'
        };
        return usageLabels[usageCode] || '일반적인토양검정';
    }

    /**
     * 공익직불제 시행전후 표기 (영문 BEFORE/AFTER).
     * 용도구분 0(일반)이면 빈값. 시행전후 미선택(해당없음)도 빈값.
     */
    getGongikBeforeAfter(usageCode) {
        // 공익직불제 양식 규칙: 용도구분=일반적인토양검정(0)이면 시행 후(AFTER)로 입력
        if (usageCode === '0' || usageCode === '') return 'AFTER';
        const v = this.bulkBeforeAfterSelect?.value || '';
        if (v === 'Y') return 'AFTER';
        if (v === 'N') return 'BEFORE';
        return '';
    }

    /**
     * 공익직불제 경지구분 1차 매핑.
     * row.log.landClass1 === '공익직불제' → '직불(일반)', 그 외 값은 원문 출력.
     */
    getGongikLandClass1(landClass1) {
        const v = (landClass1 && String(landClass1).trim()) || '';
        if (v === '공익직불제') return '직불(일반)';
        return v;
    }

    /**
     * 공익직불제 AOA(행 배열) 빌드.
     * 40개 데이터 컬럼을 C열(인덱스 2)부터 배치. A·B(0,1)는 비움.
     * 컬럼 절대 인덱스: C=2, D=3, ... AN=39.
     */
    buildGongikWorksheetData(rows) {
        const collector = this.collectorInput?.value || '';

        // 헤더 3행(안내문·대분류·소분류)은 C 기준 상대 컬럼맵 상수에서 생성
        const data = [
            makeGongikRow({ 0: GONGIK_WS_GUIDE }),
            makeGongikRow(GONGIK_WS_HEADER2),
            makeGongikRow(GONGIK_WS_HEADER3),
        ];

        // 4행~: 데이터
        for (const row of rows) {
            data.push(this._buildGongikDataRow(row, collector));
        }
        return data;
    }

    /**
     * 공익직불제 양식 데이터 행 1건 생성 (C 기준 상대 인덱스 → 절대 인덱스 C+offset).
     * @param {Object} row - { key, isSubLot, parcel, subLot, log, crop, baseReceptionNumber }
     * @param {string} collector
     * @returns {Array} 데이터 행
     */
    _buildGongikDataRow(row, collector) {
        const C = GONGIK_WS_C;
        const result = this.testResults[row.key] || {};

        const lotAddr = row.isSubLot && row.subLot
            ? (row.subLot.lotAddress || row.parcel?.lotAddress || '')
            : (row.parcel?.lotAddress || '');

        let isMountain = false;
        if (row.isSubLot && row.subLot) {
            isMountain = row.subLot.isMountain || false;
        } else if (row.parcel) {
            isMountain = row.parcel.isMountain || false;
        }

        const lotParsed = this.parseLotAddress(lotAddr);
        if (isMountain) lotParsed.isMountain = true;

        const category = row.parcel?.category || row.log.subCategory || '';
        const purpose = row.parcel?.purpose || row.log.purpose || '';
        const usageCode = this.getUsageCode(purpose, result.usageCode, this.bulkUsageCodeSelect?.value);

        // 면적: 평이면 ㎡로 변환 (흙토람 export 로직과 동일)
        let areaM2 = row.crop?.area || '';
        if (areaM2 && row.crop?.unit === 'pyeong') {
            const parsed = parseFloat(areaM2);
            if (!isNaN(parsed)) areaM2 = Math.round(parsed * PYEONG_TO_SQM);
        }

        const dataRow = new Array(GONGIK_WS_TOTAL_COLS + C).fill('');
        dataRow[C + 0] = row.log.gongikOrder || '1';                               // C 차수(1차/2차) — 행별 값
        dataRow[C + 1] = row.log.date || '';                                       // D 시료채취일자
        dataRow[C + 2] = result.testDate || '';                                    // E 토양검정일
        dataRow[C + 3] = row.log.date || '';                                       // F 분석의뢰일(접수일자)
        dataRow[C + 4] = this.getGongikUsageLabel(usageCode);                      // G 용도구분-구분
        dataRow[C + 5] = this.getGongikBeforeAfter(usageCode);                     // H 시행전후
        dataRow[C + 6] = collector || row.log.name || '';                          // I 채취자명
        dataRow[C + 7] = row.baseReceptionNumber || String(row.log.receptionNumber || '').replace(/-\d+$/, '') || ''; // J 시료번호
        dataRow[C + 8] = row.log.businessRegNo || '';                              // K 경영체등록번호
        dataRow[C + 9] = row.log.name || '';                                       // L 경작자명
        dataRow[C + 10] = lotParsed.sido;                                          // M 시도
        dataRow[C + 11] = lotParsed.sigungu;                                       // N 시군구
        dataRow[C + 12] = lotParsed.eupmyeondong;                                  // O 읍면동
        dataRow[C + 13] = lotParsed.ri;                                            // P 리
        dataRow[C + 14] = lotParsed.isMountain ? '산' : '일반';                    // Q 일반·산
        dataRow[C + 15] = lotParsed.jibun1;                                        // R 지번1
        dataRow[C + 16] = lotParsed.jibun2;                                        // S 지번2
        dataRow[C + 17] = row.parcel?.note || '';                                  // T 상세주소
        dataRow[C + 18] = this.getGongikLandClass1(row.log.landClass1);            // U 경지구분 1차
        dataRow[C + 19] = this.getCategoryCode(category);                          // V 경지구분 2차
        dataRow[C + 20] = row.log.addressRoad || row.log.address || '';            // W 경작자 주소
        dataRow[C + 21] = (row.log.phoneNumber || '').replace(/-/g, '');           // 신청자 전화번호
        dataRow[C + 22] = areaM2;                                                  // 대상지면적
        dataRow[C + 23] = row.crop?.name || row.crop?.code || '';                  // 작물명 또는 작물코드
        dataRow[C + 24] = row.log.gongikBaseYear || '';                            // 기준년도 — 행별 값
        dataRow[C + 25] = result.clay || '';                                       // 점토함량
        dataRow[C + 26] = result.pH || '';                                         // pH
        dataRow[C + 27] = result.organicMatter || '';                              // 유기물
        dataRow[C + 28] = result.availableP || '';                                 // 유효인산
        dataRow[C + 29] = result.exK || '';                                        // 교환성칼륨
        dataRow[C + 30] = result.exCa || '';                                       // 교환성칼슘
        dataRow[C + 31] = result.exMg || '';                                       // 교환성마그네슘
        dataRow[C + 32] = result.silica || '';                                     // 유효규산
        dataRow[C + 33] = result.ec || '';                                         // 전기전도도
        dataRow[C + 34] = result.limeReq || '';                                    // 석회소요량
        dataRow[C + 35] = result.NO3N || '';                                       // 질산태질소
        dataRow[C + 36] = result.cec || '';                                        // 양이온치환용량
        dataRow[C + 37] = result.NH4N || '';                                       // 암모니아태질소
        return dataRow;
    }

    getGongikColumnWidths() {
        // A,B(빈열) 숨김 + 40개 데이터열
        const widths = [{ hidden: true }, { hidden: true }];
        const dataWidths = [
            6,   // C 차수
            14,  // D 시료채취일자
            14,  // E 토양검정일
            18,  // F 분석의뢰일
            18,  // G 용도구분-구분
            10,  // H 시행전후
            10,  // I 채취자명
            10,  // J 시료번호
            16,  // K 경영체등록번호
            10,  // L 경작자명
            12,  // M 시도
            10,  // N 시군구
            10,  // O 읍면동
            8,   // P 리
            8,   // Q 일반·산
            8,   // R 지번1
            8,   // S 지번2
            16,  // T 상세주소
            12,  // U 경지구분 1차
            10,  // V 경지구분 2차
            24,  // W 경작자 주소
            16,  // X 신청자 전화번호
            12,  // Y 대상지면적
            18,  // Z 작물명/코드
            14,  // AA 기준년도
            10,  // AB 점토함량
            6,   // AC pH
            8,   // AD 유기물
            10,  // AE 유효인산
            12,  // AF 교환성칼륨
            12,  // AG 교환성칼슘
            12,  // AH 교환성마그네슘
            10,  // AI 유효규산
            12,  // AJ 전기전도도
            12,  // AK 석회소요량
            12,  // AL 질산태질소
            12,  // AM 양이온치환용량
            12,  // AN 암모니아태질소
        ];
        for (const w of dataWidths) widths.push({ wch: w });
        return widths;
    }

    /**
     * 공익직불제 헤더 스타일.
     * 2행(대분류)·3행(소분류) 회색 배경 + 테두리, 5행~ 데이터 테두리.
     * 데이터 영역은 C(2) ~ AN(39).
     */
    applyGongikHeaderStyles(ws, wsData) {
        const DATA_START = 2;   // C
        const DATA_END = 40;    // exclusive (C..AN = 인덱스 2..39 → end 40)
        const rowCount = wsData.length;

        const headerBase = {
            fill: { fgColor: { rgb: 'C0C0C0' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: '808080' } },
                bottom: { style: 'thin', color: { rgb: '808080' } },
                left: { style: 'thin', color: { rgb: '808080' } },
                right: { style: 'thin', color: { rgb: '808080' } }
            }
        };
        const row2Style = { ...headerBase, font: { bold: true, sz: 10 } };
        const row3Style = { ...headerBase, font: { bold: true, sz: 9 } };
        const dataStyle = {
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: '808080' } },
                bottom: { style: 'thin', color: { rgb: '808080' } },
                left: { style: 'thin', color: { rgb: '808080' } },
                right: { style: 'thin', color: { rgb: '808080' } }
            }
        };

        for (let c = DATA_START; c < DATA_END; c++) {
            const col = XLSX.utils.encode_col(c);

            // 2행(엑셀 행2 = 인덱스 1)
            const cell2 = col + '2';
            if (!ws[cell2]) ws[cell2] = { v: '', t: 's' };
            ws[cell2].s = row2Style;

            // 3행(엑셀 행3 = 인덱스 2)
            const cell3 = col + '3';
            if (!ws[cell3]) ws[cell3] = { v: '', t: 's' };
            ws[cell3].s = row3Style;

            // 4행~ 데이터 (인덱스 3부터)
            for (let r = 3; r < rowCount; r++) {
                const addr = col + (r + 1);
                if (!ws[addr]) ws[addr] = { v: '', t: 's' };
                ws[addr].s = dataStyle;
            }
        }

        // 1행 안내문 셀 스타일
        const cellC1 = ws['C1'];
        if (cellC1) {
            cellC1.s = {
                alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
                font: { sz: 11, name: '맑은 고딕' }
            };
        }
    }

    /**
     * 공익직불제 헤더 병합 (2단 구조).
     * 절대 인덱스 기준: C=2 ... AN=39.
     */
    applyGongikHeaderMerges(ws) {
        const C = 2;
        const merges = [
            // 1행: 안내문 C1 ~ AN1 병합
            { s: { r: 0, c: C }, e: { r: 0, c: C + 37 } },

            // 2행-3행 세로 병합 (단독 컬럼)
            { s: { r: 1, c: C + 0 }, e: { r: 2, c: C + 0 } },   // 차수
            { s: { r: 1, c: C + 1 }, e: { r: 2, c: C + 1 } },   // 시료채취일자
            { s: { r: 1, c: C + 2 }, e: { r: 2, c: C + 2 } },   // 토양검정일
            { s: { r: 1, c: C + 3 }, e: { r: 2, c: C + 3 } },   // 분석의뢰일
            { s: { r: 1, c: C + 6 }, e: { r: 2, c: C + 6 } },   // 채취자명
            { s: { r: 1, c: C + 7 }, e: { r: 2, c: C + 7 } },   // 시료번호
            { s: { r: 1, c: C + 8 }, e: { r: 2, c: C + 8 } },   // 경영체등록번호
            { s: { r: 1, c: C + 9 }, e: { r: 2, c: C + 9 } },   // 경작자명
            { s: { r: 1, c: C + 17 }, e: { r: 2, c: C + 17 } }, // 상세주소
            { s: { r: 1, c: C + 20 }, e: { r: 2, c: C + 20 } }, // 경작자 주소
            { s: { r: 1, c: C + 21 }, e: { r: 2, c: C + 21 } }, // 신청자 전화번호
            { s: { r: 1, c: C + 22 }, e: { r: 2, c: C + 22 } }, // 대상지면적
            { s: { r: 1, c: C + 23 }, e: { r: 2, c: C + 23 } }, // 작물명/코드
            { s: { r: 1, c: C + 24 }, e: { r: 2, c: C + 24 } }, // 기준년도

            // 2행 가로 병합 (그룹 헤더)
            { s: { r: 1, c: C + 4 }, e: { r: 1, c: C + 5 } },    // 용도구분 (구분/시행전후)
            { s: { r: 1, c: C + 10 }, e: { r: 1, c: C + 16 } },  // 대상지 (시도~지번2)
            { s: { r: 1, c: C + 18 }, e: { r: 1, c: C + 19 } },  // 경지구분 (1차/2차)
            { s: { r: 1, c: C + 25 }, e: { r: 1, c: C + 37 } },  // 화학성분값
        ];
        ws['!merges'] = (ws['!merges'] || []).concat(merges);
    }

    /**
     * 공익직불제 데이터 유효성(드롭다운) 규칙.
     * 절대열 기준: G=용도구분 구분(C+4), H=시행전후(C+5), Q=일반·산(C+14).
     */
    buildGongikDataValidations(dataRowCount) {
        if (dataRowCount <= 0) return [];
        const startRow = 4;
        const endRow = 3 + dataRowCount;
        const colG = XLSX.utils.encode_col(2 + 4);   // 용도구분 구분
        const colH = XLSX.utils.encode_col(2 + 5);   // 시행전후
        const colQ = XLSX.utils.encode_col(2 + 14);  // 일반·산
        return [
            {
                sqref: `${colG}${startRow}:${colG}${endRow}`,
                options: ['일반적인토양검정', '토양개량제 규산', '토양개량제 석회질', '녹비작물']
            },
            {
                sqref: `${colH}${startRow}:${colH}${endRow}`,
                options: ['BEFORE', 'AFTER']
            },
            {
                sqref: `${colQ}${startRow}:${colQ}${endRow}`,
                options: ['일반', '산']
            }
        ];
    }

}

// 유닛 테스트에서 프로토타입 메서드(_caretAtCell* 등) 접근용 노출 (SLS-1-180)
window.HeuktoramManager = HeuktoramManager;

// ========================================
// 페이지 초기화
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // yearSelect 동적 생성 (현재 연도 기준 -2 ~ +5)
    const yearSelect = document.getElementById('yearSelect');
    if (yearSelect) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 2; y <= currentYear + 5; y++) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            yearSelect.appendChild(opt);
        }
    }

    window.heuktoramManager = new HeuktoramManager();
});
