// 프레임 삽입 방어 (soil 저장소 전 진입점 공통 — 반드시 최상단)
import '../shared/frame-guard.js';

// npm packages
import * as XLSX from 'xlsx-js-style';
import DOMPurify from 'dompurify';
window.XLSX = XLSX;
window.DOMPurify = DOMPurify;

// Shared modules (순서 유지 - window.* 전역 설정)
import '../shared/sanitize.js';
import '../shared/constants.js';
import '../shared/file-api.js';
import '../shared/utils.js';
import '../shared/toast.js';
import '../shared/pagination.js';
import '../shared/address.js';
import '../shared/address-parser.js';
import '../shared/autocomplete-manager.js';
import '../shared/juso-service.js';
import '../shared/search-filter.js';
import '../shared/form-validator.js';
import '../shared/theme.js';
import '../shared/tooltip.js';
import '../shared/logger.js';
import '../shared/network-config.js';
import '../shared/network-access.js';
import '../shared/firebase-config.js';
import '../shared/firestore-db.js';
import '../shared/storage-manager.js';
import '../shared/sync-utils.js';
import '../shared/BaseSampleManager.js';
import '../shared/excel-import-manager.js';
import '../shared/compost-results-store.js';   // SLS-1-204: 검정결과 저장소 단일 진실원
import '../shared/compost-fields.js';          // SLS-1-205: 검정 항목 규칙 단일 진실원

// Data
// 정적 시·군 데이터 제거 - 자동완성은 juso API 단독

// Main script
import '../shared/table-scroll-anchor.js';  // SLS-1-278: 열이 늘고 줄어도 보던 열을 제자리에
import '../shared/sticky-columns.js';  // SLS-1-264: 고정 열 좌표를 화면에서 재서 맞춤
import './compost-script.js';
