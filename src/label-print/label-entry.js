import '../shared/frame-guard.js'; // 클릭재킹 자기방어 (SLS-1-132)
// npm packages
import * as XLSX from 'xlsx';
import DOMPurify from 'dompurify';
window.XLSX = XLSX;
window.DOMPurify = DOMPurify;

// Shared modules (순서 유지 - window.* 전역 설정)
import '../shared/sanitize.js';
import '../shared/theme.js';
import '../shared/logger.js';

// Main script
import './label-app.js';
