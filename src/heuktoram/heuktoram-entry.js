// npm packages
import * as XLSX from 'xlsx-js-style';
window.XLSX = XLSX;

// Shared modules
import '../shared/sanitize.js';
// 정적 시·군 데이터(bonghwaData.js) 제거 - juso API만 사용
import '../shared/constants.js';
import '../shared/utils.js';
import '../shared/toast.js';
import '../shared/address.js';
import '../shared/address-parser.js';
import '../shared/theme.js';
import '../shared/tooltip.js';
import '../shared/logger.js';

// 결과 가져오기 모달 (Phase 1)
import './heuktoram-result-importer.js';

// Main script
import './heuktoram-script.js';
