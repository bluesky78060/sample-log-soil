# SLS-1-197 플랜 — 퇴비 이식 후속 백로그 잔여 5건

## A. soil-script.js 중복 오버라이드 3종

### A-1. `extractReceptionNumber` — **삭제**

soil 사본은 base에서 널 가드(`|| ''`)만 빠진 **열화 사본**이다. 지우면 개선이다.

### A-2. `openLabelPrintWithData` — **훅으로 대체**

base와 본문이 같고 차이는 두 곳뿐이다.

| | base | soil |
| --- | --- | --- |
| 널 가드 | `(logs || []).map` | `logs.map` |
| 주소 추출 | `this.getLabelAddressParts(log)` | `this._extractLabelAddress(log)` |

base 주석이 이미 **"soil은 address 재파싱으로 오버라이드"**라고 그 훅을 가리킨다.

```js
// soil-script.js — openLabelPrintWithData 전체를 지우고 이것만 남긴다
getLabelAddressParts(log) {
    return this._extractLabelAddress(log);
}
```

### A-3. `updateSearchButtonState` — **훅 + 슬림 오버라이드**

⚠️ **순수 중복이 아니다.** soil은 `lot`·`purpose` 필터를 함께 보고
`purposeFilter` 배지도 다룬다. 통째로 지우면 기능이 사라진다.

```js
getFilterKeys() {
    return [...super.getFilterKeys(), 'lot', 'purpose'];   // dateFrom/To·name·receptionFrom/To + soil 고유
}

updateSearchButtonState() {
    super.updateSearchButtonState();          // 검색 버튼 배지는 base가 처리
    const purposeFilter = document.getElementById('purposeFilter');
    if (purposeFilter) purposeFilter.classList.toggle('has-filter', !!this.currentSearchFilter.purpose);
}
```

`sanitizeHTML` 참조도 base 쪽(`window.sanitizeHTML`)으로 일원화된다.

## B. `package.json`에 `test:e2e`

```json
"test:e2e": "npm run build && npx playwright test"
```

E2E는 `docs/` 빌드 산출물을 대상으로 한다. 주석 규약보다 스크립트가 강하다.
**기존 `test`는 건드리지 않는다** — CI·훅이 그것을 부를 수 있다.

## C. 퇴비 검색 모달 UI 왕복 E2E

현재 `compost-form.spec.js`는 `page.evaluate`로 매니저 API를 직접 조작해 **배선이 미커버**다.
모달 열기 → 입력 → 적용 → 행 수까지 실제 클릭으로 밟는다.

## D. eslint 예외 명시화

`compost-script.js`의 `max-lines-per-function` 경고 4건이 상수처럼 굳어 **5번째를 놓치는**
상태를 막는다. 파일 상단에 사유 주석 + 후속 티켓 참조를 남기고, 경고 개수를 고정하는
방법이 있으면 함께 검토한다.

## E. `openCompostAnalysis` typeof 가드

```js
if (isElectron && typeof window.electronAPI.openCompostAnalysis === 'function') { … }
else { 웹 폴백 }
```

구버전 preload가 이 메서드를 노출하지 않으면 현재는 **버튼이 아무 반응 없이 죽는다.**

## 실행 순서

1. A → 변이 검증 (오버라이드를 지운 뒤에도 라벨·검색이 같은가)
2. B·D·E
3. C 작성 → 변이 검증
4. 전체 회귀 → 리뷰 → 승인

## 완료 조건

- [ ] A 적용 후 라벨 인쇄·검색 배지 동작 동일 (E2E로 확인)
- [ ] C가 배선을 실제로 덮는다 (변이로 죽는가)
- [ ] E가 구버전 preload를 흉내 낸 상황에서 웹 폴백으로 넘어간다
- [ ] 해소된 7개 항목의 근거를 문서에 남긴다
