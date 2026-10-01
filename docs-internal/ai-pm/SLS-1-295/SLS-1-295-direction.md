# SLS-1-295 방향 — 설치본 CSP 에 막히는 인라인 스크립트 (릴리스 노트 · Firebase 설정 안내)

> 정본. 훅 통과용 사본은 `docs/00-discovery/`.

작성: 2026-10-01 · 확정: 사용자 「계속 진행해줘」(SLS-1-292 패키징 스모크에서 발견, 우선순위 3)

| 카테고리 | 내용 |
| --- | --- |
| 목표 | 설치본(Electron)에서 두 페이지의 버튼이 동작하게 한다 — `src/release/index.html`(다크 모드 토글), `src/manual/firebase-setup.html`(탭 전환·복사 버튼·FAQ·체크리스트) |
| 원인 | 설치본의 CSP 는 `script-src 'self' file:` 이라 **인라인 `<script>` 와 인라인 `on*=` 속성을 모두 막는다**(`src/index.js` 헤더 CSP, 프로젝트 CLAUDE.md 「CSP — 인라인 스크립트 금지」). 웹판은 CSP 헤더가 file:// 에만 붙어 동작해 E2E(http)로는 안 보였다 |
| 사용자 | 설치본 사용자. 지금은 두 페이지가 읽기만 되고 버튼이 죽어 있다(release 는 다크 모드 토글 하나, firebase-setup 은 탭·FAQ·체크리스트·복사 버튼)(릴리스 노트 내용·설정 안내 본문은 읽힌다). 데이터·기능 손실은 아니다 |
| 범위 | 두 페이지의 인라인 `<script>` → 외부 ES 모듈, `firebase-setup.html` 의 `onclick=` 23개(6종) → `data-action` + 이벤트 위임, 재발 방지 정적 테스트 |
| 범위 밖 | 다른 페이지(전수 조사 결과 인라인 `<script>` 는 이 둘뿐, `on*=` 는 `firebase-setup.html` 뿐), `landing` 의 `frame-ancestors` meta 경고(무해) |
| 제약 | 웹판 동작 불변 — 같은 버튼이 같은 동작을 해야 한다. CSP 인라인 금지 규칙을 그대로 따른다 |
| 리스크 | 낮음~중간 — 화면 동작을 옮기는 로직 이동. 속성 → 위임 변환에서 `this`·`event` 의미가 달라질 수 있다 |
| 검증 | 정적 가드(인라인 0), E2E 로 두 페이지 동작(탭·FAQ·체크리스트·복사·다크 모드), **패키징 앱에서 CDP 로 실제 클릭**(CSP 가 실제로 걸리는 유일한 환경), 변이 검증 |

## 전수 조사 (2026-10-01)

- 인라인 `<script>`(src 없음): `src/release/index.html:2356`, `src/manual/firebase-setup.html:1296` — **이 둘뿐**.
- `on*=` 속성: `firebase-setup.html` 에만 23개 — `toggleCheck(this)` 12, `toggleFaq(this)` 6, `switchTab(event,'…')` 2, `copyText(this,'…')` 1, `copyRules(this)` 1, `copyJson(this)` 1. `release` 는 0.
- 두 페이지에는 CSP `<meta>` 가 없다 — 설치본에서는 메인 프로세스가 file:// 응답에 붙이는 헤더 CSP 가 적용된다.
- SLS-1-292 스모크에서 `release`·`firebase-setup` 이 각각 `script-src-elem` 위반 1건(인라인 스크립트 실행 차단)을 보였다. `onclick=` 위반은 **클릭해야 발생**해 스모크에서는 드러나지 않았다 — 이번에 클릭 검증을 넣는다.

## ⚠️ 정정 (플랜 리뷰 1R, 2026-10-01) — 「카드 접기/펼치기」는 존재하지 않는 기능이다

발행 당시 티켓 본문과 이 문서 초안은 릴리스 페이지의 「카드 접기/펼치기」가 설치본에서 막힌다고 적었다. **확인하지 않고 스크립트의 `querySelectorAll('.toggle-btn')` 코드만 보고 쓴 오류다.**
`src/release/index.html` 에 `class="toggle-btn"` 요소는 **0개**이고(CSS 정의만 10줄), `git log -S` 로도 이 저장소 이력에 한 번도 없었다. 스크립트의 접기 블록은 대상이 없는 **죽은 코드**다.
→ 릴리스 페이지에서 고칠 것은 **다크 모드 토글 하나**다. 접기 기능을 새로 만들지 않는다(UI 추가 아님, 범위 밖). 통합본(`sample-log-electron`)에 있던 기능인지는 확인하지 않았다 — 의도된 기능이었다면 별도 티켓.
(SLS-1-295 AI PM 티켓 본문의 「접기/펼치기」 표현도 같은 오류다.)
