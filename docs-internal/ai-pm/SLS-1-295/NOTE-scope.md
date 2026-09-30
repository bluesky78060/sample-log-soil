# SLS-1-295 범위 메모 (SLS-1-292 스모크에서 발견, 2026-10-01)

티켓 본문은 `src/release/index.html` 만 적었으나, 리스너를 로드 전에 붙여 다시 돌리니 **`src/manual/firebase-setup.html` 도 인라인 `<script>` 가 CSP 에 막힌다**(vite 5 산출물과 동일, 기존 결함).
착수할 때 `src/**/*.html` 전수 grep(`<script>` 본문이 있는 것)으로 이 둘 말고 더 있는지 확인하고 함께 외부 모듈로 옮긴다.
`landing` 의 `frame-ancestors` meta 경고는 무해해 범위 밖.
