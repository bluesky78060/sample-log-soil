// ========================================
// 클릭재킹 자기방어 (SLS-1-132 M-1)
// GitHub Pages는 응답 헤더(frame-ancestors / X-Frame-Options)를 설정할 수 없고,
// CSP meta의 frame-ancestors는 브라우저가 무시하므로 페이지 스크립트로 방어한다.
// Electron은 src/index.js 헤더(frame-ancestors 'none' + X-Frame-Options: DENY)가
// 이미 방어하며, 최상위 창에서는 top === self 라 이 코드는 no-op.
// ========================================
(function () {
    'use strict';
    try {
        if (window.top !== window.self) {
            // 프레임에 갇힌 경우: 콘텐츠 즉시 숨김 + 최상위 탈출 시도
            document.documentElement.style.display = 'none';
            try {
                window.top.location.replace(window.self.location.href);
            } catch (_) {
                /* cross-origin 부모 — 탈출 불가, 숨김 상태 유지 */
            }
        }
    } catch (_) { /* noop */ }
})();
