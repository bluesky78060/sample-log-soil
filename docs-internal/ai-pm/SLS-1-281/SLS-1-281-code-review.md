# SLS-1-281 코드 리뷰 — colSpan 계약을 시험이 따라가게

> 정본. 훅 통과용 사본은 `docs/03-code-review/`.

## 무엇이 빨간불이었나

```
tests/e2e/soil-pagination-stability.spec.js:138
  채움 행의 colSpan이 농가 구분선과 같다
  Expected: 17 / Received: 22
```

**내 변경 탓인지 먼저 확인했다.** SLS-1-277 작업분을 stash하고 HEAD(a18acb7)에서
같은 시험을 돌렸더니 똑같이 실패했다 — 기존 실패다.

| 티켓 | colSpan을 무엇으로 정하는가 |
| --- | --- |
| SLS-1-276 | 지금 보이는 열만 정확히 (17) |
| SLS-1-280 | **머리글 칸 수, 숨김 포함** (22) |

SLS-1-280이 계약을 바꿨는데 SLS-1-276이 만든 시험이 따라가지 않았고, 그대로 머지됐다.

## 어느 쪽이 옳은가 — 구현이다

colSpan은 **남는 것과 모자라는 것이 대칭이 아니다.** 남으면 브라우저가 실제 열 수로
잘라 준다. 모자라면 화면에 그대로 드러난다(SLS-1-280 실측: 구분선이 `발송일자`·`관리`에
닿지 않았고 사용자가 실기로 신고했다).

전체 보기 토글은 목록을 다시 그리지 않고 표의 class만 바꾸므로, "정확한 값"은
**그려진 순간에만** 정확하다. 넉넉한 쪽이 옳다.

## 시험을 어떻게 고쳤나

```js
expect(spans.filler).toBe(spans.headerCells);            // 새 계약
expect(spans.filler).toBeGreaterThanOrEqual(spans.visible);  // 고장 자체를 본다
expect(spans.filler).toBe(spans.separator);              // SLS-1-276의 본래 목적 (유지)
```

첫 줄만 두면 "22와 같다"는 상수 확인에 그친다. 둘째 줄이 **SLS-1-280이 막으려던 고장**
(모자라서 끝 열에 닿지 않는다)을 직접 본다 — 열 구성이 바뀌어도 계속 유효하다.

플랜 리뷰 지적을 받아 **왜 정확한 값이 아니라 넉넉한 값인가**를 시험 주석에 남겼다.

## 변이 검증

⚠️ **첫 변이는 무효였다.** `_columnSpan()`을 `offsetWidth > 0` 필터로 되돌렸더니
시험이 **통과했다** — 그 시점에 tbody가 비어 표가 폭 0으로 접히고, 모든 th가 0이 되어
폴백(22)으로 떨어졌기 때문이다. 이 함정은 `_visibleColumnCount()` 주석에 이미 적혀 있었다.

`getComputedStyle(th).display !== 'none'`으로 다시 세는 변이를 넣자 **FAIL** ✅.
레이아웃과 무관한 기준으로 재야 진짜 "보이는 열만 세기"가 된다.

## 독립 리뷰 (codex)

> `colSpan` 시험 변경은 **은폐가 아닙니다.** 현재 머리글은 숨김 열 포함 22개 칸이며
> `_columnSpan()`도 머리글 칸 수를 반환합니다. `filler === headerCells`는 기존의 잘못된
> visible-column 계약을 실제로 잡습니다.

CRITICAL·MAJOR·MINOR 0건.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npx playwright test` | ✅ 488 passed (기존 실패 1건 해소) |
| `npx vitest run` | ✅ 925 passed |
| `npm run lint` | ✅ 0 errors |

## 판정

```text
🔴 CRITICAL: 0건 / 🟠 MAJOR: 0건 / 🟡 MINOR: 0건 / 🔵 SUGGESTION: 0건
→ 판정: APPROVED
```

## 남는 교훈

**구현이 계약을 바꾸면 그 계약을 단정하던 시험도 같은 커밋에서 가야 한다.**
SLS-1-280은 구현·주석·신규 시험 3건을 정확히 다뤘지만, **기존 시험 하나가 그 계약을
붙잡고 있다는 사실**을 보지 못했다. 전체 스위트를 돌렸다면 즉시 드러났을 것이다.
