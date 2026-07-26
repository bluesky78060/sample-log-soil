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

// Data
// 정적 시·군 데이터 제거 - 자동완성은 juso API 단독

// Main script
import './compost-script.js';
