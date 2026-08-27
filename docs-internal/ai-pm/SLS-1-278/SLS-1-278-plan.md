# SLS-1-278 플랜 — 전체 보기에서 보던 열을 제자리에

> 정본. `docs/01-plan/`의 사본은 훅 통과용 일회용이다.

작성: 2026-08-27 · 근거: `SLS-1-278-direction.md`

## 신규 모듈 `src/shared/table-scroll-anchor.js`

열 구성이 바뀌는 **전에** 기준 좌표를 잡아 두고, 바뀐 **뒤에** 가로 스크롤을 그만큼
되돌린다. 토양·퇴비가 같은 것을 쓴다.

```js
/**
 * 열 구성을 바꾸기 전에 불러 둔다. 돌려받은 함수를 바꾼 뒤에 부르면
 * 보던 열이 화면에서 같은 자리에 남는다.
 *
 * @param {HTMLTableElement|null} table
 * @returns {() => number} 실제로 보정한 픽셀 (0이면 보정할 것이 없었다)
 */
function captureColumnAnchor(table) { … }
window.captureColumnAnchor = captureColumnAnchor;
```

### 기준 열을 고르는 규칙

머리글 칸을 왼쪽부터 보며 **가로로 고정되지 않았고 지금 보이는** 열을 후보로 기억한다.

```js
const cs = getComputedStyle(th);
if (cs.display === 'none') continue;              // 숨긴 열
if (cs.left !== 'auto' || cs.right !== 'auto') continue;   // 가로로 고정된 열
```

- **왼쪽 고정 열은 쓸 수 없다.** 성명은 `sticky-col`이라 전체 보기에서 좌표가
  365→435로 바뀌는데, 그건 스크롤로 되돌릴 수 없는 종류의 이동이다(실측 +76px).
- **오른쪽 고정(관리)도 뺀다.** `right: 0`이라 언제나 제자리다.
- `sticky-columns.js`가 쓰는 것과 **같은 판별**이다. 그쪽은 `position`과 `right`를 보고,
  여기서는 `left`와 `right`를 본다 — 둘 다 "가로로 걸려 있나"를 묻는다.

### 왜 후보를 여럿 기억하나

토글 후 **첫 후보가 사라질 수 있다.** 전체 보기를 끌 때 첫 일반 열은 우편번호인데
그 열이 바로 사라진다. 그래서 후보를 순서대로 담아 두고, 보정할 때 **여전히 보이는
첫 열**을 쓴다.

일반 열은 전부 같은 양만큼 움직이므로(실측: 주소~발송일자 모두 +150~151) 하나만
찾으면 된다.

### 보정

**스크롤은 표가 아니라 감싼 칸에 있다** (codex 지적 M2). `<table>`의 `scrollLeft`를
건드리면 아무 일도 일어나지 않는다.

```js
const wrapper = table.closest('.table-wrapper');
…
const shift = Math.round(th.getBoundingClientRect().left - before);
if (shift) wrapper.scrollLeft += shift;
return shift;
```

`scrollLeft`는 브라우저가 알아서 [0, max] 안으로 잘라 준다. 전체 보기를 끌 때는
표가 좁아지며 브라우저가 **먼저** `scrollLeft`를 새 최대값으로 낮추고, 그 뒤에 우리가
남은 차이를 재므로 클램프가 보정을 망가뜨리지 않는다.

## 호출부

### `src/soil/soil-script.js` — `_bindViewToggle`

```js
viewToggleBtn.addEventListener('click', () => {
    const restoreScroll = window.captureColumnAnchor?.(this.logTable);

    this.isFullView = !this.isFullView;
    /* … 클래스·문구·아이콘 토글 (그대로) … */

    restoreScroll?.();                      // ← 보던 열을 제자리로
    window.scheduleStickyColumns?.(this.logTable);   // ← 그 다음에 고정 좌표
});
```

**순서가 중요하다.** 고정 좌표 재계산을 먼저 하면 보정 전 위치에서 재게 된다
(SLS-1-275에서 한 번 데인 자리다).

### `src/compost/compost-script.js` — `setupColumnToggle`

같은 모양. 퇴비의 열 구성은 다르지만 기준 열을 동적으로 찾으므로 그대로 동작한다.

### `src/*/…-entry.js`

`import '../shared/table-scroll-anchor.js';` 를 `sticky-columns.js` 근처에 넣는다.

## 새로 나타난 열의 페이드 — **넣지 않는다**

플랜 초안에는 `.col-reveal`에 짧은 페이드를 걸려 했다. **뺀다.**

codex가 먼저 짚은 것은 그런 클래스가 **없다**는 사실이다(토양은 `col-landclass1`·
`col-zipcode`, 퇴비는 `col-hidden`). 실제 클래스로 바꿔 쓸 수는 있지만, 그러면
애니메이션이 머리글만이 아니라 **모든 행의 셀에** 걸린다 — 100행이면 300개 요소다.

전체 보기는 사용자가 단추를 눌러 **의도한** 변화라 갑작스럽게 느껴지지 않는다.
이 티켓의 값어치는 "보던 자리가 유지되는 것"에 있고, 그건 스크롤 보정만으로 끝난다.
300개 요소에 애니메이션을 거는 위험을 얹을 이유가 없다.

## 하지 않는 것

| 항목 | 이유 |
| --- | --- |
| 화면 전환 스크롤 보존 | **이미 된다** — 실측 400 → 400 |
| 화면 전환 겹치기 크로스페이드 | 컨테이너 높이가 둘 중 큰 쪽으로 고정돼 목록 아래에 빈 공간이 생긴다 |
| `View Transition API` | 수천 행 표를 통째로 스냅샷한다. 얻는 것에 비해 비용이 크다 |
| 새로 나타난 열의 페이드 | 모든 행의 셀에 걸려 100행이면 300개 요소다 — 위 절 참조 |
| 세로 스크롤 보정 | 열이 늘어도 행 높이는 그대로다 — 세로는 흔들리지 않는다 |

## 검증

| 종류 | 내용 |
| --- | --- |
| 유닛 | 가로 고정 열은 기준이 되지 않는다 (왼쪽·오른쪽 둘 다) |
| 유닛 | 숨긴 열은 기준이 되지 않는다 |
| 유닛 | 첫 후보가 사라지면 다음 후보를 쓴다 |
| 유닛 | 후보가 하나도 없으면 아무것도 하지 않는다 (0 반환) |
| 유닛 | 표·감싼 칸이 없어도 죽지 않는다 |
| 유닛 | 스크롤을 표가 아니라 `.table-wrapper`에 준다 |
| E2E | 가로로 민 상태에서 전체 보기 켜기 → 기준 열이 같은 자리 (토양) |
| E2E | 다시 끄기 → 역시 같은 자리 |
| E2E | 퇴비에서도 같다 |
| E2E | 가로 스크롤이 **맨 왼쪽 · 중간 · 맨 오른쪽**일 때 각각 (codex 제안 — 맨 오른쪽에서 브라우저 클램프가 개입한다) |
| 실기 | Electron에서 눈으로 |

**변이 검증**: 보정 호출을 지우면 E2E가 실패해야 한다. 가로 고정 열을 후보에서
빼는 조건을 지우면 성명이 기준이 되어 보정량이 틀려야 한다.

## 되돌리기

호출부 두 곳에서 `restoreScroll?.()` 한 줄씩만 빼면 이전 동작으로 돌아간다.
모듈은 남아 있어도 아무 일도 하지 않는다.
