import '../shared/frame-guard.js'; // 클릭재킹 자기방어 (SLS-1-132)
// npm packages
import * as XLSX from 'xlsx-js-style';
// 외부 엑셀 읽기 전용 보안 패치판 (SheetJS 0.20.x) — xlsx-js-style(0.18 기반)의
// 프로토타입 오염/ReDoS CVE를 읽기 경로에서 회피 (SLS-1-131 H-1)
import * as XLSXRead from 'xlsx';
import JSZip from 'jszip';
window.XLSX = XLSX;
window.XLSXRead = XLSXRead;
window.JSZip = JSZip;

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

// 분석결과 영속 저장소(Dexie/IndexedDB) — window.AnalysisDB 노출
import '../shared/analysis-db.js';

// 결과 가져오기 모달 (Phase 1)
import './heuktoram-result-importer.js';

// Main script
import './heuktoram-script.js';
