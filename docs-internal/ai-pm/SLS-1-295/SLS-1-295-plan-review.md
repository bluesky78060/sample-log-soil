# SLS-1-295 플랜 리뷰

> 정본. 훅 통과용 사본은 `docs/02-review/`.

리뷰어: `critic`(Opus, 읽기 전용) + 오케스트레이터 · 2026-10-01

## 1R — REVISE (CRITICAL 0 / MAJOR 1 / MINOR 4 / SUGGESTION 2)

전수성·동작 보존·vite 경로는 저장소와 대조해 모두 맞았다. 인라인 `<script>` 2곳·`on*=` 23개(12/6/2/1/1/1) 일치, JS 템플릿 안 인라인 핸들러·`javascript:`·`eval` 0건, 인라인 `style` 은 `style-src 'unsafe-inline'` 이라 허용, 탭·`toggleCheck`·FAQ 위임에서 `closest('[data-action]')` 가 `event.target` 과 같거나 올바르게 거슬러 올라가고 중첩 data-action 요소 없음.

- **MAJOR 1** 릴리스 「카드 접기」는 마크업에 없다 — `class="toggle-btn"` 0개, 이력에도 없음(죽은 코드). 플랜의 E2E·CDP 검증 항목이 실행 불가였다 → 방향 문서에 정정을 적고 접기를 목표·검증에서 뺌, 죽은 블록은 옮기지 않고 삭제(UI 추가 없음). **오케스트레이터 오류: 요소 존재를 확인하지 않고 코드만 보고 썼다.**
- MINOR 2 E2E 가 CSP 없이 돌아 수정 전에도 통과 → `page.route` 로 설치본과 같은 CSP 헤더 주입(수정 전 실패, 기준선 CI 재현)
- MINOR 3 CDP 복사 검증의 거짓 실패(창 포커스 없으면 clipboard 거부) → `bringToFront`, 합격 기준 「위반 0 + `복사됨!`」
- MINOR 4 기준선 절차가 비어 있음 → CSP 주입 E2E 를 HEAD 에서 먼저 + 수정 전 패키징 1회(기대: firebase-setup 은 `script-src-attr` 위반, release 는 무반응)
- MINOR 5 정적 테스트는 정규식보다 DOM 파싱 → jsdom(`script:not([src])`, `on*` 속성, `javascript:`·`formaction`)
- SUGGESTION: `src/**/*.js` 인라인 핸들러 문자열 가드 · lint 경고 여유 0(`--max-warnings 6` 에 현재 6) → 경고 0 으로 작성

## 오케스트레이터 판단

MAJOR 1·MINOR 4·SUGGESTION 2 를 모두 방향·플랜에 반영했다(방향 문서 「정정」, 플랜 변경 1·4·5 와 검증). 판정이 REVISE 였으나 반영분은 문서 수정뿐이고 새 설계가 없어 재리뷰 없이 진행하며 코드리뷰에서 본다.
