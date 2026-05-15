// ========================================
// 공통 상수 정의
// 매직 넘버를 의미 있는 상수로 관리
// ========================================

/**
 * DEBUG 모드 설정
 * - 개발 환경에서만 활성화
 * - localStorage에서 DEBUG_MODE=true로 수동 활성화 가능
 */
const DEBUG = (() => {
    // Node.js 환경 (Electron main process)
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.NODE_ENV === 'development') return true;
    }

    // 브라우저 환경
    if (typeof localStorage !== 'undefined') {
        if (localStorage.getItem('DEBUG_MODE') === 'true') return true;
    }

    // 기본값: false (프로덕션)
    return false;
})();

/**
 * 앱 버전
 */
const APP_VERSION = '1.2.1';

/**
 * 페이지네이션 관련 상수
 */
const PAGINATION = {
    DEFAULT_ITEMS_PER_PAGE: 100,
    MIN_ITEMS_PER_PAGE: 10,
    MAX_ITEMS_PER_PAGE: 500,
    PAGE_NUMBER_DISPLAY_COUNT: 5
};

/**
 * UI 타이머 관련 상수 (ms)
 */
const TIMER = {
    TOAST_DURATION: 3000,
    TOAST_FADE_OUT: 300,
    DEBOUNCE_DELAY: 300,
    AUTO_SAVE_DELAY: 1000,
    UI_INIT_DELAY: 500,
    ANIMATION_DURATION: 300,
    AUTOCOMPLETE_DELAY: 200
};

/**
 * 자동완성 관련 상수
 */
const AUTOCOMPLETE = {
    MAX_SUGGESTIONS: 50,
    MIN_INPUT_LENGTH: 1
};

// LOCAL_REGIONS 제거됨 - 자동완성은 juso API(전국 데이터) 기반으로 동작

/**
 * 시도 제거 패턴 (목록/내보내기 표시용)
 * SLS-1-20: 메인 SAMPL-1-48 회귀 사전 차단. 정적 데이터 제거 시 누락 방지.
 * 자동완성과 무관. 단순 표시 단계에서 광역시·도 prefix 제거 용도.
 */
const SIDO_PATTERN = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|경기도|강원도|강원특별자치도|충청북도|충청남도|전라북도|전북특별자치도|전라남도|경상북도|경상남도|제주도|제주특별자치도)\s*/;
window.SIDO_PATTERN = SIDO_PATTERN;

/**
 * 저장소 관련 상수
 */
const STORAGE = {
    LOCAL_STORAGE_LIMIT_MB: 5,
    LOCAL_STORAGE_LIMIT_BYTES: 5 * 1024 * 1024,
    WARNING_THRESHOLD_PERCENT: 80
};

/**
 * 파일 관련 상수
 */
const FILE = {
    JSON_VERSION: '2.0',
    EXCEL_SHEET_NAME: '시료접수대장',
    MAX_EXPORT_ROWS: 10000
};

/**
 * 유효성 검사 관련 상수
 */
const VALIDATION = {
    PHONE_MAX_LENGTH: 13,
    RECEIPT_NUMBER_LENGTH: 4,
    ZIPCODE_LENGTH: 5,
    MIN_NAME_LENGTH: 1,
    MAX_NAME_LENGTH: 50,
    MAX_ADDRESS_LENGTH: 200,
    MAX_NOTE_LENGTH: 500,
    MAX_CELL_INPUT_LENGTH: 200  // 흙토람 검정결과 셀 입력 최대 길이
};

/**
 * 연도 관련 상수
 */
const YEAR = {
    MIN_YEAR: 2020,
    MAX_YEAR_OFFSET: 1  // 현재 연도 + 1년까지 허용
};

/**
 * 시료 타입 코드
 */
const SAMPLE_TYPE_CODE = {
    SOIL: 'soil',
    WATER: 'water',
    COMPOST: 'compost',
    HEAVY_METAL: 'heavyMetal',
    PESTICIDE: 'pesticide'
};

/**
 * 시료 타입 한글명
 */
const SAMPLE_TYPE_NAME = {
    soil: '토양',
    water: '수질분석',
    compost: '퇴·액비',
    heavyMetal: '토양 중금속',
    pesticide: '잔류농약'
};

/**
 * localStorage 키 접두사
 */
const STORAGE_KEY_PREFIX = {
    soil: 'soilSampleLogs',
    water: 'waterSampleLogs',
    compost: 'compostSampleLogs',
    heavyMetal: 'heavyMetalSampleLogs',
    pesticide: 'pesticideSampleLogs'
};

/**
 * 수령 방법 옵션
 */
const RECEPTION_METHOD = {
    VISIT: '방문수령',
    MAIL: '우편',
    FAX: 'FAX'
};

/**
 * 신청인 유형
 */
const APPLICANT_TYPE = {
    INDIVIDUAL: '개인',
    CORPORATION: '법인'
};

// 전역으로 내보내기
window.APP_CONSTANTS = {
    DEBUG,
    APP_VERSION,
    PAGINATION,
    TIMER,
    AUTOCOMPLETE,
    STORAGE,
    FILE,
    VALIDATION,
    YEAR,
    SAMPLE_TYPE_CODE,
    SAMPLE_TYPE_NAME,
    STORAGE_KEY_PREFIX,
    RECEPTION_METHOD,
    APPLICANT_TYPE
};

// 개별 상수도 전역으로 내보내기 (기존 코드 호환성)
window.DEBUG = DEBUG;
window.APP_VERSION = APP_VERSION;
window.PAGINATION = PAGINATION;
window.TIMER = TIMER;
window.AUTOCOMPLETE = AUTOCOMPLETE;
window.STORAGE = STORAGE;
window.FILE = FILE;
window.VALIDATION = VALIDATION;
