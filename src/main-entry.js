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

// 게시판은 데스크톱(Electron) 전용 — 웹에선 진입 버튼을 숨긴다 (SLS-1-151).
// 버튼은 기본 display:none이며, Electron일 때만 노출한다(fail-closed).
document.addEventListener('DOMContentLoaded', () => {
    if (window.electronAPI?.isElectron) {
        const btn = document.getElementById('feedbackNavBtn');
        if (btn) btn.style.display = '';
    }
});
