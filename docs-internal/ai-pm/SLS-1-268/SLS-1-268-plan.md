# SLS-1-268 플랜 — 퇴비 엑셀 가져오기 E2E 보강

## 대상 파일

| 파일 | 작업 |
| --- | --- |
| `tests/e2e/compost-import-flow.spec.js` | **신규** |
| `tests/e2e/compost-import-smoke.spec.js` | 유지 (수정 없음) |
| `src/**` | **변경 없음** |

## 배선 조사 결과 (구현 근거)

실제 코드를 읽어 확인한 흐름이다. 추측이 아니다.

```
label[for=excelImportInput] 클릭
  └→ <input type="file" id="excelImportInput" hidden>          compost/index.html:110
      └→ _handleFileSelect()                                    excel-import-manager.js:138
          ├→ XLSX.read → jsonData[0]=헤더, 나머지=데이터
          ├→ _autoMap()                                         :196  (autoMapRules 매칭)
          └→ _showStep(1) + modal.classList.remove('hidden')    :176-179
                └ step1: 공통정보(#importDate 필수) + #downloadTemplateBtn
#excelImportNextBtn ("다음")
  └→ _handleNext() step1 → validateStep1 → _showStep(2)         :438
        └ step2: #columnMappingArea 렌더                        :231 _renderColumnMapping
#excelImportNextBtn ("다음")
  └→ step2 → buildRecord 반복 → _parsedLogs
        ├→ postBuildRecords
        ├→ _autoAssignReceptionNumbers()                        :359 → :369
        └→ _renderPreview() → #previewTableBody                 :404
#excelImportNextBtn ("가져오기", step3에서 라벨 변경 :221)
  └→ onImportComplete(records)                                  compost-script.js:2394
        └→ sampleLogs.push → sort → saveLogs() → localStorage `compostSampleLogs_{year}`
```

핵심 식별자: `window.compostManager`(compost-script.js:2843), `STORAGE_KEY='compostSampleLogs'`(:16), `saveLogs()`(compost-script.js:2402).

## 테스트 설계

### 공통 헬퍼

```js
openWithFile(page, rows)   // 브라우저 안에서 XLSX 생성 → setInputFiles → 모달 대기
step(page)                 // 현재 단계 판별 (step1/2/3의 hidden 클래스)
readPersisted(page)        // page.reload() 후 localStorage에서 읽는다 (메모리 배열 아님)
```

> ⚠️ `soil-importer-fill.spec.js`의 교훈을 그대로 적용한다 — **`sampleLogs`(메모리 배열)를
> 읽거나 `not.toBe('')` 수준으로 단정하면 전 레코드가 '1'이어도 통과한다.** 실제로 그렇게
> 새어나간 결함이 SLS-1-222였다. 반드시 **새로고침 후 localStorage**를 읽고 **정확 일치**로 단정한다.

### 케이스

| # | 테스트 | 무엇을 잡나 |
| --- | --- | --- |
| 1 | 파일 선택 → `#excelImportModal` 표시, step1 노출 | `_handleFileSelect` 배선 |
| 2 | 다음 → `#columnMappingArea`에 헤더 수만큼 `.mapping-row`, 자동매핑이 실제로 필드를 가리킴 | `_autoMap` + `autoMapRules` |
| 3 | 다음 → `#previewTableBody`에 행 수 일치, 농장명·대표자 값이 그대로 | `buildRecord` 매핑 |
| 4 | 가져오기 → **새로고침 후** `compostSampleLogs_{year}`에 레코드 존재, 필드값 정확 일치 | 저장 배선 + 지속성 |
| 5 | 접수번호 없는 엑셀 → 미리보기 번호와 저장 번호가 **같고** `1,2,3` 연번 | 자동 채번 (`_autoAssignReceptionNumbers`) |
| 6 | 접수번호 있는 엑셀 → 그 번호가 **보존**된다 (자동 채번이 덮어쓰지 않음) | `hasReceptionNumbers` 분기 |
| 7 | `#downloadTemplateBtn` → 다운로드 이벤트 발생, 파일명 `퇴액비_가져오기_서식.xlsx` | `_downloadTemplate` 배선 |
| 8 | **접수번호가 일부만 있는 엑셀** → 현재 동작(빈 칸이 빈 채로 남음)을 그대로 단언 | `hasReceptionNumbers`의 `.some()` 분기 |

케이스 5·6·8이 Discovery에서 코드 리딩으로 종결한 채번 결론을 **기계적으로 고정**한다.

### 플랜 리뷰 반영 (codex, 2026-08-21)

리뷰가 MAJOR 2건을 잡았고 실제 코드로 확인해 전부 반영했다.

**(1) 저장 연도는 `selectedYear`로 읽는다 — 현재 연도를 하드코딩하지 않는다.**
`BaseSampleManager`의 `selectedYear`는 생성 시 현재 연도지만 init에서 `findYearWithData()`로
**덮인다**(BaseSampleManager.js:101). 즉 데이터가 2026년에만 있으면 2025년에 실행해도
`selectedYear`가 2026이 된다. `compostSampleLogs_2026`을 하드코딩하면 **테스트가 연말에
조용히 빈 배열을 읽고 통과**할 수 있다.

```js
const year = await page.evaluate(() => window.compostManager.selectedYear);
```

**(2) 케이스 8 추가 — `.some()`은 한 행만 번호가 있어도 배치 전체를 건너뛴다.**

```js
// excel-import-manager.js:370
const hasReceptionNumbers = this._parsedLogs.some(l => l.receptionNumber !== '');
if (hasReceptionNumbers) return;
```

접수번호가 **일부 행에만** 있는 엑셀을 넣으면 나머지 행은 **빈 접수번호로 저장된다.**
케이스 6(전 행에 번호 있음)만으로는 이 분기를 못 본다.

> ⚠️ 이것은 잠재 결함일 수 있으나 **이 티켓에서 고치지 않는다** — 범위는 검증 추가다
> (Discovery §3). 케이스 8은 **현재 동작을 있는 그대로 고정**해, 나중에 누가 고칠 때
> 무엇이 바뀌는지 보이게 하는 역할이다. 별도 티켓으로 올린다.

**(3) 케이스 2의 단언을 구체화한다.** `.mapping-row` 개수만 세면 자동매핑이 전부
비어 있어도 통과한다. `select` 선택값을 정확 일치로 본다 — `접수번호→receptionNumber`,
`농장명→farmName`, `대표자→name`, `생산일→productionDate`.

**(4) 케이스 7의 사전 조건 명시.** `#downloadTemplateBtn`은 모달 step1 **안에** 있어
초기에 접근 불가다. 공통 헬퍼로 모달을 먼저 연 뒤 클릭한다.

**(5) 변이 검증 (b)의 성립 조건을 고정한다.** `String(maxNum + 1)` 변이는 **번호 없는 행이
2건 이상이고 기존 저장 데이터가 없을 때만** 죽는다. 픽스처를 3행으로 고정하고, 테스트
시작 시 `localStorage.clear()`, 기대값을 정확히 `['1','2','3']`으로 단언한다.

**(6) 경계조건은 후속 티켓으로 명시한다** (SUGGESTION 수용, 이번 범위 밖).
헤더만 있는 파일(`jsonData.length < 2`), 빈 데이터 행만(`_excelData.length === 0`),
매핑 실패 시 step2 차단, `skipRowCheck` 전건 탈락, 5000행 절단 — 5가지.

### 픽스처

`templateConfig.headers`와 동일한 서식을 쓴다 — 실제 사용자가 받는 서식이 곧 입력이다.

```
접수번호 | 농장명 | 대표자 | 시료종류 | 축종 | 원료(부재료) | 생산일 | 검사목적 | 비고
```

## 실행 순서

1. `npm run build` (docs/ 갱신 — 테스트 대상)
2. 스펙 작성
3. `npx playwright test compost-import` → 전 항목 통과 확인
4. **변이 검증** — 아래 2가지를 각각 넣고 테스트가 죽는지 확인, 출력 보존
   - (a) `compost-script.js`의 `excelImporter.init()` 주석 처리 → 케이스 1~7 실패해야 함
   - (b) `excel-import-manager.js:394`를 `String(maxNum + 1)`로 훼손(순번 제거) → 케이스 5 실패해야 함
   - 확인 후 **반드시 원복**하고 `git diff --stat`으로 `src/` 무변경 확인
5. 전체 `npm test` 회귀 확인
6. `submit_test` → 코드리뷰(codex 독립 리뷰) → `approve_review`

## 완료 조건

- [ ] 케이스 8건 전부 통과
- [ ] 변이 검증 (a)(b) 각각 **실제로 실패**함을 출력으로 입증
- [ ] `git diff -- src/`가 비어 있음
- [ ] 전체 E2E 회귀 없음
