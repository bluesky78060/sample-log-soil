# SLS-1-275 플랜 리뷰

## 리뷰어
- 독립 모델 리뷰: **codex** (`codex exec`, 2026-08-21, 66,531 tokens)
  - 도구 가용성은 그 자리에서 확인했다 — `codex exec`로 한 줄 프롬프트 실행 성공 후 본 리뷰 수행.
- 메인 오케스트레이터(Claude) 2차 판단.

## 판정: 통과 (수정 반영 후)

CRITICAL 0 / MAJOR 0 / MINOR 2 / SUGGESTION 1.

## codex 지적과 처리

| # | 심각도 | 지적 | 처리 |
| --- | --- | --- | --- |
| 1 | MINOR | 반응형 전환(토양 1024px·퇴비 1200px 이하에서 `col-action`이 `position:static; right:auto`)에서 관리 열이 왼쪽 고정처럼 계산될 수 있다. 기존 동작이지만 검증이 없다. | **수용** — 좁은 화면 ↔ 넓은 화면 왕복 후 `col-action`에 동적 `left` 규칙이 남지 않고 `right:0`이 복구되는지 E2E에 추가. |
| 2 | MINOR | 제안한 E2E가 규칙 문자열만 본다. thead/tbody 양쪽의 computed `left`, `col-action`도 직접 봐야 한다. | **수용** — 머리글과 첫 본문 행의 computed `left`가 일치하는지, `col-action`이 왼쪽 규칙에 섞이지 않는지 단언 추가. |
| 3 | SUGGESTION | 깜빡임 없음·Observer 무한 재예약 없음을 말로 두지 말고 계측하라. | **부분 수용** — 무한 재예약은 E2E에서 전환 후 규칙이 **안정 상태로 수렴**하는지(대기 후 재확인) 확인. 픽셀 단위 깜빡임 계측은 비용 대비 실익이 낮아 하지 않는다. 두 `textContent` 쓰기 사이에 페인트가 없다는 것은 codex도 동의했다. |
| 4 | 정보 | `heuktoram`·`compost-analysis`의 표에도 `sticky-col`이 있으나 이 모듈을 import하지 않는다. | **수용** — 플랜 "범위 밖"에 명시. |

## 진단·수정안에 대한 codex 결론 (요지)

- 진단 일치: 이전 `left`가 더 크면 sticky가 밀리고, 밀린 위치를 `offsetLeft`로 다시 읽어 고착된다.
- 기존 E2E가 "잘못된 좌표끼리 비교"해 통과할 수 있다는 지적도 맞다.
- 수정안 안전: `#id .sticky-col`(1,1,0)이 `.data-table.gongik-on .col-date`(0,3,0)를 이긴다.
  `col-action`은 `right:0`을 유지하므로 오른쪽 고정이 풀리지 않는다.
  규칙은 `#id .col-*`라 thead·tbody 양쪽에 걸린다.
  MutationObserver는 표의 `class`만 보므로 style 교체로 재진입하지 않는다.
- "더 나은 대안은 보이지 않는다 — 현재 구조에서 허용 가능한 최소 수정."

## 메인 오케스트레이터 판단

`getBoundingClientRect()`로 바꾸는 대안은 SLS-1-263(transform 중 0.844배 측정)에서
이미 배제됐다. `left:auto`로 잠시 되돌린 뒤 `offsetLeft`를 읽는 방식은 그 결정을
유지하면서 변위만 제거하므로 앞선 두 티켓의 판단과 충돌하지 않는다.
