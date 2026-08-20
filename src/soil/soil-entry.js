import '../shared/frame-guard.js'; // 클릭재킹 자기방어 (SLS-1-132)
// npm packages
import * as XLSX from 'xlsx';
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
import '../shared/juso-service.js';
import '../shared/autocomplete-manager.js';
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

// Data
import '../cropData.js';
// 작물 데이터 자체 업로드 로더 (SLS-1-179): cropData.js 뒤에 로드해 window.CROP_DATA 교체 가능
import '../shared/crop-data-loader.js';
window.CropDataLoader?.loadCropDataOnStartup?.(); // fire-and-forget (await 금지)
// 정적 시·군 데이터(bonghwaData.js) 제거 - 자동완성은 juso API만 사용

// 채번 순수 로직 (soil-script.js 전 — window.ReceptionNumber 준비)
import './reception-number.js';
// 레코드 빌더 순수 로직 (soil-script.js 전 — window.SoilLogRecord 준비)
import './soil-log-record.js';
// 완료 그룹핑 순수 로직 (soil-script.js 전 — window.ReceptionGroup 준비)
import './reception-group.js';
// 시트명 정규화 순수 로직 (soil-script.js 전 — window.SheetName 준비, SLS-1-199)
import './sheet-name.js';

// Main script
import '../shared/sticky-columns.js';  // SLS-1-264: 고정 열 좌표를 화면에서 재서 맞춤
import './soil-script.js';

// 흙토람式 가져오기 모달 (soil-script.js 뒤 — window.soilManager 준비 후 버튼 연결)
import '../shared/soil-template-data.js';  // SLS-1-232: 내장 기본 서식(원본 바이트)
import './crop-search.js';           // SLS-1-228: 작물 검색 순수 로직
import './soil-address-lookup.js';   // SLS-1-227: 가져오기 우편번호 자동조회 (importer보다 먼저)
import './soil-result-importer.js';
