# SLS-1-292 패키징 스모크 (vite 6 산출물, darwin-arm64, 임시 --user-data-dir)

- `pages.cjs` — 앱을 CDP 로 조종해 진입점 13개를 file:// 로 열어 콘솔 오류·CSP 위반을 본다. 위반 리스너는 `addInitScript` 로 **문서 시작 전**에 붙인다(이전 판은 로드 뒤에 붙여 `csp` 가 항상 비었다). 결과 `pages-after.json`.
- `popup-probe.cjs` + `popup-after.json` — 메인 창과 흙토람 팝업이 `file://…/app.asar/docs/` 를 로드하는지(SLS-1-289 재현 스크립트 재사용).
- 실사용 데이터 폴더(`~/Library/Application Support/토양 시료 접수 대장`)는 실행 전후 392개 파일 mtime·크기 동일. UnhandledPromise 0.

## 결과 — 13개 중 11개 깨끗, 3개는 **vite 5 산출물에도 있던 기존 항목**(HTML 이 해시만 빼면 동일)

| 페이지 | 항목 | 성격 |
| --- | --- | --- |
| `release/index.html` | 인라인 script CSP 위반(script-src-elem) | 기존 결함 — `src/release/index.html:2355-2389`, v1.0.0 부터. 다크 모드·접기 버튼이 설치본에서 동작 안 함 → SLS-1-295 |
| `manual/firebase-setup.html` | 인라인 script CSP 위반 | 같은 종류 기존 결함 → **SLS-1-295 범위에 포함**(티켓 본문은 release 만 적었다) |
| `landing/index.html` | 콘솔: `frame-ancestors` 는 `<meta>` CSP 로는 무시됨 | 무해한 경고, 기존(`src/landing/index.html:5`) |
