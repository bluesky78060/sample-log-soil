import '../shared/frame-guard.js'; // 클릭재킹 자기방어 (SLS-1-132)
// npm packages
import * as XLSX from 'xlsx';
import DOMPurify from 'dompurify';
window.XLSX = XLSX; // 작물 데이터 .xlsx 파싱에 필요 (SLS-1-179, soil-entry.js와 동일 라이브러리)
window.DOMPurify = DOMPurify;

// Shared modules (순서 유지 - window.* 전역 설정)
import '../shared/logger.js';
import '../shared/network-config.js';
import '../shared/network-access.js';
import '../shared/firebase-config.js';
import '../shared/firestore-db.js';
import '../shared/storage-manager.js';
import '../shared/sanitize.js';
import '../shared/toast.js';
import '../shared/theme.js';
import '../shared/cache-manager.js';

// 작물 데이터 (SLS-1-179): 번들 기본값 + 자체 업로드 로더/파서
// crop-data-loader는 firestore-db.js 뒤에 로드되어야 window.firestoreDb 참조 가능
import '../cropData.js';
import '../shared/crop-data-loader.js';

// Main script
// 접수번호 정합성 점검이 window.ReceptionNumber를 쓴다 (SLS-1-223)
import '../soil/reception-number.js';

import './settings-script.js';
