# SLS-1-276 Discovery — 목록 페이지 넘김 안정화

> 정본. `docs/00-discovery/`의 사본은 훅 통과용 일회용이다.

작성: 2026-08-27 · 상태: **방향 확정** (사용자 "진행해줘", 목업 검토 후)

## 목표 (Why)

사용자가 "화면 넘김이나 목록 전체보기에서 자연스럽게 넘어가게" 해 달라고 요청했다.
조사 결과 원인은 애니메이션의 부재가 아니라 **레이아웃이 그때그때 달라지는 것**이었다.
목업(`claude.ai/code/artifact/48170abd`)으로 세 축을 재현해 사용자가 확인했고, 진행이 확정됐다.

## 사용자 (Who)

전국 농업기술센터·분석기관 담당자. 접수 대장을 하루에 수십 번 넘긴다.
목록에서 한 건을 확인하고 접수 화면으로 갔다 돌아오는 왕복이 잦다.

## 범위 (What) — 이 티켓

**페이지 넘김 축만** 다룬다. 화면 전환(`.view`)과 전체 보기(FLIP)는 별도 티켓으로 뺀다.

| # | 대상 | 처방 |
| --- | --- | --- |
| 1 | `soil-script.js` `goToPage()` | 존재하지 않는 `.table-container`를 찾고 있다 → `.table-wrapper` |
| 2 | `soil-script.js` `renderCurrentPage()` | 마지막 페이지가 짧으면 표 높이가 줄어든다 → 채움 행 |
| 3 | `shared/pagination.js` | 같은 두 문제 + 행별 `appendChild` → `replaceChildren` |
| 4 | 공용 CSS | 세로 스크롤바 유무로 표 폭이 튄다 → `scrollbar-gutter: stable` |
| 5 | 공용 CSS + JS | 넘긴 방향이 안 보인다 → 짧은 방향성 페이드 |

## 조사에서 뒤집힌 것 두 가지

목업의 처방 중 **둘은 이 저장소에 맞지 않았다.** 실제 코드를 읽고 정정한다.

### ① soil은 `PaginationManager`를 쓰지 않는다

`shared/pagination.js`는 **퇴비 전용**이다. 토양은 `soil-script.js`에 자체 구현이 있고
(`renderCurrentPage`, `goToPage`, `updatePaginationUI`), **이미 `DocumentFragment`로 한 번에
붙인다.** 목업이 지적한 "행 하나씩 `appendChild`"는 퇴비 쪽에만 남아 있다.

→ `replaceChildren` 처방은 `pagination.js`에만 적용한다.

### ② `table-layout: fixed`는 이 티켓에서 뺀다

목록은 **22개 열**이고 공익직불제 모드(`gongik-on`)와 전체 보기(`full-view`)에 따라
표시 열이 셋씩 바뀐다. `fixed`로 바꾸면 폭을 명시하지 않은 열이 남는 폭을 균등 분배해
**레이아웃이 통째로 달라진다.** 얻는 것(열 폭 미세 흔들림)에 비해 위험이 크다.

→ 실제 변동 폭을 측정한 뒤 별도 티켓으로 판단한다. 측정 결과는 플랜 문서에 남긴다.

## 제약

- **E2E는 이 변경을 완전히 검증하지 못한다.** `docs/` 빌드본을 http로만 돌아 Electron
  실기의 전환을 못 본다(`electron-e2e-gap`). 높이·스크롤 위치는 E2E로 잡히지만
  체감은 실기 확인이 필요하다.
- 채움 행은 `tbody`를 순회하는 기존 코드에 끼어들면 안 된다. 확인 결과 순회는 모두
  `.row-checkbox` · `tr[data-id]` 선택자 기반이라 안전하다.
- 농가 구분선 행(`tr.farm-separator`)이 이미 같은 방식으로 `colSpan`을 쓴다.
  채움 행도 **같은 계산을 공유**해야 한다 — 따로 세면 모드가 바뀔 때 어긋난다.

## 우선순위

1. `goToPage`의 죽은 선택자 — **실제 결함**이고 체감이 가장 크다
2. 채움 행 — 마지막 페이지에서 아래 단추가 따라 올라오는 것
3. `scrollbar-gutter` — 한 줄
4. 방향성 페이드 — 있으면 좋은 것

## 리스크

| 리스크 | 완화 |
| --- | --- |
| 채움 행이 인쇄·내보내기에 섞인다 | 내보내기는 `sampleLogs`에서 만들고 DOM을 읽지 않는다(확인 필요, 플랜에서) |
| `colSpan`이 모드별로 어긋난다 | 구분선 행과 계산을 공유 |
| 페이드가 고정 열 좌표 측정과 부딪힌다 | `opacity`만 쓰고 `transform`은 tbody에만 — `offsetLeft`는 영향받지 않는다 (SLS-1-263) |
| 키프레임 이름 충돌 | 페이지 고유 이름 + `keyframes-collision.test.js`가 지킨다 |

## 검증

- 유닛: 채움 행 개수·`colSpan`, `goToPage`의 스크롤 대상
- E2E: 마지막 페이지로 넘겼을 때 표 높이가 유지되는가, 스크롤이 위로 가는가
- 실기: Electron에서 눈으로

## 종료 조건

사용자 "진행해줘" (2026-08-27) — 목업으로 세 축을 확인한 뒤의 승인.
