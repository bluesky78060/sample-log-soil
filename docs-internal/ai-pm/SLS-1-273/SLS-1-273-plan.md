# SLS-1-273 플랜 — skipRowCheck 되살리기

## 대상

| 파일 | 작업 |
| --- | --- |
| `src/shared/excel-import-manager.js` | `skipRowCheck`에 **원본 셀 접근자**를 3번째 인자로 넘긴다 |
| `src/compost/compost-script.js` | `record` 대신 원본 값으로 판정 |
| `tests/e2e/compost-import-boundary.spec.js` | 케이스 4를 새 동작으로 |

## 바꿀 코드

```js
// excel-import-manager.js — _buildPreview
const rawVal = (field) => getVal(row, field);
const record = this.config.buildRecord(rawVal, …);
…
const warning = this.config.skipRowCheck(record, rowIdx, rawVal);   // ← 3번째 인자
```

```js
// compost-script.js
skipRowCheck: (record, rowIdx, raw) => {
    // ⚠️ record가 아니라 raw를 본다 (SLS-1-273).
    //    record는 buildRecord가 손댄 뒤라 sampleType은 항상 '가축분퇴비'이고
    //    name은 공통 대표자로 메워진다 → 어떤 입력으로도 참이 되지 않았다.
    if (!raw('farmName') && !raw('name') && !raw('sampleType')) {
        return `행 ${rowIdx + 2}: 농장명, 대표자, 시료종류가 모두 비어 있어 건너뜁니다.`;
    }
    return null;
},
```

판정 필드와 문구는 **그대로 둔다.** 정책이 아니라 **동작**만 고치는 변경이다.

## 테스트

케이스 4를 뒤집는다.

```
현재: 비고만 있는 행 → 미리보기 1건, 경고 없음, 저장됨
이후: 비고만 있는 행 → 건너뜀 경고 표시, 미리보기 0건, 가져오기 막힘
```

추가로 **하나만 있어도 유지되는지**를 본다 — 농장명만 / 대표자만 / 시료종류만.
리뷰 지적대로 **각각 별도 입력**으로 나눠 `&&` → `||` 변이가 확실히 죽게 한다.

그리고 리뷰가 찾은 핵심 시나리오를 고정한다 —
**1단계에서 공통 대표자를 입력해도** 비고만 있는 행은 건너뛴다.
`record.name`이 공통값으로 메워져도 원본이 비었으면 버려야 한다.

## 변이 검증

- (a) `raw(...)` 대신 `record.*`를 다시 본다 → 케이스 4가 죽는가
- (b) `&&` → `||` → "하나만 있어도 유지" 3건이 각각 죽는가
- (c) 공용 모듈에서 3번째 인자 전달을 뺀다 → 공통 대표자 시나리오가 죽는가

## 완료 조건

- [ ] 케이스 4가 새 동작을 단언하고 변이로 죽는다
- [ ] 농장명만·대표자만 있는 행은 유지된다
- [ ] 정상 경로 8건 회귀 없음
