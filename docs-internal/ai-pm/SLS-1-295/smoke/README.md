# SLS-1-295 설치본 클릭 검증 (darwin-arm64 패키징 앱, 임시 --user-data-dir)

`run.sh <라벨> <포트>`(저장소 루트에서 실행, 실제 `.env`·`feedback-auth.json` 이 있으면 중단) — 현재 `docs/` 로 패키징해 `clicks.cjs` 를 돌린다. 기준선은 `git checkout HEAD -- docs` 로 수정 전 산출물을 놓고 같은 절차로 측정했다.
클립보드는 창 포커스가 없으면 거부되므로 `bringToFront()` 후 클릭한다. CSP 위반 리스너는 `addInitScript` 로 문서 시작 전에 붙인다.

| | 수정 전 (`clicks-before-fix.txt`) | 수정 후 (`clicks-after-fix.txt`) |
| --- | --- | --- |
| release 다크 토글 | `light` → `light`, `script-src-elem` 위반 | `light` → **`dark`**, localStorage `dark`, 위반 0 |
| firebase-setup 탭 | 안 바뀜 | 바뀜 |
| firebase-setup FAQ | 안 열림 | 열림 |
| firebase-setup 체크리스트 | 안 체크됨 | 체크됨 |
| firebase-setup 복사 | `복사` 그대로 | **`복사됨!`** |
| CSP 위반 | `script-src-elem` 1 + `script-src-attr` 4(클릭마다) | **0** |
| 판정 | CLICKS_FAIL | CLICKS_OK |

실사용 데이터 폴더(`~/Library/Application Support/토양 시료 접수 대장`)는 모든 실행 전후 변경 없음.

## 최종 상태 재측정 (`pages-final.json`, `clicks-final.txt`)

최종 `docs/` 로 다시 패키징해 진입점 13개를 스모크하고 같은 클릭 프로브를 돌렸다 — 13개 중 **12개가 오류 0·CSP 위반 0**, `landing` 은 `frame-ancestors` 가 `<meta>` CSP 로는 무시된다는 무해한 기존 경고 1건. `release`·`firebase-setup` CSP 위반 0, `manual/index.html` 오류 0. 클릭 `CLICKS_OK`. 실사용 폴더 무변경, UnhandledPromise 0.

⚠️ 이 파일의 이전 판은 **참조가 끊긴 중간 상태**(`git checkout -- docs/manual/index.html` 로 되돌려 옛 `frame-guard` 청크를 가리키던 때)의 실행 결과여서 `manual/index.html` 에 `ERR_FILE_NOT_FOUND` 가 있었는데 README 는 「나머지 동일」이라 적었다 — 코드리뷰가 잡아 최종 상태로 교체했다. 그 결함 자체는 아래 「중간 시도」 와 `results.md` 에 남긴다.

최종 상태 재측정의 출처: 진입점 13개 스모크는 `docs-internal/ai-pm/SLS-1-292/smoke/pages.cjs <포트>`, 클릭은 `clicks.cjs`. 빌드된 `docs/` 는 HEAD 대비 HTML 2개 + 새 청크 `release-DIKaA0yA.js`·`firebaseSetup-CFsiwZaz.js` 뿐이며 `frame-guard-BIL41LH3.js` 가 두 청크의 첫 import 다. 수행 시각은 2026-10-01 10:16 KST(빌드 → 패키징 → 스모크 → 클릭 순).

## 중간 시도 기록

- 첫 수정 후 클릭 시도의 `scrollIntoView` 타임아웃은 프로브 순서 버그(탭이 바뀐 뒤 숨은 복사 버튼을 클릭)여서 `.copy-btn:visible` 로 고치고 기준선도 다시 측정했다.
- 새 모듈 두 개에 `frame-guard` import 를 넣기 전에는 vite 가 `modulepreload-polyfill` 을 공유 청크로 분리해 기존 진입 청크 10개의 해시가 바뀌었다(`results.md`). 지금은 해소됐다.
