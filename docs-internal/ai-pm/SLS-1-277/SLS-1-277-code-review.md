# SLS-1-277 코드 리뷰 — '전체 경지구분' 탭에서 경지구분 열 복원

> 정본. 훅 통과용 사본은 `docs/03-code-review/`.

## 변경

| 파일 | 내용 |
| --- | --- |
| `src/soil/soil-script.js` | `_syncTableModeClasses()` 도입 — `gongik-on`·`allclass-on`을 한 자리에서. 두 곳에 복사돼 있던 토글 제거 |
| `src/soil/soil-style.css` | `.allclass-on` 복원 규칙 + `col-name` 바닥값(435px), SLS-1-261 주석 정정 |
| `tests/e2e/soil-list-landclass-hidden.spec.js` | 시험 2건 추가 |

## 왜 예외가 필요했나

SLS-1-261의 감춤 근거는 "탭이 이미 현재 구분을 보여 준다"였고, 주석은 그 전제를
**"탭에 '전체'가 없고 landClass1이 절대 비지 않는다"** 로 적었다.

**사실이 아니었다.** `populateLandClass1Options()`가 `value=''`인 '전체 경지구분'
옵션을 실제로 만든다. 그 탭에서는 12개 구분의 행이 섞이는데 탭 표시값은
"전체 경지구분"뿐이고, 채번이 경지구분 단위로 독립이라(`reception-number.js`)
**같은 접수번호가 여러 줄로 보인다.** 그 이유를 설명하는 열이 감춰져 있었다.

자매 저장소(메인 `sample-log-electron`)에서 같은 감춤을 넣던 SAMPL-1-173의
독립 리뷰가 MAJOR로 잡았고, 확인해 보니 soil에도 같은 구멍이 있었다.

## 독립 리뷰 (codex)

```text
🔴 CRITICAL: 0건 / 🟠 MAJOR: 0건 / 🟡 MINOR: 0건 / 🔵 SUGGESTION: 1건
```

확인해 준 것:

- **호출 지점이 충분하다.** 탭 전환·검색·연도 변경·데이터 변경·0건 결과가 모두
  `filterAndRenderLogs()` → `renderLogs()`를 지나고, 페이지 이동은 `renderCurrentPage()`를
  지난다. **0건 조기 반환 전에도** 클래스가 동기화된다.
- **명시도 조합이 옳다.** `allclass-on`(일반) 435px, 공익직불제는 더 높은 명시도의 429px가
  유지된다. `allclass-on`과 `gongik-on`은 필터 값상 **동시에 성립하지 않는다**.
- **sticky와 충돌하지 않는다.** `sticky-columns.js`가 실제 위치를 다시 계산하고,
  클래스 변경은 MutationObserver와 명시적 `scheduleStickyColumns()` 양쪽이 잡는다.

**SUGGESTION 반영**: 새 시험이 머리글만 보고 데이터 셀·0건 경로를 보지 않는다는 지적 →
`visibility()`로 `th`·`td` 양쪽을 단정하고, 0건 경로 시험을 따로 추가했다.

## 선례 검증 (메인 SAMPL-1-173)

같은 패턴을 메인에서 먼저 넣었고 그쪽은 code-reviewer(Opus) **2라운드** + codex +
변이 검증을 거쳤다. 그때 실측으로 확인된 것들이 여기에도 그대로 적용된다:

- 두 호출 지점이 **모두** 필요하다(0건 경로는 `renderLogs` 쪽만 담당)
- `!important`를 쓰지 않는다 — (0,3,1)이 (0,2,1)을 명시도로 이미 이긴다
- `col-name` 바닥값을 빠뜨리면 두 고정 열이 70px 포갠다

## 범위에서 뺀 것

'전체 보기 토글 시 colSpan 갱신'은 **SLS-1-280이 이미 해결했다** — 그쪽은 '토글에서
갱신'이 아니라 '머리글 칸 수(숨김 포함 22)를 쓰는 넉넉한 쪽'을 골랐다. 남는 colspan은
브라우저가 잘라내므로 더 견고하다. 메인이 택한 '토글마다 갱신'보다 나은 설계다.

## 변이 검증

| 변이 | 결과 |
| --- | --- |
| `.allclass-on` 복원 규칙 제거 | 새 시험만 **FAIL** ✅ (기존 3건은 통과 — 감춤 자체는 그대로) |

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run build` | ✅ |
| `npm run lint` | ✅ 0 errors (warnings 6, 기존) |
| `npx vitest run` | ✅ 925 passed (60 files) |
| `npx playwright test` | ✅ 488 passed |

## 판정

```text
🔴 CRITICAL: 0건 / 🟠 MAJOR: 0건 / 🟡 MINOR: 0건 / 🔵 SUGGESTION: 0건(1건 반영)
→ 판정: APPROVED
```
