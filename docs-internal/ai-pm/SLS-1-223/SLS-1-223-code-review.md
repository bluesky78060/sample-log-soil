# SLS-1-223 코드 리뷰 — 재리뷰 2 (3중 검증)

**대상**: `88c2073` · `653cdc3` · `cdf3f25` (구현 + 리뷰 1 + 재리뷰 1) 및 본 리뷰의 수정
**일자**: 2026-08-20
**판정**: **APPROVED** — CRITICAL 0 / MAJOR 2(수정) / MINOR 3(수정) / SUGGESTION 2(기록)

> 리뷰를 2라운드 돌렸다. **1라운드가 찾은 MAJOR를 고친 수정 자체에서 2라운드가 또
> MAJOR를 찾았다** — 결함을 찾은 쪽과 고친 쪽이 다르면 수정본은 아무도 안 본 코드가
> 된다. 아래 M-2가 그것이다.

---

## 검증 레인

| # | 레인 | 수행 |
| --- | --- | --- |
| 1 | 독립 diff 리뷰 (다른 계열 모델) | **Codex CLI** — 소스 diff 1,047줄 + 저장소 직접 열람 |
| 2 | 지적 재현 검증 | 인용 코드·시나리오를 저장소에서 **직접 확인**, `node`로 재현 |
| 3 | 적대적 검증 (변이 테스트) | 각 수정을 되돌려 해당 테스트가 **실제로 죽는지** 확인 |
| 4 | **수정본 재리뷰** | 1라운드 수정 diff를 Codex에 다시 넘겨 검증 → **M-2 발견** |

> ⚠️ CLAUDE.md는 Codex CLI를 "vendor 바이너리 누락(ENOENT)으로 실행 불가"로 기록하고 있으나,
> 2026-08-20 확인 결과 **정상 동작한다**. Gemini CLI 쪽이 오히려 `GOOGLE_CLOUD_PROJECT`
> 미설정으로 막혀 있었다. 이 문서의 레인 1은 Codex로 수행했다. CLAUDE.md 갱신 필요.

## 레인 2 — Codex 지적의 실재 여부

Codex 지적 5건을 액면가로 받지 않고 전부 직접 확인했다. **3건 실재, 2건 무해 판정.**

| # | 지적 | 검증 방법 | 결과 |
| --- | --- | --- | --- |
| 1 | 그룹 편집에서 새 위반 누출 (MAJOR) | 코드 경로 추적 | ✅ **실재** |
| 2 | 거대 접수번호 → `Infinity` 오염 | `node`로 재현 | ✅ **실재** |
| 5 | 전수성 테스트가 죽은 단언 | `grep`으로 실물 확인 | ✅ **실재** (파일명은 오인) |
| 3 | `F0` 미탐지 | 채번 경로 분석 | ⚠️ 실재하나 **무해** |
| 4 | `addImportedRecord` 자체 미방어 | 호출부 전수 확인 | ⚠️ **타 티켓 범위** |

지적 #5는 Codex가 `reception-number.test.js`라고 했으나 실제 위치는
`soil-result-importer.test.js:56`이었다. 인용한 코드 자체는 정확했다.

---

## 🔴 MAJOR — 수정함

### M-1. 그룹 편집에서 위반 건수가 늘어도 통과 (`soil-script.js:2172`)

`_checkReceptionNamespace`의 "악화 없음" 예외가 `wasOffending`을 **구분(subCategory)의
`Set`**으로 비교했다. 그룹 편집으로 필지를 늘리면 위반 레코드가 1건 → 2건으로 늘어도
구분은 여전히 `'성토'` 하나뿐이라 `every(c => wasOffending.has(c))`가 참이 되어 저장을
허용했다.

**바로 위 주석이 "위반을 새로 만들거나 늘렸을 때만 막는다"라고 쓰여 있는데 늘어난 것을
못 봤다** — 주석과 코드가 어긋난 채로 두 번의 리뷰를 통과했다.

재현:

```text
기존 그룹: '3' / 구분=성토   ← 위반 1건
그룹 편집에서 필지를 2개로 늘리고 둘 다 성토, 접수번호 '3' 유지
→ offendingCats = ['성토'] (Set), wasOffending = {'성토'} → 통과
결과: '3'/성토, '4'/성토  ← 위반 2건
```

**수정**: 구분의 종류가 아니라 **건수**를 비교한다.

```js
const offendingCats = cats.filter(c => RN.namespaceViolation(base, c === '성토'));  // Set 제거
…
const wasOffendingCount = beforeLogs.filter(…).length;
if (offendingCats.length <= wasOffendingCount) return true;   // 악화 없음
```

정당한 수정(전화번호 오타 등)을 막지 않는다는 원래 정책은 그대로 유지된다 —
건수가 같거나 줄면 통과한다.

**회귀 테스트**: `tests/e2e/soil-reception-namespace.spec.js`
「그룹 편집으로 위반 건수가 늘면 구분이 같아도 막는다」 — 필지 1개는 `true`,
2개는 `false`를 단정한다.

### M-2. 위반 **필지** 수를 대장의 **레코드** 수와 비교 (`soil-script.js:2177`)

M-1의 수정 자체가 남긴 결함이다. 2라운드 리뷰가 찾았다.

`offendingParcels`는 **필지** 목록인데 비교 대상 `wasOffendingCount`는 대장의
**레코드** 수다. `_buildLogsForParcels`는 한 필지의 유효 작물이 2개 이상이면
`useSubNumbers` 분기를 타 **작물마다 레코드를 만든다** — 필지 1개가 레코드 2건이
되므로 두 값의 단위가 다르다.

재현:

```text
기존: 위반 필지 1개 × 작물 2개 → 레코드 '3', '3-1'  = 위반 2건
수정: 위반 필지 2개 × 작물 2개 →                      = 위반 4건
비교: offendingParcels.length(2) <= wasOffendingCount(2) → 통과
결과: 위반이 2건 → 4건으로 늘었는데 저장된다
```

M-1을 고치면서 "건수를 세야 한다"고 써 놓고 정작 **다른 단위를 셌다.** 필지 수는
Set보다 나을 뿐 정답이 아니었다.

**수정**: 필지가 만들 레코드 수를 계산해 더한다.

```js
const recordsOf = (p) => Math.max(1, ((p && p.crops) || []).filter(c => (c.name || '').trim()).length);
const offendingRecordCount = isSingleEdit
    ? offendingParcels.length                                  // 단건 수정은 분할하지 않는다
    : offendingParcels.reduce((n, p) => n + recordsOf(p), 0);
```

단건 수정(`_submitSingleEdit`)은 `_buildLogsForParcels`를 거치지 않아 작물이 몇 개든
레코드가 하나이므로 분기했다.

**회귀 테스트**: 「작물 분할까지 세어 위반 레코드 증가를 막는다」 — 작물 2개짜리
위반 필지가 1개(레코드 2건)일 때는 `true`, 2개(레코드 4건)면 `false`.

---

## 🟡 MINOR — 수정함

### m-1. 안전 정수 범위 밖 접수번호가 채번을 `Infinity`로 오염 (`reception-number.js:77`)

`parseInt`는 400자리 숫자에 `NaN`이 아니라 **`Infinity`**를 돌려준다. 기존 가드가
`!isNaN(num)`뿐이라 `maxNumber`가 `Infinity`가 되고, 다음 접수번호가
`'Infinity'` · `'FInfinity'`로 저장된다. 그 레코드가 대장에 남으므로 **이후 채번이
계속 오염된다** — 한 번 들어오면 스스로 회복되지 않는다.

`node`로 재현 확인:

```text
parseInt('1' + '0'.repeat(400)) = Infinity   (isNaN false, > 0 true)
→ 다음 접수번호 'Infinity' / 성토는 'FInfinity'
```

**수정**: `Number.isSafeInteger(num)`로 거른다 (`isNaN` 검사를 흡수한다).
2^53 경계 위쪽의 정밀도 손실도 함께 막힌다.

### m-2. 채번이 거르는 값이 점검 화면에는 안 보임 (`reception-number.js:136`)

m-1을 고치면 채번은 거대 표기를 무시하는데, `auditReceptionNumbers`의 `malformed`
판정은 `Number.isNaN`만 봐서 **정상으로 통과시켰다**. 한쪽만 거르면 사용자는 설정
화면에서 아무 이상을 못 보는데 채번만 조용히 달라진다 — 이 티켓이 없애려던
"조용한 불일치"가 형태만 바꿔 남는다.

**수정**: `malformed`에 `'접수번호가 다룰 수 있는 범위를 벗어남'` 사유를 추가해
채번과 점검의 판정 기준을 맞췄다.

### m-3. 전수성 단언이 죽어 있었음 (`soil-result-importer.test.js:56`)

```js
expect([...normal].some(n => fill.has(n) && false)).toBe(false)
```

`&& false` 때문에 `some`이 **항상** `false`를 돌려준다. 어떤 구현을 넣어도 죽지 않는
단언이었고, 주석이 약속한 "정확히 한 풀" 검증을 전혀 수행하지 않았다. 앞줄의
`normal.size + fill.size === inScope.length`도 `Set`이라 같은 번호가 여러 레코드에
있으면 뭉개진다.

**수정**: 레코드를 **한 건씩** 넣어 분류 합계가 항상 정확히 1인지 센다. `Set` 뭉개짐이
구조적으로 사라진다.

---

## 🔵 SUGGESTION — 수정하지 않음 (근거 기록)

### s-1. `F0`이 `malformed`로 잡히지 않는다

`'F0'` → `parseInt('0')` = 0 → 유효 번호로 처리된다. 확인 결과 **무해하다**:

- 자동채번은 `maxNumber + 1`이므로 최소 1부터 시작한다 → `0`과 충돌하지 않는다
- `computeNextNumber`의 `num > maxNumber`에서 `0 > 0`은 거짓이라 채번에 영향이 없다
- 네임스페이스(`F` 접두)는 올바르므로 불변식 위반도 아니다

0번 접수번호를 금지하는 업무 규칙이 확인되면 그때 `malformed`에 넣는다. 지금은
근거 없이 사용자 데이터를 "이상"으로 표시하는 쪽이 해롭다.

### s-2. `addImportedRecord`가 자체 방어를 하지 않는다

호출부를 전수 확인한 결과 **UI에서 도달 가능한 경로는 모두 차단되어 있다**:

- 가져오기 모달 → `computePreview`가 위반 행을 `err`로 반려
- 레거시 `ExcelImportManager` 경로 → `skipRowCheck`에 불변식 검사 추가됨 (이번 티켓)
- 폼 등록·수정 → `_checkReceptionNamespace`

남는 것은 콘솔에서 매니저 API를 직접 부르는 경우뿐이다. 심층방어로서 가치는 있으나
**SLS-1-224**(휴면 레거시 경로 제거)가 이 메서드 주변을 정리하는 티켓이므로 거기서
함께 다루는 편이 낫다. 지금 넣으면 같은 검사가 세 겹이 된다.

---

## 레인 3 — 적대적 검증 (변이 테스트)

각 수정을 되돌려 **해당 테스트가 실제로 죽는지** 확인했다. 죽지 않으면 그 테스트는
아무것도 지키지 못한다.

| 변이 | 되돌린 내용 | 결과 |
| --- | --- | --- |
| 1 | `Number.isSafeInteger(num)` → `!isNaN(num)` | ✅ 「안전 정수 범위를 넘는 본번은 무시한다」 **1건 FAIL** |
| 2 | `audit`의 범위초과 분기 제거 | ✅ 「범위를 넘는 접수번호도 malformed로 드러난다」 **1건 FAIL** |
| 3 | `collectExistingNumbers`를 구 규칙(`subCategory`)으로 | ✅ **19건 FAIL** (전수성 포함) |
| 4 | `offendingRecordCount`를 필지 수로 (M-2 이전 상태) | ✅ 「작물 분할까지 세어…」 **1건 FAIL** |

변이 3이 19건을 죽인 것은 이 티켓의 핵심(표기 기준 통일)이 여러 각도에서
검증되고 있다는 뜻이다. 변이 1·2·4가 **정확히 1건씩만** 죽인 것은 각 회귀
테스트가 자기 결함만 정조준한다는 뜻이다.

---

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| 빌드 (`npm run build`) | ✅ 성공, `docs/` 산출물 동기화 |
| 단위 (`npm run test:unit`) | ✅ **863 passed** (56 files) — 수정 전 861에서 2건 추가 |
| E2E (`npx playwright test`) | ✅ **441 passed** — 수정 전 439에서 2건 추가 (M-1·M-2 회귀) |
| Lint (`npm run lint`) | ✅ **오류 0** / 경고 6 (기존 기준선, 이번 변경이 추가한 것 없음) |
| 변이 검증 | ✅ 3/3 — 되돌리면 전부 죽는다 |

## 남은 것 (이 티켓 범위 밖)

- **손상 데이터 실제 조회** — 코드는 설정 화면 「접수번호 정합성 점검」으로 탐지 수단을
  제공한다. 실제 대장에 위반이 있는지는 **사용자가 각 센터에서 실행해 확인**해야 한다.
  재번호는 접수번호가 이미 라벨·흙토람 업로드로 나갔을 수 있어 자동화하지 않는다(계획대로).
- **메인 프로젝트 이식** — `SAMPL-2-30` · `SAMPL-1-155`. 본 리뷰에서 새로 찾은
  M-1(건수 비교)과 m-1(`Infinity`)도 함께 반영할 것.
- **SLS-1-224** — 휴면 레거시 `ExcelImportManager` 경로 제거. s-2를 여기서 다룬다.
