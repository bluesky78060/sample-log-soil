# SLS-1-295 플랜

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

작성: 2026-10-01 · 근거: `SLS-1-295-direction.md`

## 변경

1. `src/release/release-script.js`(신규, ES 모듈): `src/release/index.html:2356` 의 인라인 스크립트 중 **다크 모드 토글**을 로직 변경 없이 옮긴다. 대상 요소가 없는 죽은 `.toggle-btn`(카드 접기) 블록은 **옮기지 않고 삭제**한다(UI 추가 없음 — 방향 문서 「정정」). 두 모듈의 **첫 줄에 `import '../shared/frame-guard.js'`**(다른 페이지와 같은 클릭재킹 방어, SLS-1-132) — 이것이 없으면 vite 가 `modulepreload` polyfill 을 공유 청크로 분리해 기존 진입 청크 10개의 해시·import 순서가 바뀐다(구현 중 발견, `evidence/results.md`). `<script>` 는 반드시 `type="module"` 이어야 한다(type 없는 `<script src>` 는 vite 가 번들하지 않아 파일이 `docs/` 에 복사되지 않는다). HTML 은 `<script type="module" src="./release-script.js"></script>` 로 교체.
2. `src/manual/firebase-setup-script.js`(신규, ES 모듈): 인라인 함수 6개(`switchTab`·`toggleFaq`·`toggleCheck`·`copyText`·`copyJson`·`copyRules`)를 옮기고 **`document` 클릭 위임**으로 연결한다.
3. `src/manual/firebase-setup.html`: `onclick=` 23개를 `data-action` 으로 바꾼다.

   | 기존 | 새 속성 | 비고 |
   | --- | --- | --- |
   | `onclick="toggleCheck(this)"` ×12 | `data-action="toggle-check"` | 대상 = 클릭된 `data-action` 요소 |
   | `onclick="toggleFaq(this)"` ×6 | `data-action="toggle-faq"` | |
   | `onclick="switchTab(event, 'tab-x')"` ×2 | `data-action="switch-tab" data-tab="tab-x"` | 기존 `event.target` → 위임에서는 `closest('[data-action]')` (탭은 텍스트뿐이라 같다) |
   | `onclick="copyText(this, 'url')"` ×1 | `data-action="copy-text" data-text="url"` | 기존 인자 문자열을 속성으로 |
   | `onclick="copyRules(this)"` / `copyJson(this)` | `data-action="copy-rules"` / `copy-json` | |

   복사 텍스트 본문(JSON·보안 규칙 문자열)은 **그대로** 모듈로 옮긴다.
4. `tests/unit/no-inline-script.test.js`(신규): **정규식이 아니라 jsdom 파싱**(이미 dev 의존성, `scripts/extract-whatsnew.js:35`)으로 `src/**/*.html` 전체를 검사 — ① `script:not([src])`(JSON·template 등 비실행 type 은 제외) ② 모든 요소의 속성 중 `on` 으로 시작하는 것 ③ `[href^="javascript:" i]`·`[formaction]`. 정규식은 `<script` 뒤 줄바꿈·`<SCRIPT>`·`data-src` 로 우회되고 본문 텍스트 속 `onclick=` 에 오탐한다. 추가로 `src/**/*.js` 에 `\son[a-z]{3,}\s*=\s*["'`]` 형태의 인라인 핸들러 문자열이 없는지(현재 0건) 가드를 둔다.
5. `tests/e2e/inline-script-pages.spec.js`(신규): 두 페이지의 동작 보존 + **CSP 재현**. `playwright.config.js:59` 의 `http-server` 는 CSP 헤더가 없어 설치본의 제약을 재현하지 못한다 → 이 spec 은 `page.route` 의 `route.fetch()` 결과에 **설치본과 같은 `content-security-policy: script-src 'self' file:` 헤더**를 붙여 `route.fulfill` 한다. 그러면 이 spec 은 **수정 전에는 실패**하고(기준선이 CI 에서 재현됨) 이후 회귀도 잡는다. 검증 항목: firebase-setup — 탭 전환 active, FAQ `open`, 체크리스트 `checked` 와 완료 메시지, 복사 버튼 문구 `복사됨!`(클립보드 권한 부여); release — 다크 토글 클릭 시 `data-theme="dark"`·`.dark` 클래스·`localStorage['theme-preference']`, 새로고침 후 유지. 모든 클릭에서 `securitypolicyviolation` 0건.

## 검증

- **한계 명시**: E2E 는 CSP 헤더를 주입해 설치본 제약을 재현하지만 Electron 자체는 아니다 — 최종 증명은 패키징 앱 클릭이다. E2E 는 동작 보존과 회귀 방어, CSP 회귀의 1차 방어선은 정적 테스트다.
- 변이: ① 인라인 `<script>` 를 되돌리면 정적 테스트 실패 ② `onclick=` 하나를 되살리면 실패 ③ 위임 핸들러에서 `data-action` 하나를 빼면 E2E 실패 ④ `data-tab` 오타.
- lint 여유가 0이다(`--max-warnings 6` 에 현재 경고 정확히 6) — 새 모듈·테스트에서 경고가 하나만 나와도 실패하므로 경고 0으로 쓴다.
- build → `docs/` 에 새 모듈 청크가 생기고 HTML 에 인라인 `<script>`·`on*=` 가 없는지 grep, 참조된 청크가 모두 존재.
- unit · lint · E2E 전체(이 워크트리 `docs/`, 8888 비어 있는 상태).
- **기준선(수정 전)**: CSP 주입 E2E 를 HEAD 에서 먼저 돌려 실패를 확인한다(CI 재현). 패키징 앱 기준선은 SLS-1-292 스모크가 이미 보여 준 위반(`script-src-elem` 각 1건)에 더해 **수정 전 HEAD 로 한 번 패키징**해 클릭 관측을 남긴다. 기대 관측: `firebase-setup` — 클릭 시 `script-src-attr` 위반, `release` — 위반 없이 무반응(리스너 자체가 없음).
- **패키징 앱(darwin-arm64, 임시 `--user-data-dir`)에서 CDP 로 실제 클릭**: `release` — 다크 토글 클릭 후 `data-theme="dark"`; `firebase-setup` — 탭 전환·FAQ·체크리스트·복사 버튼 클릭. **클립보드는 창 포커스가 없으면 `NotAllowedError(Document is not focused)` 로 거부되어 문구가 안 바뀌므로 `page.bringToFront()` 로 포커스를 확보**하고, 합격 기준은 「클릭 시 `securitypolicyviolation` 0건 + 복사 버튼 문구 `복사됨!`」. 실사용 폴더 무변경.
- 진입점 13개 스모크(SLS-1-292 스크립트): `release`·`firebase-setup` 의 CSP 위반 0, 나머지 동일.

## 배포

`docs/` 가 바뀌어 push 하면 웹판에 반영된다(동작 동일). 설치본에는 다음 릴리스(v1.14.20, 사용자가 SLS-1-296 과 묶기로 함). 릴리스 노트 항목: 「릴리스 노트의 다크 모드 버튼과 Firebase 설정 안내 화면의 탭·복사 버튼이 설치된 프로그램에서 동작하지 않던 것을 고쳤습니다」(접기 언급 없음) — 사용자에게 보이는 변화라 릴리스 때 쓴다(`data-popup` 은 붙이지 않는다).
롤백: 커밋 하나.
