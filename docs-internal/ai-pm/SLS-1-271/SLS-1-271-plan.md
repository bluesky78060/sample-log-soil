# SLS-1-271 플랜 — 퇴비 가져오기 경계조건 E2E

## 대상

| 파일 | 작업 |
| --- | --- |
| `tests/e2e/compost-import-boundary.spec.js` | **신규** |
| `src/**` | **변경 없음** |

## ⚠️ 사전 조사에서 나온 것 — 4번은 죽은 분기다

```js
// compost-script.js:2388  skipRowCheck
if (!record.farmName && !record.name && !record.sampleType) { … 건너뜀 … }

// compost-script.js  buildRecord
const sampleType = getVal('sampleType') || '가축분퇴비';   // ← 항상 값이 들어간다
```

`buildRecord`가 `sampleType`에 **기본값을 넣으므로 `!record.sampleType`은 절대 참이 되지
않는다.** 세 조건의 AND라 `skipRowCheck`는 **어떤 입력으로도 발동하지 않는다.**

결과: 농장명·대표자가 모두 빈 행도 **`sampleType`만 기본값으로 채워진 쓰레기 레코드로
등록된다.** `_excelData`가 거르는 것은 "전 칸이 빈 행"뿐이라, 비고 한 칸만 채워도 통과한다.

**이 티켓에서 고치지 않는다** — 범위는 검증 추가다. 테스트는 **현재 동작을 고정**하고
별도 티켓으로 올린다. 고칠 때 그 테스트가 빨개지며 무엇이 바뀌는지 드러난다.

## 테스트 설계

`compost-import-flow.spec.js`의 헬퍼(`openCompost` · `uploadSheet` · `readPersisted`)와
같은 방식을 쓴다. 상태로 단언하고 toast 문구는 보조로만 본다.

| # | 테스트 | 단언 |
| --- | --- | --- |
| 1 | 헤더만 있는 파일 | 모달이 열리지 않는다 (`#excelImportModal` hidden) |
| 2 | 빈 데이터 행만 | 모달이 열리지 않는다 |
| 3 | 서식과 전혀 다른 헤더 | 모달은 열리나 step2에서 **진행이 막힌다** (step3로 안 감) |
| 4 | 농장명·대표자가 빈 행 | **현재 동작 고정** — 건너뛰지 않고 등록된다 |
| 5 | 5000행 초과 | 미리보기가 정확히 5000건 |

### 1·2번을 "모달 안 열림"으로 단언하는 이유

`_handleFileSelect`는 `showToast` 후 `return`한다 — 모달을 열지 않는다.
문구 대신 **모달 가시성**을 보면 문구가 바뀌어도 테스트가 살아남는다.

### 5번 실행 시간

`MAX_IMPORT_ROWS`는 `_handleFileSelect` 안의 지역 상수라 주입할 수 없다.
5001행 xlsx를 브라우저에서 만들어야 한다. **먼저 시간을 재고**, 전체 E2E를 눈에 띄게
늘리면 그 항목만 빼고 **뺐다는 사실을 스펙 주석과 리뷰 문서에 남긴다.**

## 실행 순서

1. 스펙 작성 → `npm run build && npx playwright test compost-import-boundary`
2. 5번 소요 시간 측정
3. **변이 검증** — 각 가드를 무력화해 해당 테스트가 죽는지
   - (a) `jsonData.length < 2` 가드 제거 → 1번
   - (b) `_excelData.length === 0` 가드 제거 → 2번
   - (c) step2 매핑 검사 제거 → 3번
   - (d) `MAX_IMPORT_ROWS` 절단 제거 → 5번
   - 4번은 고정 테스트라 변이 대상이 아니다 (분기가 죽어 있다)
4. 전체 회귀 → 리뷰 → 승인

## 완료 조건

- [ ] 5건(또는 4건 + 제외 사유 명시) 통과
- [ ] 변이 (a)~(d) 각각 실제로 실패
- [ ] `git diff -- src/`가 비어 있음
- [ ] `skipRowCheck` 죽은 분기를 별도 티켓으로 발행
