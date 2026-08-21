# SLS-1-197 코드 리뷰

- 리뷰어: **codex (codex-cli 0.147.0)** — 독립 레인 · 적대적 검증 **변이 4건**
- 일시: 2026-08-21 · 판정: **APPROVED (MINOR 반영 후)**

## 집계

CRITICAL 0 / MAJOR 0 / **MINOR 3**

## MINOR

**m-1. Electron에서 `typeof` 폴백이 팝업과 동등하지 않다.**
메서드가 없으면 웹 경로로 가는데, 메인의 `setWindowOpenHandler`가 로컬 상대경로 새 창을
막으므로 **현재 창이 이동**할 가능성이 크다.
→ 가드의 목적은 "죽지 않게"이지 동등 대체가 아님을 **코드 주석에 명시**했다.
   구버전 Electron 완전 지원은 메인 프로세스 변경이 필요해 범위 밖으로 남긴다.

**m-2. soil 배지 E2E가 UI 배선을 안 밟는다.** `page.evaluate`로 필터를 직접 세팅해
**배지 계산**만 덮고, select의 change 배선이 끊긴 회귀는 못 잡는다.
→ 화면에서 `#purposeFilter`를 실제로 선택하는 케이스를 1건 추가했다 (6건이 됨).

**m-3. `--max-warnings 6`은 자동으로 낮아지지 않는다.** 기존 경고 하나가 사라져도
상한이 6이라 새 경고가 그 자리를 채울 수 있다.
→ **인지하고 현 방식을 유지한다.** 대안(6곳에 인라인 `eslint-disable` + `--max-warnings 0`)은
   더 강하지만 그 6개를 **영구히 침묵**시킨다. 이 티켓의 원래 걱정은 "경고가 굳어
   5번째를 놓치는 것"이었고, 개수 고정은 **경고를 계속 보이게 두면서** 7번째를 막는다.
   숫자를 함께 낮추라는 규칙은 `eslint.config.mjs` 주석에 남겼다.

## 리뷰어가 확인해 준 것

- soil `extractReceptionNumber` 삭제 **안전** — 호출부가 base 구현을 상속하고,
  base가 오히려 `undefined`/`null`을 안전하게 처리한다
- `_extractLabelAddress(log)` 시그니처가 base의 `getLabelAddressParts(log)` 훅과 정확히 맞고,
  중복 제거·quota 처리·이동 로직이 기존과 동등하다
- `getFilterKeys()`가 base 5개 키에 `lot`·`purpose`를 더해 **빠진 키가 없다**.
  `completed` 별도 판정도 base에 유지된다
- `landClass1`을 필터 키에서 뺀 것이 의도와 구현이 일치하고 탭 배지도 유지된다
- compost 검색 모달 E2E는 실제 모달·입력·적용·행 수를 밟는다

## 적대적 검증 — 변이 4건

| 변이 | 결과 |
| --- | --- |
| (h) `getFilterKeys`에서 `lot`·`purpose` 제거 | 배지 테스트 **1건 실패** |
| (i) `landClass1Tab` 배지 제거 | **1건 실패** |
| (j) `landClass1`을 필터 키에 추가 | **2건 실패** |
| (k) 검색 모달 `applySearchBtn` 배선 제거 | compost 모달 테스트 **2건 실패** |

### ⚠️ (h)(i)는 처음엔 살아남았다

배지 테스트를 만들기 **전에** 돌렸을 때 **445건이 전부 통과**했다.
즉 리팩터 대상이 **무검증 상태**였다 — 잘못 정리해도 아무도 몰랐을 것이다.
그래서 `soil-search-badges.spec.js`를 먼저 만들고 변이를 다시 걸었다.

### ⚠️ (k)의 첫 시도는 무효였다

`const applySearchBtn = //MUT_K document.getElementById(...)` 형태로 넣어 **문법 오류**가
됐고, 빌드가 실패해 테스트가 **이전 번들**을 상대로 돌아 통과했다.
`if (false)`로 바꿔 문법을 유효하게 만든 뒤에야 2건이 죽었다.
**변이가 빌드를 깨면 그 실행 결과는 증거가 아니다.**

## 처리 내역

| 항목 | 결과 |
| --- | --- |
| A-1 `extractReceptionNumber` | 삭제 (널 가드 빠진 열화 사본) |
| A-2 `openLabelPrintWithData` | `getLabelAddressParts` 훅으로 대체 |
| A-3 `updateSearchButtonState` | `getFilterKeys` + 슬림 오버라이드(배지 2종 보존) |
| B `test:e2e` | `npm run build && npx playwright test` 추가 |
| C 검색 모달 E2E | `compost-search-modal.spec.js` 2건 |
| D eslint 예외 | `--max-warnings 6`으로 개수 고정 + 근거 주석 |
| E `typeof` 가드 | 적용 + 한계 주석 |
| **해소 확인 7건** | 194 m-2 / 196 MINOR-C·MINOR-8·SUGGESTION-1·SUGGESTION-3 / 194 s-2 / cache-manager |

## 검증

build ✓ / E2E **451 passed** (443→451) / unit 878 passed / lint 0 errors·6 warnings(상한 6)
