/**
 * @fileoverview 릴리스 노트 페이지 — 다크 모드 토글 (SLS-1-295)
 * 인라인 <script> 였던 것을 옮겼다: 설치본 CSP(script-src 'self' file:)가 인라인 코드를 막는다.
 * 카드 접기/펼치기 블록은 대상 요소(.toggle-btn)가 마크업에 없는 죽은 코드라 옮기지 않았다.
 */
// 클릭재킹 방어는 다른 페이지처럼 맨 처음에 로드한다(SLS-1-132). 이 import 가 있어야 vite 가 modulepreload
// polyfill 을 frame-guard 청크에 그대로 두어 다른 진입 청크의 해시·import 순서가 바뀌지 않는다
import '../shared/frame-guard.js';

// 다크 모드 토글
const html = document.documentElement;
const toggleBtn = document.getElementById('themeToggleBtn');

// 저장된 테마 로드
const savedTheme = localStorage.getItem('theme-preference') || 'light';
html.setAttribute('data-theme', savedTheme);
if (savedTheme === 'dark') {
    toggleBtn.classList.add('dark');
}

toggleBtn.addEventListener('click', function() {
    var isDark = html.getAttribute('data-theme') === 'dark';
    var newTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme-preference', newTheme);
    toggleBtn.classList.toggle('dark', !isDark);
});
