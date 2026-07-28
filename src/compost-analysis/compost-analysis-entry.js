// 프레임 삽입 방어 (soil 저장소 전 진입점 공통 — 반드시 최상단)
import '../shared/frame-guard.js';

// npm packages
import * as XLSX from 'xlsx-js-style';
// 외부 엑셀 읽기 전용 보안 패치판 (SheetJS 0.20.x) — xlsx-js-style(0.18 기반)의
// 프로토타입 오염/ReDoS CVE를 읽기 경로에서 회피 (SLS-1-131 H-1)
import * as XLSXRead from 'xlsx';
window.XLSX = XLSX;
window.XLSXRead = XLSXRead;

// ⚠️ JSZip은 import하지 않는다 — heuktoram-result-importer.js는 JSZip을 쓰지 않는다(참조 0건).
//    JSZip이 필요한 것은 heuktoram-script.js(일괄입력 양식 dataValidation 주입)이며
//    이 페이지는 그 파일을 로드하지 않는다.
// ⚠️ analysis-db.js도 import하지 않는다 — 퇴비 검정결과는 CompostResultsStore(localStorage)를
//    쓴다. AnalysisDB를 끌어들이면 접수 페이지 모달과 데이터가 갈라진다.

// Shared modules (순서 유지 - window.* 전역 설정)
import '../shared/sanitize.js';      // escapeHTML — result importer가 요구
import '../shared/constants.js';
import '../shared/utils.js';
import '../shared/toast.js';         // showToast — result importer가 요구
import '../shared/theme.js';
import '../shared/tooltip.js';
import '../shared/logger.js';

// 퇴비 도메인 단일 진실원
import '../shared/compost-results-store.js';   // SLS-1-204: 검정결과 저장소
import '../shared/compost-fields.js';          // SLS-1-205 S1: 검정 항목 규칙

// Main script
import './compost-analysis-script.js';
