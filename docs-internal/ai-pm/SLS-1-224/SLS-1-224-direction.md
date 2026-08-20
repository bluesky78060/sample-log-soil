# SLS-1-224 방향 확정 — 휴면 레거시 ExcelImportManager 경로 제거

**일자**: 2026-08-20
**출처**: SLS-1-222 코드 리뷰 🟡 MINOR #2, SLS-1-223 리뷰 s-2

> ⚠️ 이 Discovery는 **사용자 Q&A 없이 코드 근거로 확정**했다. 근거는 아래 "왜 물어보지
> 않았나"에 적는다. 판단이 틀렸다면 되돌릴 지점도 함께 남긴다.

## 목표 (Why)

`src/shared/excel-import-manager.js`의 `_autoAssignReceptionNumbers`(:394)가 **모든 행에
일반 번호를 부여한다** — 성토 분기가 없다.

```js
l.receptionNumber = String(maxNum + i + 1);
```

`autoNumberFilter`는 성토·F접두를 max 계산에서 제외하는데 부여 단계에는 그 분기가 없어,
성토 행에 `F` 없는 번호가 찍힌다. **SLS-1-222·SLS-1-223이 고친 것과 같은 클래스의 결함**
(불변식 `F` 접두 ⟺ 구분='성토' 위반 → 채번 풀 분류가 어긋나 조용한 중복).

지금은 진입점이 도달 불가라 발현되지 않지만, **버튼을 되살리거나 `hidden`을 떼는 순간
그대로 재현된다.** 죽은 코드가 살아 있는 상태로 남아 있는 것이 문제다.

## 사용자 (Who)

전국 농업기술센터·분석기관. **이 변경으로 사용자가 보는 화면은 달라지지 않는다** —
제거 대상은 이미 도달 불가 상태다.

## 범위 (What)

### 포함 — soil의 레거시 경로만

| 파일 | 대상 | 줄 |
| --- | --- | --- |
| `src/soil/soil-script.js` | `this.initExcelImporter()` 호출 | 5151-5152 |
| | `initExcelImporter()` | 5406-5412 |
| | `_excelImporterFieldConfig()` | 5417-5459 |
| | `_excelImporterBehaviorConfig()` | 5460-5548 |
| `src/soil/index.html` | `#excelImportInput` + `<label>` | 122-123 |
| | `#excelImportModal` | 769-855 |
| `src/soil/soil-entry.js` | `import '../shared/excel-import-manager.js'` | 31 |

### 제외 — 건드리지 않는다

- **`src/shared/excel-import-manager.js` 자체** — compost가 쓴다(`compost-script.js:2267`).
  공용 모듈이므로 soil의 사용처만 끊는다.
- **`src/compost/**` 전부** — 같은 레거시 구조지만 compost는 이 경로가 **현역**이다.
  티켓 제목도 `soil:`이다. compost 쪽 성토 개념 자체가 없다(성토는 토양 전용).
- **`_autoAssignReceptionNumbers`의 성토 분기 추가**(티켓의 (b)안) — 아래 참조.

## 선택지와 결정

| | (a) 레거시 경로 제거 | (b) 유지하고 성토 분기 추가 |
| --- | --- | --- |
| 결함 해소 | ✅ 경로가 사라져 재현 불가 | ✅ 분기가 막음 |
| 남는 것 | 없음 | 죽은 코드 + 유지보수 대상 |
| 위험 | 기능 손실 가능성 | 세 번째 채번 구현이 생김 |
| compost 영향 | 없음(모듈 유지) | 공용 모듈 수정 → compost에 영향 |

**(a)를 택한다.** (b)는 공용 모듈에 성토(토양 전용 개념) 분기를 넣어 compost까지
영향권에 들이고, 이미 `reception-number.js`로 단일화한 채번 규칙의 **세 번째 구현**을
만든다. SLS-1-223이 판별자 이원화를 없애려고 한 작업과 정면으로 어긋난다.

## 제약 — 기능 손실을 어떻게 막나

🚨 **선례가 있다.** SLS-1-225 주석:

> "구 모달(`#excelImportModal`)에 '📄 엑셀 서식 다운로드'와 `_downloadTemplate()`이
> 있었으나, **구 모달 진입점이 hidden 처리되면서 의도치 않게 함께 사라졌다.**"

같은 실수를 반복하지 않기 위해 제거 전 다음을 **코드로 확인했다**:

| 확인 항목 | 결과 |
| --- | --- |
| 서식 다운로드가 구 모달에 의존하는가 | ❌ SLS-1-225가 새 importer에 **이미 복구**함 |
| 새 importer가 구 모달을 쓰는가 | ❌ `createElement` + `soilModalInnerHtml`로 **자체 생성**(:1268) |
| ID 충돌이 있는가 | ❌ 새 모달은 `sri-` 접두 · `sriTitle`만 씀 |
| 구 모달 ID를 참조하는 soil 코드 | `importDate` 등 6개 → **전부 `_excelImporterBehaviorConfig` 내부**(함께 제거) |
| 구 모달 ID를 참조하는 compost 코드 | 있으나 **`src/compost/index.html` 자기 파일** → 영향 없음 |
| `#toastContainer`가 모달 안인가 | ❌ 858행 = 모달(769-855) **밖**. 안전 |

## 우선순위

P3. 현재 발현되지 않으므로 급하지 않으나, **SLS-1-223 직후인 지금이 적기**다 —
같은 결함 클래스의 맥락이 살아 있고, 남겨두면 다음 사람이 "왜 여기만 규칙이 다르지"를
다시 조사해야 한다.

## 리스크

| 리스크 | 완화 |
| --- | --- |
| 구 모달에 아직 쓰이는 기능이 남아 있음 | 위 표의 6항목 코드 확인 + E2E 전수(441건) |
| 제거 후 `ExcelImportManager`가 soil에서 참조돼 `ReferenceError` | `soil-entry.js` import까지 함께 제거하고 빌드·E2E로 확인 |
| compost 회귀 | compost 파일 무변경 + compost E2E 통과 확인 |

## 검증 (어떻게 끝났다고 말할 것인가)

- `npm run build` 성공
- 단위·E2E 회귀 0 — **기준선은 이 티켓 시작 시점 참고값**(단위 863 / E2E 441)이고,
  판정은 실제 실행 출력으로 한다. 고정 숫자를 통과 조건으로 쓰지 않는다
- **compost 가져오기 E2E가 통과** — 공용 모듈이 살아 있음을 증명
- soil 가져오기(새 importer) E2E 통과 — 서식 다운로드 포함
- `grep -rn "ExcelImportManager" src/soil/` → 0건
- `npm run lint` 오류 0

## 왜 사용자에게 물어보지 않았나

이 변경은 **사용자가 보는 화면을 바꾸지 않는다**(제거 대상이 이미 `hidden`이라 도달 불가).
방향 (a)/(b)는 티켓이 이미 (a)를 권장했고, 그 전제("서식 다운로드 의존 여부 확인")를
코드로 검증해 (a)가 성립함을 확인했다. 남은 선택지가 없다.

**되돌릴 지점**: 제거 후 사용자가 "엑셀 가져오기에서 뭔가 없어졌다"고 하면
`git revert`로 즉시 복원 가능하다(순수 삭제 커밋이라 충돌 없음).
