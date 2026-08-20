# SLS-1-224 실행 계획 — 레거시 ExcelImportManager 경로 제거 (soil)

순수 **삭제** 티켓이다. 새 동작을 추가하지 않으므로, 계획의 핵심은
"무엇을 지우나"가 아니라 **"지워도 되는지 어떻게 증명하나"**다.

## 순서 — 증명 → 삭제 → 확인

먼저 회귀 테스트를 심고, 그 다음에 지운다. 삭제 후에 테스트를 쓰면
"원래 동작하던 것"의 기준선이 사라진다.

### 0단계. 기준선 확보 (삭제 **전**에 통과해야 하는 것)

대체 경로가 살아 있음을 **삭제 전에** 고정한다. 이 테스트들은 삭제 후에도 그대로
통과해야 한다 — 하나라도 깨지면 기능 손실이다.

**확인 결과 기존 커버가 충분하다 — 새로 만들지 않는다.**

| 파일 | 무엇을 지키나 |
| --- | --- |
| `tests/e2e/soil-import-template.spec.js` | 서식 다운로드 — 버튼 노출, **내려받은 파일이 원본과 바이트까지 동일**, 서식 정의(색·테두리) 보존, 되올리기까지 |
| `tests/e2e/soil-importer-fill.spec.js` | 새 importer의 가져오기 동작 |

⚠️ **`soil-import-template.spec.js`가 이 티켓의 핵심 안전장치다.** SLS-1-225 주석이
기록한 사고(모달을 hidden 처리하며 서식 다운로드가 함께 사라짐)가 정확히 이 자리에서
났고, 그 재발을 이 스펙이 막는다. **삭제 전후로 이 스펙이 통과하는지 각각 확인한다.**

> 🚨 **플랜 리뷰 지적 3 반영**: 「구 모달 진입점은 화면에 없다」류는 여기 두지 않는다.
> 구 모달은 삭제 전에도 `hidden`이라 **삭제 전후 모두 통과**한다 — "보이지 않는다"만
> 증명하고 "제거되었다"는 증명하지 못한다. 제거 검증은 4단계로 분리한다.

### 0-b단계. compost 스모크 (공용 모듈 생존 증명)

**compost는 이 경로가 현역이다** — `src/compost/index.html:107`의 label은 `util-btn`
클래스로 **화면에 보이고**, soil처럼 `hidden`이 아니다. 그런데 저장소에 compost
가져오기 E2E가 **없다**(플랜 리뷰 지적 4·5로 확인).

soil에서 import를 끊었을 때 compost가 무사한지 증명할 수단이 지금 없으므로,
최소 스모크를 **먼저 추가한다**.

```js
// tests/e2e/compost-import-smoke.spec.js (신규)
test('compost 페이지에서 ExcelImportManager가 살아 있다', async ({ page }) => {
    await page.goto('/compost/');
    expect(await page.evaluate(() => typeof window.ExcelImportManager)).toBe('function');
    await expect(page.locator('#excelImportInput')).toHaveCount(1);
    await expect(page.locator('#excelImportModal')).toHaveCount(1);
});
```

⚠️ 전역 노출 방식이 `window.ExcelImportManager`가 맞는지 **구현을 확인하고 적는다**
(공용 모듈은 `window.*` 노출 관례를 따르지만 확인 없이 단정하지 않는다).

### 1단계. soil-script.js에서 배선 제거

```
5151-5152  // 엑셀 가져오기\n this.initExcelImporter();
5406-5412  initExcelImporter()
5417-5459  _excelImporterFieldConfig()
5460-5548  _excelImporterBehaviorConfig()
```

⚠️ 5152는 `_bindUtilityButtons` 계열 메서드 안에 있고, **SLS-1-106 zero-move 분해**
주석(4242)이 "호출 순서를 바꾸면 안 된다"고 못박아 두었다. 호출 **한 줄만** 지우고
주변 순서는 건드리지 않는다.

### 2단계. index.html에서 마크업 제거

```
122-123  #excelImportInput + <label for=…>
769-855  #excelImportModal 전체
```

⚠️ `#toastContainer`는 **858행**이다. 855에서 정확히 끊어야 한다 — 한 줄이라도
넘기면 토스트 전체가 죽는데, 토스트는 저장 성공·실패 안내라 조용히 사라지면
사용자가 저장 여부를 알 수 없게 된다.

### 3단계. soil-style.css에서 구 모달 전용 스타일 제거

```
866-1169   /* 엑셀 가져오기 모달 스타일 */ 블록 전체
```

플랜 리뷰 지적 2로 추가된 범위다. 이 블록의 셀렉터가 **전부 구 모달 전용임을 확인**했다:

| 셀렉터 | 사용처 |
| --- | --- |
| `.modal-content.modal-xlarge`, `.import-step-*`, `.import-field*`, `.import-template-area`, `.btn-template-download`, `.template-hint`, `.column-mapping-area`, `.preview-table*`, `.import-warnings`, `.modal-footer-spacer` | `index.html` **769-855(구 모달) 안에서만** |
| `.mapping-row`, `.mapping-excel-col`, `.mapping-arrow`, `.mapping-select`, `.mapping-sample` | `index.html`에 없음 — `ExcelImportManager`가 **동적 생성**하던 것 |

새 importer의 **스타일 셀렉터는 `.sri-*`**이고, 그 밖에 쓰는 클래스는
`active` · `addr` · `col-road` · `col-zip` · `is-dup` · `is-err`인데 **삭제 대상 블록에
이 이름들이 없다** — 겹치지 않는다. ("`.sri-*`만 쓴다"는 부정확한 표현이라 정정했다.)

⚠️ **1170행부터는 「주소 컬럼 스타일」**이라 다른 기능이다. 1169에서 정확히 끊는다.

### 4단계. soil-entry.js에서 import 제거

```
31  import '../shared/excel-import-manager.js';
```

soil 번들에서 공용 모듈이 빠진다. **compost는 자기 entry(`compost-entry.js:33`)로
계속 import하므로 영향 없다.**

### 5단계. 제거 검증 (삭제 **후에만** 통과해야 하는 것)

플랜 리뷰 지적 3·4 반영. "안 보인다"가 아니라 **"없다"**를 증명한다.

```js
// tests/e2e/soil-import-baseline.spec.js 에 추가
test('레거시 가져오기 DOM이 남아 있지 않다', async ({ page }) => {
    await page.goto('/soil/');
    await expect(page.locator('#excelImportModal')).toHaveCount(0);
    await expect(page.locator('#excelImportInput')).toHaveCount(0);
    // soil 번들에 공용 모듈이 실려 있지 않다
    expect(await page.evaluate(() => typeof window.ExcelImportManager)).toBe('undefined');
});
```

> ⚠️ **번들 크기 감소만으로는 부족하다**(플랜 리뷰 지적 3). 트리 셰이킹·압축 때문에
> 크기는 다른 이유로도 변한다. **런타임 전역 부재**가 직접 증거다.

### 6단계. 잔재 확인

```bash
# 실행 코드에서 0건 — 주석은 제외한다 (플랜 리뷰 지적 1)
grep -rn "ExcelImportManager" src/soil/                    # → 0건
grep -rn "_excelImporter" src/soil/                        # → 0건
grep -rn "excelImportModal\|excelImportInput" src/soil/ | grep -v "^\S*: *//"   # → 0건
grep -rn "ExcelImportManager" src/compost/                 # → 유지되어야 한다
```

> ⚠️ `soil-result-importer.js:149`의 주석이 **`#excelImportModal`을 언급한다**
> ("구 모달(#excelImportModal)에 … 있었으나"). 이 주석은 SLS-1-225가 서식 다운로드를
> 왜 복구했는지 설명하는 **살려둘 가치가 있는 기록**이므로 지우지 않는다.
> 대신 grep 조건에서 주석을 걸러낸다. (클래스명 `ExcelImportManager`는 이 파일에 없다.)

## 검증 (통과 조건)

숫자는 **실행 결과를 적는다** — 아래 기준선은 이 티켓 시작 시점 값이고, 리뷰 문서에는
실제 출력을 붙인다(플랜 리뷰 지적 6).

| 검증 | 기대 |
| --- | --- |
| `npm run build` | 성공 |
| 단위 (기준선 863) | 회귀 0 |
| E2E (기준선 441 + 신규) | 회귀 0 |
| **compost 스모크** | 통과 — 공용 모듈·레거시 DOM이 compost에 **살아 있다** |
| **soil 서식 다운로드** | 통과 — SLS-1-225 복구본이 무사하다 |
| **soil 레거시 DOM 부재** | `#excelImportModal`·`#excelImportInput` count 0, `window.ExcelImportManager` undefined |
| `npm run lint` | 오류 0. 경고는 기존 6건 **이하** |
| 잔재 grep | soil 실행코드 0건 / compost 유지 |
| 변이 검증 대체 | 순수 삭제라 통상적 변이 검증이 성립하지 않는다. 대신 **5단계 제거 검증을 삭제 전에 돌려 실패하는지** 확인한다 — 삭제 전 FAIL / 삭제 후 PASS면 그 테스트는 제거를 실제로 감시한다 |

## 하지 않을 것

- **`_autoAssignReceptionNumbers`에 성토 분기 추가** — 방향 문서의 (b)안. 공용 모듈에
  토양 전용 개념을 넣고 채번 구현을 셋으로 늘린다. compost는 성토 개념이 없다.
- **compost의 레거시 구조 정리** — compost는 이 경로가 현역이다. 별 티켓.
- **`src/shared/excel-import-manager.js` 삭제** — compost가 쓴다.
- **SLS-1-223 s-2(`addImportedRecord` 심층방어)** — 이 티켓이 레거시 경로를 없애면
  `skipRowCheck`의 불변식 검사도 함께 사라진다. 그러면 남는 호출부는 새 importer의
  `computePreview`(이미 차단) 하나뿐이라 **s-2의 근거가 오히려 약해진다.**
  제거 후 호출부를 다시 세어 판단한다 — 이 티켓에서 결론 내지 않는다.

## 롤백

순수 삭제 커밋이므로 `git revert` 한 번으로 완전 복원된다. 데이터 마이그레이션도,
스토리지 키 변경도 없다 — **되돌릴 수 없는 것을 건드리지 않는다.**
