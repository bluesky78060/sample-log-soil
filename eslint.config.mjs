// ESLint flat config (v9) — 최소 도입 (SLS-1-96)
//   목적: 버그성 룰로 명백한 오류를 잡고, max-lines-per-function으로 거대 함수를 탐지.
//   무린팅 코드(29k LOC)라 스타일 룰은 끄고, 위험 룰만 error / 나머지는 warn.
import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        // 빌드 산출물·의존성·외부 라이브러리는 검사 제외
        ignores: [
            'docs/**',
            'node_modules/**',
            'mockups/**',
            '**/*.min.js',
            'src/shared/tailwind-output.css',
        ],
    },
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,  // crypto·structuredClone 등 포함
                // dual-format(브라우저+CommonJS) 모듈의 export 가드용
                module: 'readonly',
                require: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                Buffer: 'readonly',
                // 선택적 전역(typeof 가드 후 호출 — 일부 환경/모듈에서만 노출)
                suggestRegionVillages: 'readonly',
                parseParcelAddress: 'readonly',
                // 프로젝트 공통 모듈 (src/shared/*.js 가 window.* 로 노출)
                APP_CONSTANTS: 'readonly', APP_VERSION: 'readonly', AUTOCOMPLETE: 'readonly',
                AddressAutocomplete: 'readonly', AddressManager: 'readonly', AnalysisDB: 'readonly',
                AuthFile: 'readonly', BaseSampleManager: 'readonly', CROP_CATEGORIES: 'readonly',
                CROP_DATA: 'readonly', CacheManager: 'readonly', DEBUG: 'readonly',
                ExcelImportManager: 'readonly', FILE: 'readonly', FormValidator: 'readonly',
                JusoService: 'readonly', MrlApi: 'readonly', NETWORK_CONFIG: 'readonly',
                NetworkAccess: 'readonly', PAGINATION: 'readonly', PESTICIDE_ANALYSIS_DATA: 'readonly',
                PESTICIDE_NAME_MAP: 'readonly', PaginationManager: 'readonly', PathSecurity: 'readonly',
                QUALITATIVE_PESTICIDES: 'readonly', SIDO_PATTERN: 'readonly', STORAGE: 'readonly',
                SampleUtils: 'readonly', SearchFilter: 'readonly', SyncUtils: 'readonly',
                TIMER: 'readonly', ThemeManager: 'readonly', VALIDATION: 'readonly',
                ReceptionNumber: 'readonly', SoilResultImporter: 'readonly',
                clearElement: 'readonly', createFileAPI: 'readonly', escapeHTML: 'readonly',
                escapeHtml: 'readonly', firebaseConfig: 'writable', firebaseInitialized: 'writable',
                firestoreDb: 'readonly', firestoreInitialized: 'writable', formValidator: 'readonly',
                getPesticideStats: 'readonly', getPesticidesByMethod: 'readonly', isElectron: 'readonly',
                isQualitativePesticide: 'readonly', loadFromAutoSaveFile: 'writable', logger: 'readonly',
                parseAddressParts: 'readonly', safeTemplate: 'readonly', safeText: 'readonly',
                sanitizeExcelAoa: 'readonly', sanitizeExcelCell: 'readonly', sanitizeExcelData: 'readonly',
                sanitizeHTML: 'readonly', searchPesticides: 'readonly', setInnerHTML: 'readonly',
                setLogLevel: 'readonly', showToast: 'readonly', storageManager: 'readonly',
                soilManager: 'writable',
                // 런타임 라이브러리(번들)
                XLSX: 'readonly', DOMPurify: 'readonly', firebase: 'readonly',
            },
        },
        rules: {
            // ── 버그성 룰 (error) ──────────────────────────────
            'no-dupe-keys': 'error',          // 객체 중복 키
            'no-dupe-args': 'error',          // 함수 중복 인자
            'no-duplicate-case': 'error',     // switch 중복 case
            'no-unreachable': 'error',        // 도달 불가 코드
            'no-redeclare': 'error',          // 변수 재선언
            'no-self-assign': 'error',        // 자기 자신 할당
            'no-unsafe-negation': 'error',    // !a in b 류 오류
            'no-cond-assign': ['error', 'except-parens'],
            'no-func-assign': 'error',        // 함수 재할당
            'no-import-assign': 'error',
            'use-isnan': 'error',             // NaN 직접 비교
            'valid-typeof': 'error',          // typeof 오타
            // ── 경고 (warn) — 기존 코드 폭탄 완화 ───────────────
            'no-undef': 'warn',               // 미정의 참조(오타). globals로 대부분 커버
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
            'no-constant-condition': ['warn', { checkLoops: false }],
            // ── 거대 함수 탐지 (분석 #6) ────────────────────────
            'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true, IIFEs: false }],
        },
    },
];
