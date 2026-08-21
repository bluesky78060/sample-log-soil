# SLS-1-270 플랜 리뷰

- 리뷰어: **codex (codex-cli 0.147.0, provider openai)** — 독립 레인
- 일시: 2026-08-21
- 판정: **APPROVED (지적 전건 반영 후)**

## 집계

| 심각도 | 건수 | 반영 |
| --- | --- | --- |
| CRITICAL | 0 | — |
| MAJOR | 2 | 전건 |
| MINOR | 3 | 전건 |
| SUGGESTION | 1 | 수용 |

## MAJOR

### M-1. `filterFn`으로 제외된 번호와 충돌 가능

초안은 **기존 로그에만** `filterFn`을 적용하고 배치 명시 번호에는 적용하지 않았다.
판정 기준이 어긋나 최대값이 잘못 나온다.

→ 배치 행에도 같은 `inScope()`를 적용해 기준을 하나로 만들었다.

> 다만 "다른 네임스페이스 번호와 겹치는 것"은 결함이 아니라 **설계다.**
> `autoNumberFilter`는 성토(`F1`)/일반(`1`)처럼 별도 시퀀스를 두기 위한 훅이다.
> 같은 네임스페이스 안에서 충돌하지 않으면 된다.

### M-2. `MAX_SAFE_INTEGER` 경계

`next += 1`이 경계를 넘으면 `String()` 결과가 실제 값과 달라진다.

→ 안전 범위를 벗어나면 **채번을 멈추고 경고를 남긴다.** 조용히 자르지 않는다.
   `_autoAssignReceptionNumbers(warnings)`로 경고 배열을 받아 미리보기에 표시한다.

## MINOR

| # | 지적 | 반영 |
| --- | --- | --- |
| m-1 | `extractFn`이 숫자 **문자열**을 반환하면 `!isNaN('5')`는 참인데 `Number.isSafeInteger('5')`는 거짓 → 호환 깨짐 | 숫자가 아니면 `parseInt`로 강제한 뒤 판정 |
| m-2 | `trim()` 도입이 기존 데이터에 주는 영향이 불명확 | 파싱 행의 `'   '`는 빈 칸으로 채운다(의도), 저장 로그의 `'   '`는 전과 같이 `parseInt`→`NaN`으로 무시됨을 명시 |
| m-3 | 입력 방어와 출력 방어가 분리되지 않음 | 입력은 `Number.isSafeInteger`, 출력은 M-2의 경계 검사로 분리 |

## SUGGESTION

**s-1. 정렬 역전 문구가 과장됐다.** 초안은 "정렬 역전도 함께 사라진다"고 썼으나
**새로 만들지 않을 뿐 과거에 저장된 빈 번호에는 그대로 남는다.** 문구를 정정하고
별도 후속 티켓으로 넘기기로 했다.

## 리뷰어가 지적한 미커버 경계조건 → 유닛 테스트로 해소

`autoNumberExtract` / `autoNumberFilter`는 **현재 어떤 소비자도 설정하지 않아**
compost 경유 E2E로는 도달할 수 없다. `tests/unit/excel-import-numbering.test.js`를
신설해 10건으로 덮었다 — 전부 빈 칸 / 전부 채움 / 혼합 / 배치 명시 번호가 기존 최대보다
큰 경우 / `'   '` / 400자리(Infinity) / `extractFn` 문자열 반환 / `filterFn` 네임스페이스 분리 /
`MAX_SAFE_INTEGER` 경계 경고 / 기존 로그 없음.

## 결론

CRITICAL 0. MAJOR 2건은 모두 **구현 전에** 설계를 바꿔야 하는 지적이었고 반영했다.
진행 가능.
