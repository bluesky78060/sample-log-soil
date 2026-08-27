# SLS-1-277 플랜 — `allclass-on`으로 그 탭에서만 되살린다

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

## 바꿀 것

### 1. `src/soil/soil-script.js` — 모드 클래스를 한 자리로

`gongik-on`을 토글하는 두 줄이 `renderLogs`(836)와 `renderCurrentPage`(3755)에
그대로 복사돼 있다. `allclass-on`이 늘면 네 자리가 된다.

```js
_syncTableModeClasses() {
    const filter = this.currentSearchFilter?.landClass1;
    const gongikOn = filter === '공익직불제';
    const table = this.logTable || document.getElementById('logTable');
    table?.classList.toggle('gongik-on', gongikOn);
    table?.classList.toggle('allclass-on', !filter);
    return gongikOn;
}
```

두 호출 지점 모두 필요하다. 결과가 0건이면 `renderLogs`가 조기 반환해
`renderCurrentPage`에 닿지 않는다.

### 2. `src/soil/soil-style.css` — 복원 규칙 + 바닥값

```css
.data-table.allclass-on th.col-landclass1,
.data-table.allclass-on td.col-landclass1 { display: table-cell; }

.data-table.allclass-on .col-name { left: 435px; }
```

`!important`는 쓰지 않는다 — (0,3,1)이 숨김(0,2,1)을 명시도로 이미 이긴다.
`col-name` 바닥값을 빠뜨리면 두 고정 열이 70px 포갠다(`full-view`와 같은 이유).

### 3. 주석 정정

SLS-1-261 주석의 "탭에 '전체'가 없고"를 사실에 맞게 고친다. 그 문장이 남아 있으면
다음 사람이 같은 전제로 또 감춘다.

### 4. `tests/e2e/soil-list-landclass-hidden.spec.js` — 시험 추가

이미 있는 헬퍼(`setTab`·`isShown`)를 그대로 쓴다. `setTab(page, '')`로 그 탭에 가서
`allclass-on`이 붙고 열이 보이는지, 구분을 고르면 다시 접히는지 **왕복**을 본다.

## 검증

- `npm run build` / `npm run lint` / `npx vitest run` / `npx playwright test`
- 변이 검증: `allclass-on` 규칙을 지우면 새 시험만 실패해야 한다

## 하지 않을 것

- 감춤 자체를 되돌리지 않는다 (SLS-1-261의 판단은 그 탭들에서 여전히 옳다)
- colSpan은 손대지 않는다 (SLS-1-280의 영역)
