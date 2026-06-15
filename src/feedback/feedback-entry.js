import '../shared/frame-guard.js'; // 클릭재킹 자기방어 (SLS-1-132)
// npm packages
import DOMPurify from 'dompurify';
window.DOMPurify = DOMPurify;

// Shared modules (순서 유지 - window.* 전역 설정)
import '../shared/logger.js';
import '../shared/constants.js';
import '../shared/sanitize.js';
import '../shared/toast.js';
import '../shared/theme.js';

// 게시판 전용 Firebase 연결 (named app — 시료용 firebase-config와 독립)
import './feedback-firebase.js';

// 게시판 저장소 어댑터 + UI
import './feedback-store.js';
import './feedback-script.js';
