# SLS-1-276 플랜 — 목록 페이지 넘김 안정화

> 정본. `docs/01-plan/`의 사본은 훅 통과용 일회용이다.

작성: 2026-08-27 · 근거: `docs-internal/ai-pm/SLS-1-276/SLS-1-276-direction.md`

## 실측 — 무엇이 진짜 문제였나

빌드본(`docs/soil/`)에 45건을 넣고 페이지당 20건으로 실제로 재 봤다 (1440×900, macOS).

| 측정 | 값 | 판정 |
| --- | --- | --- |
| 1페이지에서 300px 내린 뒤 2페이지로 넘김 → `scrollTop` | **300 그대로** | 🔴 결함 |
| 마지막 페이지(5건)의 표 높이 변화 | **−334px** | 🔴 결함 |
| 성명 열 폭 변화 | **0px** | 🟢 문제 없음 |
| 성명 열 좌표 변화 | −2px | 🟢 무시 |
| 스크롤바 폭 | 2px (macOS overlay) | 🟡 Windows는 15px+ |

### 목업의 진단 중 하나는 실제 앱에 해당하지 않았다

**`table-layout: fixed`는 넣지 않는다.** 목록은 22개 열이고 대부분 `min-width`가 걸려 있어
페이지가 바뀌어도 열 폭이 **전혀 흔들리지 않는다**(실측 0px). 목업의 7열짜리 축소 표에서는
남는 폭이 분배돼 흔들렸지만, 실제 표는 이미 폭이 포화 상태다.

`fixed`로 바꾸면 폭을 명시하지 않은 열이 남는 폭을 균등 분배해 **레이아웃이 통째로 달라진다.**
얻을 것이 없는 위험이므로 뺀다.

### 반대로, 목업이 못 본 결함이 하나 있었다

```js
// soil-script.js:4125
const tableContainer = document.querySelector('.table-container');
if (tableContainer) tableContainer.scrollTop = 0;
```

**`.table-container`는 이 저장소 어디에도 없다.** HTML에도 CSS에도 없고, 이 한 줄이
유일한 등장이다. 실제 스크롤 컨테이너는 `.table-wrapper`다.

`if`로 감싸 놓아 오류도 나지 않는다. 그래서 **페이지를 넘겨도 표가 맨 위로 가지 않는다** —
목록 아래쪽을 보다가 다음 페이지를 누르면 새 페이지의 한가운데부터 보인다.
사용자가 말한 "자연스럽지 않다"의 가장 직접적인 원인이다.

퇴비가 쓰는 `shared/pagination.js:88`은 처음부터 `.table-wrapper`를 쓴다 — 그쪽은 멀쩡하다.

## 변경 목록

### 1. `src/soil/soil-script.js`

**(a) 죽은 선택자** — `goToPage()`

```js
const wrapper = document.querySelector('.table-wrapper');
if (wrapper) wrapper.scrollTop = 0;
```

**(b) 채움 행** — `renderCurrentPage()`

마지막 페이지가 짧아도 표 높이를 유지한다. **페이지가 둘 이상일 때만** 채운다 —
전체가 5건인데 페이지당 100건이면 빈 줄 95개가 생겨 오히려 이상하다.

채움 행은 **읽히지 않아야 한다** — `aria-hidden="true"`를 붙인다(codex 제안).

```js
if (this.totalPages > 1) {
    const missing = this.itemsPerPage - pageRows.length;
    for (let i = 0; i < missing; i++) fragment.appendChild(this._buildPageFillerRow());
}
```

**(b-2) 열 수 계산을 하나로 모은다** — codex 리뷰 반영

`colSpan`은 **화면에 실제로 보이는 열만** 센다. 그리고 그 계산을 구분선 행과 **공유한다.**

```js
/** 지금 화면에 보이는 열 수. 숨긴 열(경지구분·공익직불제 전용 등)은 빼고 센다. */
_visibleColumnCount() {
    const head = this.logTable?.tHead?.rows[0];
    if (!head) return 19;                       // 표가 없을 때의 폴백 = 기본 모드 열 수
    let n = 0;
    for (const th of head.cells) if (th.offsetWidth > 0) n++;
    return n || 19;                             // 표가 화면 밖이면 폭이 전부 0이다
}
```

`_buildFarmSeparatorRow`의 하드코딩 `gongikOn ? 18 : 19`도 이 헬퍼로 바꾼다.
지금 값과 결과가 같지만(실측 19/18), **열이 하나 늘면 손으로 고쳐야 하는 자리가 없어진다.**

> codex 지적: thead 전체(22)를 세면 숨긴 열까지 포함해 구분선과 폭이 갈라진다.
> 초과 `colSpan`은 브라우저가 잘라내므로 당장은 무해하지만, 플랜이 말한
> "같은 계산 공유"와 실제 구현이 어긋난다.

> ⚠️ 높이가 **정확히** 0 차이가 되지는 않는다. 농가 구분선 행이 페이지마다 1~2개씩
> 다르기 때문이다(실측 39행 vs 40행). −334px가 ±1행(약 30px)으로 줄어든다.
> 구분선까지 맞추려면 페이지별 구분선 개수를 세어 보정해야 하는데, 얻는 것에 비해
> 코드가 복잡해진다. **여기서 멈춘다.**

**(c) 방향성 페이드** — `goToPage()`에서 방향을 넘겨 `renderCurrentPage(dir)`가 클래스를 건다.

**같은 방향으로 연달아 넘길 때도 다시 재생되어야 한다.** 클래스가 이미 붙어 있으면
CSS 애니메이션은 다시 돌지 않는다. 지웠다가 리플로우를 한 번 강제한 뒤 다시 붙인다.

```js
tbody.classList.remove('page-in-next', 'page-in-prev');
void tbody.offsetWidth;                          // 여기서 끊어 줘야 다시 재생된다
tbody.classList.add(dir > 0 ? 'page-in-next' : 'page-in-prev');
```

> codex 지적: 1→2→3처럼 같은 방향 연속 이동에서 두 번째 애니메이션이 재생되지 않는다.

### 2. `src/shared/pagination.js` (퇴비)

- `innerHTML = ''` + 행별 `appendChild` → `DocumentFragment` + `replaceChildren`
- 같은 규칙의 채움 행
- 같은 방향성 페이드
- `goToPage`의 스크롤 대상은 이미 옳다 — 건드리지 않는다

### 3. `src/style.css` (공용)

```css
.table-wrapper { scrollbar-gutter: stable; }

tr.page-filler { pointer-events: none; }
tr.page-filler td { color: transparent; }

@keyframes listPageIn { from { opacity: .25; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes listPageInUp { from { opacity: .25; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
.data-table tbody.page-in-next { animation: listPageIn .24s cubic-bezier(.22,.61,.36,1); }
.data-table tbody.page-in-prev { animation: listPageInUp .24s cubic-bezier(.22,.61,.36,1); }

@media (prefers-reduced-motion: reduce) {
    .data-table tbody.page-in-next, .data-table tbody.page-in-prev { animation: none; }
}
```

**키프레임 이름은 공용 CSS에 새로 만든다.** 페이지 CSS가 같은 이름을 재정의하면
`tests/unit/keyframes-collision.test.js`가 잡는다 (SLS-1-263).

**`transform`을 세로로만 쓴다.** `sticky-columns.js`는 `offsetLeft`로 재므로 `transform`의
영향을 받지 않지만(그래서 `getBoundingClientRect`를 일부러 피했다), 그래도 가로 변위는
만들지 않는다. 세로 8px은 고정 열 좌표와 무관하다.

## 하지 않는 것

| 항목 | 이유 |
| --- | --- |
| `table-layout: fixed` | 실측 열 폭 변동 0px — 얻을 것 없이 22열 레이아웃을 흔든다 |
| 구분선 행까지 세는 정밀 높이 보정 | ±1행 차이를 위해 코드를 복잡하게 만들지 않는다 |
| 화면 전환(`.view`) · 전체 보기 FLIP | 별도 티켓 |
| `scrollTo({behavior:'smooth'})` | 표 안쪽 스크롤은 즉시가 낫다 — 새 행이 이미 그려진 채 천천히 올라오면 느리게 느껴진다 |

## 검증

| 종류 | 내용 |
| --- | --- |
| 유닛 | 채움 행 개수(`itemsPerPage - 행수`), 1페이지뿐일 때 채우지 않음 |
| 유닛 | 채움 행의 `colSpan`이 **보이는 열 수**와 같고, 구분선 행과 **같은 값**이다 |
| 유닛 | 채움 행에 `.row-checkbox`도 `data-id`도 없다 — 선택·삭제·내보내기 대상에 섞이면 안 된다 |
| 유닛 | 같은 방향으로 연달아 넘겨도 애니메이션 클래스가 다시 붙는다 |
| 유닛 | 키프레임 충돌 테스트 통과(기존 스펙이 새 이름을 함께 본다) |
| E2E | 아래로 스크롤한 뒤 다음 페이지 → `scrollTop === 0` **(현재 실패하는 시나리오)** |
| E2E | 마지막 페이지 표 높이가 첫 페이지의 ±1행 안 |
| 실기 | Electron에서 눈으로 — E2E가 못 보는 영역 |

**변이 검증**: `goToPage`의 선택자를 `.table-container`로 되돌리면 새 E2E가 실패해야 한다.
채움 행 루프를 지우면 높이 단언이 실패해야 한다.

## 되돌리기

세 파일 모두 독립적이다. 문제가 생기면 해당 변경만 되돌린다.
채움 행은 `totalPages > 1` 조건 한 줄을 `false`로 바꾸면 즉시 꺼진다.
