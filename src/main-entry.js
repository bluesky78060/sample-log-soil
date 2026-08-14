import './shared/frame-guard.js'; // 클릭재킹 자기방어 (SLS-1-132)
// Shared modules (메인 페이지에서 필요한 것만)
import './shared/logger.js';
import './shared/network-config.js';
import './shared/network-access.js';
import './shared/firebase-config.js';
import './shared/firestore-db.js';
import './shared/storage-manager.js';
import './shared/sanitize.js';
import './shared/theme.js';
import './shared/cache-manager.js';
import './shared/main-init.js';

// 새로워진 내용 팝업 (SLS-1-218) — 생성물을 먼저 올린 뒤 팝업 모듈이 읽는다.
// main-init 다음에 둔다: Firebase·자동저장·통계 초기화와 경쟁하지 않게 한다.
import './shared/whatsnew-data.js';
import './whatsnew.js';

// 게시판 공지 팝업 (SLS-1-219) — Firestore에서 읽어 배포 없이 공지 발행.
// firebase SDK는 위 firebase-config/firestore-db가 이미 번들에 넣었다(용량 증가 없음).
// feedback-store.js는 클래스 정의와 전역 노출만 하고 즉시 실행 부작용이 없다.
import './shared/notice-date.js';
import './shared/notice-seen.js';
import './feedback/feedback-firebase.js';
import './feedback/feedback-store.js';
import './notice-popup.js';

// 게시판은 데스크톱(Electron) 전용 — 웹에선 진입 버튼을 숨긴다 (SLS-1-151).
// 버튼은 기본 display:none이며, Electron일 때만 노출한다(fail-closed).
document.addEventListener('DOMContentLoaded', () => {
    if (window.electronAPI?.isElectron) {
        const btn = document.getElementById('feedbackNavBtn');
        if (btn) btn.style.display = '';
    }
});
