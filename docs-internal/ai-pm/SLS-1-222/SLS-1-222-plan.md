# SLS-1-222 실행 계획 — 성토 시퀀스 채번 이식

메인 커밋 `979fa90`(PR #8)의 최종 상태를 이식한다. 메인은 3커밋에 걸쳐 회귀 1건을 거쳐 도달했으므로, **여기서는 그 최종 상태를 한 번에 적용한다.**

## 1단계 — 매니저 채번 분기 (`src/soil/soil-script.js:996-998`)

```js
const isFill = src.subCategory === '성토';
let receptionNumber = (src.receptionNumber != null && String(src.receptionNumber).trim() !== '')
    ? String(src.receptionNumber).trim()
    : (isFill
        ? this.generateNextFillReceptionNumber(landClass1)
        : String(this.getNextNumberForClass(this.selectedYear, landClass1)));
```

⚠️ soil은 `let receptionNumber`다(메인은 `const`) — 아래쪽에서 재대입하는 코드가 있는지 확인하고 `let`을 유지한다.

## 2단계 — 순수 함수 3종 (`src/soil/soil-result-importer.js`)

모듈 레벨에 추가한다. 기존 `computeAutoMapping`이 이미 같은 패턴이라 새 구조가 아니다.

| 함수 | 역할 |
| --- | --- |
| `collectExistingNumbers(logs, landClass1, {fill})` | **자동채번** 풀. `reception-number.js`의 `computeNextNumber`와 분류 규칙이 한 줄씩 같아야 한다 (성토/일반 상호 배제 · 경지구분 범위 · 본번 접기 · 일반 풀 F 제외 · 성토 풀 F 제거 · 기본 경지구분 폴백) |
| `collectLiteralNumbers(logs, landClass1)` | **수동 번호 중복 판정** 풀. 표기 그대로, 두 시퀀스 통합. 폼 경로의 `logBaseNumber === numToCheck`와 같은 규칙 |
| `computePreview({logs, rows, mapping, ...})` | 행별 번호 결정. `logs`에서 세 풀을 **내부 도출**해 호출부가 하나를 빠뜨릴 수 없게 한다 |

`computePreview`의 핵심 규칙:
- 행별 `isFill = rec.subCategory === '성토'` → 성토는 `F{n}`, 일반은 `{n}`
- 커서(`nextNum`/`nextFill`)와 배치 집합을 **시퀀스별로 독립**. 일반 `5`와 성토 `F5`는 충돌이 아니다
- 커서는 `autoAll` 여부와 무관하게 **항상 초기화** — 접수번호 칸만 빈 행도 자동부여로 넘어가므로, 조건부 초기화는 `String(null)` → `'null'`을 만든다
- 수동 번호 중복은 `existingLiteral`/`seenLiteralInBatch`로 **표기 기준·시퀀스 무관**
- 자동부여 번호도 표기 집합에 넣어 뒤따르는 수동 행이 충돌을 감지
- 저장될 수동 번호만큼 해당 시퀀스 커서를 올린다(`willBeSaved` 게이트)
- **저장되지 않는 행은 배치 집합에도 넣지 않는다**(`if (willBeSaved) seenPool.add(key)`) — 넣으면 다음 자동부여 미리보기가 실제보다 앞서 나간다

## 3단계 — 모달을 위임하게 (`soil-result-importer.js`)
- `_existingLogs()` 추가 (매니저 `sampleLogs` 또는 localStorage `soilSampleLogs_{year}` 폴백)
- `_existingNumbers()`는 **두지 않는다** — 풀을 하나씩 넘기는 진입점이 메인 회귀의 원인이었다
- `_recompute()`는 `logs` + `nextNumber` + `nextFillNumber`만 모아 `computePreview`에 넘긴다
- `_fns`에 `collectExistingNumbers`, `collectLiteralNumbers`, `computePreview` 노출

## 4단계 — 단위 테스트 신규 (`tests/unit/soil-result-importer.test.js`)

이 프로젝트에는 importer 단위 테스트가 없다. 메인의 38건(채번 관련)을 이식한다.

| 그룹 | 케이스 |
| --- | --- |
| `collectExistingNumbers` 일반/성토 | 경지구분 범위 · 본번 접기 · 두 시퀀스 상호 배제 · F 제거 · 기본값 폴백 |
| `collectLiteralNumbers` | 표기 보존 · 시퀀스 통합 · 본번 접기 · 폴백 |
| 성토 채번 | 성토 3행 → `F1,F2,F3` / 혼재 → 각자 시퀀스 / 기존 성토 건너뛰기 / 일반5·성토F5 비충돌 / 성토 수동번호 커서 |
| 시퀀스 교차 중복 | 성토 수동 `1` vs 기존 일반 `1` → dup / 배치 내부 교차 / 기존 F5 + 수동 F5 → dup / F5 vs 5 → new |
| 커서·집계 | 수동 번호 커서 상향 / 건너뛴 행은 커서·집계 미반영 / `'null'` 회귀 / stats·willImport |

## 5단계 — E2E 신규 (`tests/e2e/soil-importer-fill.spec.js`)

**메모리 배열만 보면 이 결함을 못 잡는다.** 메인과 같은 단정 방식을 쓴다:
- `readPersisted()` — `page.reload()` → `localStorage` 파싱
- `expectUniqueReceptionNumbers()` — 빈값·`'null'`·중복 단정
- 정확 일치 단정 (`toEqual(['F1','F2','F3'])`)
- 기존 레코드 시드 케이스 + 수동 번호 경로 케이스

⚠️ soil의 E2E 설정(baseURL·webServer·storage 키)을 먼저 확인하고 맞춘다.

## 6단계 — 검증 (통과 조건)

| 검증 | 기대 |
| --- | --- |
| 3개 시나리오 미리보기 = 실제 저장 | 일치, 중복 0 |
| 시퀀스 교차 중복 | dup (회귀 방지) |
| 단위 / E2E | 신규 포함 전원 통과, 기존 회귀 0 |
| **변이 검증** | 매니저 성토 분기 제거 → 실패 / 미리보기 성토 분기 제거 → 실패 / 표기 기반 중복을 시퀀스 분리로 되돌림 → 실패 |
| `npm run lint` | 통과 |
| `npm run build` | 성공 |

## 7단계 — 반영
soil 프로젝트의 브랜치 보호 설정을 먼저 확인하고, 보호돼 있으면 브랜치 → PR → CI → 머지. 아니면 직접 푸시.

## 하지 않을 것
- 모달 UI/스타일 변경 (soil은 CSS/HTML을 상수·함수로 뺀 상태 — 그 구조를 유지한다)
- 서브넘버 행 중복 판정 문제 (메인 SAMPL-1-154 상당) — 별 티켓
- overwrite가 실제로 덮어쓰지 않는 문제 (메인 SAMPL-2-30 상당) — 별 티켓
- 자동채번이 표기 집합을 보지 않는 문제 — 미리보기만 고치면 매니저와 어긋난다. 입력 검증이 필요하므로 별 티켓
