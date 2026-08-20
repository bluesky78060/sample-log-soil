# SLS-1-224 코드 리뷰 — 레거시 ExcelImportManager 경로 제거

**일자**: 2026-08-20
**판정**: **APPROVED** — CRITICAL 0 / MAJOR 0 / MINOR 2(수정) / SUGGESTION 1(기록)

## 검증 레인

| # | 레인 | 수행 |
| --- | --- | --- |
| 1 | 독립 diff 리뷰 (다른 계열 모델) | **Codex CLI** — 삭제 diff 606줄 + 신규 테스트 2종 직접 열람 |
| 2 | 지적 재현 검증 | 지적 위치를 저장소에서 **직접 확인** |
| 3 | 적대적 검증 | 순수 삭제라 변이 검증이 성립하지 않는다 → **제거 검증 테스트를 삭제 전에 돌려 FAIL 확인**으로 대체 |

> 플랜 리뷰(1차 6건 반려 → 2차 3건 반려 → 승인)는 `SLS-1-224-plan-review.md` 참조.
> **플랜 단계에서 CSS 305줄 누락과 compost 테스트 부재를 잡은 것이 이 티켓의 최대 성과다.**

## 변경 규모 — 순수 삭제 548줄

| 파일 | 삭제 |
| --- | --- |
| `src/soil/soil-script.js` | `initExcelImporter` · `_excelImporterFieldConfig` · `_excelImporterBehaviorConfig` + 호출 (151줄) |
| `src/soil/soil-style.css` | 「엑셀 가져오기 모달 스타일」 블록 (304줄) |
| `src/soil/index.html` | `#excelImportModal` (89줄) + `#excelImportInput`·label (3줄) |
| `src/soil/soil-entry.js` | 공용 모듈 import (1줄) |

신규 테스트 2종(제거 검증 · compost 스모크) 추가.

## 플랜 리뷰 승인 조건 6가지 — 전부 충족

| # | 조건 | 확인 |
| --- | --- | --- |
| 1 | 6단계 순서대로 삭제 | ✅ 기준선(14 pass) → compost 스모크(1 pass) → 제거검증 FAIL 확인 → 코드 → 마크업 → CSS → import |
| 2 | `#toastContainer`(858행)를 건드리지 않음 | ✅ 무변경 |
| 3 | CSS를 1169에서 정확히 끊음 | ✅ 1170부터 주소 컬럼 스타일 온전 |
| 4 | `soil-result-importer.js:149` 주석 보존 | ✅ 남아 있음 (SLS-1-225 복구 이유 기록) |
| 5 | compost 파일 무변경 | ✅ `src/compost/**` 0줄 (빌드 산출물 해시만 변동) |
| 6 | 제거 검증이 삭제 전 FAIL하는 성질 | ✅ **삭제 전 실행해 실제로 FAIL 확인** |

## 🟡 MINOR — 수정함

### m-1. 삭제된 메서드를 근거로 든 주석이 남음 (`soil-script.js:4242`)

`setupTypeSpecificEvents`의 주석이 호출 순서 제약의 근거로 **더 이상 존재하지 않는**
`initExcelImporter`를 들고 있었다. 다음 사람이 없는 것을 찾게 만든다.

```diff
- // ⚠️ 일부 메서드는 초기화 부작용(AddressManager 인스턴스화·addParcel·드롭다운 채우기·
- //    initExcelImporter)을 포함하므로 호출 순서를 바꾸면 안 된다(SLS-1-106 zero-move 분해).
+ // ⚠️ 일부 메서드는 초기화 부작용(AddressManager 인스턴스화·addParcel·드롭다운 채우기)을
+ //    포함하므로 호출 순서를 바꾸면 안 된다(SLS-1-106 zero-move 분해).
```

### m-2. 단위 테스트에 삭제된 메서드 스텁이 남음 (`base-quota.test.js:340`)

```js
m.initExcelImporter = () => {}   // ← 삭제
```

`_bindExportImportAndIO`가 `initExcelImporter`를 부르던 시절의 스텁이다. 호출이 사라져
무의미해졌고, 잔재 grep을 오염시킨다. 제거 후 테스트 863건 그대로 통과.

### 🚨 왜 이 둘을 내 grep이 놓쳤나 — 플랜의 구멍

플랜 6단계의 잔재 grep이 **`src/soil/`로 한정**돼 있었다.

```bash
grep -rn "_excelImporter" src/soil/     # ← tests/ 를 안 본다
```

m-2는 `tests/unit/`에 있었고, m-1은 `src/soil/` 안이지만 **주석 제외 필터에 걸려**
보이지 않았다. 검증 범위를 `src/ tests/ scripts/` 전체로 넓혀 재확인했고 0건이다.

**교훈**: 삭제 티켓의 잔재 검색은 *지운 디렉토리*가 아니라 *저장소 전체*를 봐야 한다.
지운 심볼을 참조하는 쪽은 대개 다른 곳에 있다.

## 🔵 SUGGESTION — 수정 안 함 (근거 기록)

### s-1. compost 스모크가 전역·DOM만 본다

`compost-import-smoke.spec.js`는 `window.ExcelImportManager`와 진입점 DOM 존재만
확인하고, 실제 파일 선택이나 importer 초기화까지는 가지 않는다. 마크업과 전역은 남고
**배선만 끊긴 경우** 통과할 수 있다.

다만 이 티켓의 목적은 "soil의 import 제거가 compost의 공용 모듈을 앗아가지 않았다"는
**최소 생존 증명**이고, 그 범위에는 부합한다(Codex도 동의). compost 가져오기 동작
전체를 검증하는 것은 별 티켓이 맞다 — 저장소에 compost 가져오기 E2E가 애초에 없었다는
사실 자체가 별도로 다뤄야 할 공백이다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| 빌드 | ✅ 성공 |
| 단위 | ✅ **863 passed** (56 files) — 삭제 전과 동일. 지운 코드에 단위 테스트가 없었다 |
| E2E | ✅ **444 passed** — 441 → 444 (제거 검증 2 + compost 스모크 1) |
| Lint | ✅ 오류 0 / 경고 6 (기존 기준선 유지 — 삭제된 함수는 경고원이 아니었다) |
| 잔재 grep (저장소 전체) | ✅ `initExcelImporter`·`_excelImporter*` 0건, compost 유지 |
| 제거 검증 (변이 대체) | ✅ 삭제 전 **FAIL** / 삭제 후 **PASS** |

### ⚠️ 검증 중 관찰된 flakiness (이번 변경과 무관)

전체 E2E와 단위 테스트를 **동시에** 돌리면 `extract-whatsnew.test.js`가 5초 타임아웃으로
2~6건 실패한다. 부하 없이 단독·순차 실행하면 863건 전부 통과한다. 임시 디렉토리에
파일을 쓰고 스크립트를 돌리는 테스트라 I/O 경합에 취약하다.

**이번 변경과 무관하지만 기록해 둔다** — CI에서 병렬로 돌면 무작위 실패로 나타날 수
있다. `testTimeout` 상향 또는 순차 실행 지정이 필요하면 별 티켓으로 다룬다.

## 남은 것

- **SLS-1-223 s-2 재판단**: 레거시 경로가 사라지면서 `skipRowCheck`의 불변식 검사도 함께
  없어졌다. `addImportedRecord`를 부르는 곳은 이제 새 importer의 `computePreview`
  (이미 차단) 하나뿐이라 **심층방어의 근거가 오히려 약해졌다.** 별 판단 없이 둔다.
- **compost 가져오기 E2E 공백**: 현역 경로인데 동작 검증이 스모크뿐이다.
- **`_autoAssignReceptionNumbers`의 성토 분기 부재**: 공용 모듈에 그대로 남아 있다.
  compost는 성토 개념이 없어 발현되지 않지만, 다른 시료 종이 이 모듈을 쓰면서 성토류
  분류를 도입하면 되살아난다.
