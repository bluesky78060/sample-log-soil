# SLS-1-223 실행 계획

세 부분을 **B → A → C** 순으로 한다. B가 채번 규칙이라 나머지가 그 위에 얹힌다.

## B. 네임스페이스를 표기 기준으로 (`reception-number.js`)

### 현재
```js
const isFill = log.subCategory === '성토';
if (fill !== isFill) continue;                       // 시퀀스 분리
const baseNumber = String(log.receptionNumber).split('-')[0];
if (!fill && baseNumber.startsWith('F')) continue;   // 일반 풀에서 F 제외
const numStr = fill ? baseNumber.replace('F', '') : baseNumber;
```

### 변경
`subCategory`를 보지 않고 **표기만** 본다.
```js
const base = String(log.receptionNumber).split('-')[0].trim();
const hasF = base.toUpperCase().startsWith('F');
if (fill !== hasF) continue;                         // 표기로 시퀀스 분리
const numStr = fill ? base.slice(1) : base;
```

- 불변식이 지켜지는 레코드에서는 `subCategory==='성토'` ⟺ `hasF`이므로 **결과가 동일**하다
- 위반 레코드는 이제 **표기가 속한 네임스페이스**에 들어간다 → 그 번호가 재발급되지 않는다
- `reception-group.js`·정렬이 이미 F 접두로 판단하므로 **기준이 통일**된다

### 동반 수정
`soil-result-importer.js`의 `collectExistingNumbers`도 같은 규칙으로 바꾼다(계약: 한 줄씩 같아야 함). 계약 주석에 **전수성 조건**을 추가한다 — "두 풀이 함께 모든 레코드를 덮어야 하며, 어느 쪽에도 안 들어가는 레코드가 있으면 그 번호가 재발급된다."

### 테스트
- **속성 테스트(핵심)**: 불변식을 지키는 무작위 대장 N회 생성 → 구/신 `computeNextNumber` 결과가 항상 동일. 구 구현을 테스트 안에 복사해 대조한다
- 위반 레코드가 있는 대장: `성토 '3'` → 일반 풀에 `3`이 들어가 다음 일반이 `4`
- 위반 레코드: `논 'F9'` → 성토 풀에 `9`가 들어가 다음 성토가 `F10`
- H 시나리오: 대장 `[성토 '3']` + 일반 자동 ×4 → 중복 0

## A. 탐지 (`reception-number.js` + 설정 화면)

### 순수 함수
```js
function auditReceptionNumbers(logs, opts) // → { violations, duplicates }
```
- `violations`: `subCategory==='성토'` ⟺ `F 접두`가 어긋난 레코드 (양방향)
- `duplicates`: 같은 `landClass1` 안에서 같은 본번 표기를 가진 레코드 묶음
- 각 항목에 `id`·`receptionNumber`·`name`·`landClass1`·`subCategory`와 사유

### 설정 화면
`src/settings/index.html`에 "접수번호 정합성 점검" 섹션을 추가한다. 기존 유지보수 도구(`migrateAllBtn`·`purgeYearsBtn`·`clearCacheBtn`·`checkNetworkBtn`)와 같은 패턴을 따른다.
- 버튼: 현재 연도 + 모든 연도 저장소를 순회해 결과를 표로 표시
- **읽기 전용** — 자동 수정은 하지 않는다. 재번호는 담당자 판단이 필요하다
- 0건이면 "이상 없음"을 명시한다

## C. 편집 경로 차단 (`soil-script.js` `_submitSingleEdit`)

구분 변경으로 불변식이 깨지는 저장을 막는다.

```
저장 전: namespaceViolation(접수번호 본번, subCategory==='성토')
위반이면 → 저장을 중단하고 "구분을 성토로 바꾸려면 접수번호도 F로 시작해야 합니다
           (현재: 9). 접수번호를 함께 수정하세요." 같은 안내
```

⚠️ **차단이 정당한 수정을 막을 수 있다.** 사용자가 구분만 고치려는 경우 접수번호까지 바꿔야 한다. 대안은 자동 재부여인데, 접수번호가 이미 라벨에 인쇄됐을 수 있어 조용히 바꾸는 것은 위험하다. → **차단 + 명확한 안내**를 택하고, 이 판단을 리뷰와 사용자 확인에 올린다.

`namespaceViolation`은 현재 `soil-result-importer.js`의 IIFE 안에 있다. 두 곳에서 쓰려면 `reception-number.js`(이미 `window.ReceptionNumber`로 노출)로 옮긴다.

## 검증 (통과 조건)

| 검증 | 기대 |
| --- | --- |
| 속성 테스트 (정상 데이터 no-op) | 구/신 결과 항상 동일 |
| H 시나리오 | 대장 중복 0 |
| 탐지 | 위반·중복을 찾고, 정상 데이터에서 0건 |
| 편집 차단 | 위반 저장이 막히고 안내가 보인다 |
| 기존 단위 554 · E2E 219 | 회귀 0 |
| `npm run lint` | 오류 0, 경고 4건(기준선) |
| **변이 검증** | B·A·C 각각 되돌리면 해당 테스트 실패 |
| 빌드 | 성공, `docs/`를 소스와 함께 커밋 |

## 하지 않을 것
- **이미 저장된 손상 데이터의 재번호** — 운영 데이터 확인이 선행돼야 하고 담당자 판단이 필요하다. A로 탐지만 제공한다
- 휴면 레거시 `ExcelImportManager` 경로 (SLS-1-224)
- upsert 미동작 (별 티켓)
- 메인 프로젝트 이식 — 이 티켓이 검증되면 별 티켓으로
