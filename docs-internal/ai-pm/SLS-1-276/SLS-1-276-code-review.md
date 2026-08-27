# SLS-1-276 코드 리뷰

> 정본. `docs/03-code-review/`의 사본은 훅 통과용 일회용이다.

리뷰: 2026-08-27 · 3중 검증

| 레인 | 수행 | 결과 |
| --- | --- | --- |
| ① 품질·가독성·패턴 | 오케스트레이터 자체 검토 | 수정 3건 반영 |
| ② 독립 diff 리뷰 | **codex** (다른 계열 모델, 저장소 직접 열람) | CRITICAL 0 · MAJOR 0 · MINOR 1 |
| ③ 적대적 검증 | **변이 6종** — 고친 자리를 하나씩 되돌려 시험이 죽는지 확인 | 6/6 검출 |

## 판정: **승인**

CRITICAL 0 · MAJOR 0 · MINOR 1 (반영) · SUGGESTION 0

## 변경 요약

| 파일 | 변경 |
| --- | --- |
| `src/soil/soil-script.js` | 죽은 선택자 교체, 채움 행, 열 수 계산 통합, 방향 표시 |
| `src/shared/pagination.js` | `replaceChildren`, 채움 행, `totalPages` 재계산, 방향 표시 |
| `src/style.css` | `scrollbar-gutter`, 채움 행 스타일, 키프레임 2종, 움직임 최소 설정 |
| `tests/unit/pagination-filler.test.js` | 신규 22건 |
| `tests/e2e/soil-pagination-stability.spec.js` | 신규 5건 |

## codex MINOR — 행이 되지 못한 항목을 세지 않았다 · **반영**

**재현**: `renderRow()`가 어떤 항목에 `null`을 돌려주면 그 항목은 행이 되지 않는다.
그런데 채움 개수를 `pageData.length` 기준으로 세면, 빠진 만큼 **표가 짧아진다.**
이 티켓이 고치려던 바로 그 증상이 다른 경로로 남는다.

**반영**: 실제로 붙은 행을 센다.

```js
let renderedRows = 0;
pageData.forEach((item, index) => {
    const row = this.renderRow(item, startIndex + index);
    if (row) { fragment.appendChild(row); renderedRows++; }
});
```

codex가 함께 짚은 경계조건 셋을 시험으로 덮었다 — `renderRow`가 null을 돌려주는 경우,
마지막 페이지가 **정확히** 가득 찬 경우, 데이터가 0건이 된 경우.

## codex가 확인해 준 것 (문제 없음)

- 채움 행은 `row-checkbox` · `data-id` · 액션 버튼을 갖지 않는다 → 전체 선택·삭제·엑셀
  내보내기·라벨 인쇄·흙토람 업로드·주소 검증·완료 토글 **어느 대상에도 섞이지 않는다**
- `getComputedStyle(th).display` 계산은 정확하고, 호출은 렌더 1회당 머리글 열 수만큼이라
  성능 부담이 작다
- `setData → render → renderCurrentPage → updatePaginationUI` 경로와 페이지당 항목 수
  변경 경로 모두에서 `totalPages`가 재계산된다. 토양은 `renderLogs()`가 먼저 계산한다
- 애니메이션의 `translateY`는 가로 좌표를 건드리지 않아 `sticky-columns.js`의 `offsetLeft`
  측정과 충돌하지 않는다
- 키프레임 `listPageInNext` · `listPageInPrev`는 기존 이름과 충돌하지 않는다 (SLS-1-263)
- 채움 행은 `textContent`와 `aria-hidden`만 쓴다 — XSS·접근성 위험 없음

## 적대적 검증 — 변이 6종

고친 자리를 하나씩 되돌려 **시험이 실제로 죽는지** 확인했다. 통과하는 시험은 아무것도
지키지 못할 수 있다.

| # | 변이 | 결과 |
| --- | --- | --- |
| ① | `goToPage`의 선택자를 `.table-container`로 되돌림 | 1 failed ✅ |
| ② | 채움 행 루프 제거 | 2 failed ✅ |
| ③ | 애니메이션 재시작(remove + 리플로우) 제거 | 2 failed ✅ |
| ④ | 채움 행에 `data-id` 부여 | 2 failed ✅ |
| ⑤ | `pagination.js`의 `totalPages` 재계산 제거 | 2 failed ✅ |
| ⑥ | `renderedRows`를 `pageData.length`로 되돌림 | 1 failed ✅ |

**6종 모두 검출.** 되돌리면 통과 22/22.

## 오케스트레이터 자체 검토에서 고친 것

### 폭으로 재던 초안이 실기에서 무너졌다

`_visibleColumnCount()`의 첫 구현은 `th.offsetWidth > 0`으로 보이는 열을 셌다.
유닛에서는 값을 심어 통과했지만 **E2E가 잡았다** — 채움 행 `colSpan`이 17이어야 할
자리에 19가 찍혔다.

원인: 이 함수는 목록을 다시 그리는 도중에 불리는데, **tbody를 비우면 표가 통째로
폭 0으로 접힌다**(실측: 표 전체 `offsetWidth`가 0, 머리글 칸도 전부 0).
보이는 열이 하나도 없다고 나와 폴백 19로 떨어졌다.

`getComputedStyle(th).display`로 바꿨다. 레이아웃과 무관하게 옳은 값을 준다.
이 상황을 재현하는 유닛을 함께 넣었다("목록을 다시 그리는 도중에도 옳게 센다").

> 💡 **유닛만 있었으면 못 잡았다.** jsdom은 레이아웃을 계산하지 않아 폭 기반 구현의
> 함정이 드러나지 않는다. E2E가 실기 레이아웃을 보고 걸러 냈다.

### 열 수 계산을 구분선과 통합

플랜 리뷰에서 codex가 짚은 대로 `_buildFarmSeparatorRow`의 하드코딩 `18/19`를 없애고
`_visibleColumnCount()`를 함께 쓰게 했다. 현재 값과 결과가 같음을 유닛과 E2E 양쪽에서
못 박았다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| build | ✅ `✓ built in 1.85s` |
| lint | ✅ 0 errors, 6 warnings (기존, `--max-warnings 6`) |
| 유닛 | ✅ **906** (직전 884 + 신규 22) |
| E2E | ✅ **465** (직전 460 + 신규 5) |
| 변이 검증 | ✅ 6/6 검출 |

> ⚠️ E2E 첫 전체 실행에서 `admin-release-stats.spec.js:250`이 1건 실패했으나
> **flaky였다.** 단독 실행 19/19 통과, 재실행에서 465/465 통과.
> 그 스펙이 여는 `feedback-admin` 페이지는 이번에 고친 세 파일
> (`style.css` · `pagination.js` · `soil-script.js`)을 **하나도 참조하지 않는다**
> (`data-table` · `table-wrapper` · `pagination` 어느 것도 없음).

## 남은 것 — 실기 확인 필요

**E2E는 이 변경을 완전히 검증하지 못한다.** `docs/` 빌드본을 http로만 돌아 Electron
실기의 전환을 못 본다(`electron-e2e-gap`).

| 확인할 것 | 왜 |
| --- | --- |
| 페이지를 넘길 때 방향 애니메이션이 자연스러운가 | 눈으로만 볼 수 있다 |
| 채움 행이 빈 줄로 자연스럽게 보이는가 | 색·경계선은 실기에서 확인해야 한다 |
| Windows에서 `scrollbar-gutter`가 폭 튐을 막는가 | macOS는 겹쳐 그리는 스크롤바라 2px뿐이다 |

## 수용한 한계

- 표 높이가 **정확히** 0 차이가 되지는 않는다. 농가 구분선 행 개수가 페이지마다
  1~2개 다르기 때문이다. −334px가 ±1행(약 30px)으로 줄었다. 플랜에서 명시적으로
  멈추기로 한 지점이다.
- `table-layout: fixed`는 넣지 않았다. 실측 열 폭 변동이 **0px**이라 얻을 것이 없다.
