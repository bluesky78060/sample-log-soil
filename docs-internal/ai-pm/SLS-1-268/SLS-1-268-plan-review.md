# SLS-1-268 플랜 리뷰

- 리뷰어: **codex (codex-cli 0.147.0, provider openai)** — 독립 레인
- 일시: 2026-08-21
- 대상: `SLS-1-268-direction.md`, `SLS-1-268-plan.md` + 실제 소스 대조
- 판정: **APPROVED (조건부 — 지적 전건 반영 완료)**

## 심각도 집계

| 심각도 | 건수 | 반영 |
| --- | --- | --- |
| CRITICAL | 0 | — |
| MAJOR | 2 | 전건 반영 |
| MINOR | 4 | 전건 반영 |
| SUGGESTION | 1 | 수용 (후속 티켓으로 명시) |

## MAJOR

### M-1. 저장 연도를 `selectedYear`로 읽어야 한다

플랜이 `compostSampleLogs_{year}`를 검증한다고만 적었다. 현재 연도를 하드코딩하면
**연말·연초에 조용히 빈 배열을 읽고 통과**할 수 있다.

근거 — `BaseSampleManager.js:101`에서 init이 `findYearWithData()`로 `selectedYear`를 덮는다.
생성자의 현재 연도(`:31`)가 최종값이 아니다.

→ 반영: 플랜 §플랜 리뷰 반영 (1). `window.compostManager.selectedYear`를 읽어 키를 만든다.

### M-2. `hasReceptionNumbers`는 `.some()`이라 혼합 입력을 놓친다

```js
// excel-import-manager.js:370  (직접 확인함)
const hasReceptionNumbers = this._parsedLogs.some(l => l.receptionNumber !== '');
if (hasReceptionNumbers) return;
```

**한 행만 번호가 있어도 배치 전체가 자동 채번을 건너뛴다.** 나머지 행은 빈 접수번호로
저장된다. 플랜의 케이스 6(전 행에 번호 있음)은 이 분기를 통과시키지 못한다.

→ 반영: **케이스 8 신설.** 단, 이 티켓은 **고치지 않는다** — 범위가 검증 추가다
(Discovery §3). 현재 동작을 그대로 고정해 두고 **별도 결함 티켓으로 올린다.**

## MINOR

| # | 지적 | 반영 |
| --- | --- | --- |
| m-1 | 줄 번호 7곳 오차 (`:139→:138`, `:195→:196`, `:228→:231`, `:175-178→:176-179`, `onImportComplete :2394`, `saveLogs :2402`) | 플랜 전부 정정 |
| m-2 | 케이스 7의 사전 조건 누락 — `#downloadTemplateBtn`은 모달 step1 **안**이라 초기 접근 불가 | 공통 헬퍼로 모달을 먼저 여는 것으로 명시 |
| m-3 | 케이스 2가 `.mapping-row` 개수만 세면 **자동매핑이 전부 비어도 통과** | `select` 선택값 정확 일치로 구체화 |
| m-4 | 변이 (b)는 조건부로만 유효 — 번호 없는 행 2건 이상 + 기존 데이터 없음이 전제 | 픽스처 3행 고정, `localStorage.clear()`, 기대값 `['1','2','3']` |

> m-1은 호출 **시점** 자체는 맞다는 확인이 함께 왔다(`_autoAssignReceptionNumbers` 호출
> `:359`, 정의 `:369`). 흐름 이해는 옳고 좌표만 틀렸다.

## SUGGESTION

**s-1. 경계조건 5가지가 빠져 있다** — 헤더만 있는 파일(`jsonData.length < 2`),
빈 데이터 행만(`_excelData.length === 0`), 매핑 실패 시 step2 차단, `skipRowCheck` 전건 탈락,
5000행 절단.

→ 수용하되 **이번 범위 밖으로 명시**했다. 7~8건을 제대로 하는 것이 5건을 얕게 더 붙이는
것보다 낫고, `skipRowCheck`는 행 수와 저장 수가 달라지는 별도 축이라 섞으면 각각이 흐려진다.
후속 티켓으로 올린다.

## 리뷰어가 확인해 준 것 (반증 실패 = 플랜이 옳음)

- **변이 (a) 유효** — `setupExcelImport()` 호출은 `compost-script.js:2406`. 제거하면 파일 input
  이벤트가 등록되지 않아 케이스 1부터 죽는다. 단 케이스 7도 같은 헬퍼로 모달을 열어야 한다는
  전제가 붙는다(m-2와 동일 지점).
- **Playwright 수집 정상** — `testDir: './tests/e2e'`, `testIgnore`는 `manual-capture.spec.js`
  하나뿐. 신규 스펙이 제외 패턴에 걸리지 않는다.
- **배선 흐름 자체는 실제 코드와 일치**.

## 결론

CRITICAL 0건. 지적 전건을 플랜에 반영했으므로 **구현 진행 가능**.
M-2에서 파생된 잠재 결함(혼합 접수번호 → 빈 번호 저장)은 **별도 티켓**으로 분리한다.
