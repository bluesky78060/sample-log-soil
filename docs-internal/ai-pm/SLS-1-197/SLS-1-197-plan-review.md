# SLS-1-197 플랜 리뷰

- 리뷰어: **codex (codex-cli 0.147.0)** — 독립 레인
- 일시: 2026-08-21 · 판정: **APPROVED (MAJOR 반영 후)**

## MAJOR-1 — A-3에서 `landClass1Tab` 배지 보존이 빠졌다

> "A-3에 `landClass1Tab` 배지를 보존하는 수정이 반영되기 전에는 플랜을 승인하지 않겠습니다."

정확한 지적이다. 초안은 soil의 `updateSearchButtonState` 앞부분만 보고 배지가
`purposeFilter` 하나인 줄 알았다. 실제로는 **`landClass1Tab` 배지가 하나 더** 있다.
그대로 진행했으면 경지구분 배지가 조용히 사라졌을 것이다.

→ 슬림 오버라이드가 배지 **두 개**를 모두 다루도록 고쳤다.

### 함께 확인한 것 — `landClass1`은 필터 키에 넣으면 안 된다

`currentSearchFilter.landClass1`의 **기본값이 `'농가의뢰'`**(truthy)다.
`getFilterKeys()`에 넣으면 검색 버튼이 **늘 "검색 중"**으로 보인다.
원본 코드도 `hasFilter` 계산에서 의도적으로 빼고 있었다. 그대로 보존했다.

## 리뷰어가 확인해 준 것

- Discovery의 "이미 해소됨" 판정이 타당하다
- A-1(널 가드 빠진 열화 사본), A-2(`getLabelAddressParts` 훅), E(typeof 가드) 방향이 옳다
- E의 가드는 **실질적이다** — 메서드 부재 시 현재는 `TypeError`로 버튼이 죽는다
  (단 IPC reject까지 폴백하려면 별도 처리가 필요하며 이번 범위 밖이다)
- C의 실제 셀렉터를 짚어 줬다: `[data-view="list"]` → `#openSearchModalBtn` →
  `#listSearchModal` → `#searchNameInput` → `#applySearchBtn` → `#logTableBody > tr`
  그리고 **`page.evaluate`로 매니저 API를 부르면 안 된다** — `setupSearchModal()`의
  클릭 리스너가 빠져도 통과한다

## SUGGESTION 반영

- D의 eslint 예외는 **파일 전체 disable보다 범위를 좁혀야 한다** →
  주석 대신 `npm run lint`에 **`--max-warnings 6`**을 걸어 개수를 고정했다.
  7번째 경고가 생기면 린트가 **실패한다.** 주석으로 "알고 있다"고 적는 것보다 강하다.
- Discovery의 `getAllWithMeta`·`getTimestamp`·`!== undefined` 표현을
  **"퇴비 검정결과 동기화 범위"**로 한정해 오해를 줄였다.
