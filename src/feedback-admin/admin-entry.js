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

// 게시판 전용 Firebase (signInAdmin 등) — 보드와 동일 named app
// 공지 만료 판정 (SLS-1-219) — 팝업(notice-popup.js)과 같은 로컬 기준 날짜를 쓴다.
// 각자 계산하면 UTC/로컬 차이로 KST에서 하루 어긋난다.
import '../shared/notice-date.js';
import '../feedback/feedback-firebase.js';

// 관리자 UI
import './admin-script.js';
