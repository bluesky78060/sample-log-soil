# SLS-1-197 Discovery — 퇴비 이식 후속 백로그

작성일: 2026-08-21 · 사용자 승인: "모두 진행해줘"

## 1. 목표 (Why)

퇴비 이식 4개 티켓(192·194·195·196)의 코드리뷰에서 **비차단으로 분류된 잔여 항목**이다.
배포를 막지는 않으나 방치하면 발견이 어려워진다.

## 2. 사전 조사 — 절반이 이미 해소돼 있었다

**티켓 문구만 보고 착수하면 없는 일을 한다.** 항목마다 현재 코드를 확인했다.

| 항목 | 현재 상태 |
| --- | --- |
| 194 m-2 `manual-capture` 조건부 클릭 | ✅ **SLS-1-267에서 해결** — 단언 + `#listView` 가시성 확인으로 바뀜 |
| 196 MINOR-C `!== undefined` → `!= null` | ✅ **무의미해짐** — 남은 `!== undefined` 1곳은 부숙도 등급 조회이지 Firestore 경로가 아님 |
| 196 MINOR-8 / SUGGESTION-2 `getAllWithMeta` | ✅ **무의미해짐** — SLS-1-204가 **검정결과 Firestore 동기화 자체를 제거**했다 |
| 196 SUGGESTION-1 `_isNewer` 헬퍼 | ✅ 위와 같은 이유. `getTimestamp` 비교 패턴이 코드에 **하나도 없다** |
| 196 SUGGESTION-3 `filterAndRenderLogs` 조건부 | ✅ 위와 같은 이유 |
| 194 s-2 `soil/index.html` title | ✅ 이미 `토양 시료 접수 대장` — 구 제품명 아님 |
| cache-manager TODO | ✅ 2026-08-21 정정 — SLS-1-192·217로 해소, 게이트 방식은 **의도적 기각** |

## 3. 실제로 남은 것 (범위)

| # | 항목 | 출처 |
| --- | --- | --- |
| A | `soil-script.js`의 중복 오버라이드 3종 정리 | 192 SUGGESTION-1 |
| B | `package.json`에 `test:e2e`(빌드 → 테스트) 추가 | 195 MINOR-2 |
| C | 퇴비 검색 모달 UI 왕복 E2E 1건 | 195 MINOR-4 |
| D | eslint `max-lines-per-function` 예외 명시화 | 195 MINOR-5 |
| E | `openCompostAnalysis` 호출 `typeof` 가드 | 194 s-1 |

### A가 단순 중복 제거가 아니다 — 실재하는 결함이 하나 있다

```js
// base (BaseSampleManager.js:1141)
const match = (receptionNumber || '').match(/(\d+)$/);
// soil (soil-script.js:2758)  ← 널 가드가 빠진 열화 사본
const match = receptionNumber.match(/(\d+)$/);
```

soil 사본은 `receptionNumber`가 없으면 **throw한다.** 지우면 그대로 개선이다.

## 4. 제약

- `updateSearchButtonState`는 **순수 중복이 아니다.** soil은 `lot`·`purpose` 필터와
  `purposeFilter` 배지를 추가로 다룬다 → 통째로 지우면 기능이 사라진다
- `openLabelPrintWithData`도 soil은 `_extractLabelAddress`를 쓴다.
  base에 이미 `getLabelAddressParts` 훅이 있으므로 **훅만 오버라이드**하면 된다

## 5. 우선순위

P4. 다만 A의 널 가드 결함은 실재한다.

## 6. 리스크

| 리스크 | 대응 |
| --- | --- |
| 오버라이드를 지우다 기능이 사라진다 | base와 **줄 단위로 대조**했다. 차이가 있는 것은 훅으로 흡수 |
| 라벨 인쇄·검색은 눈에 잘 안 띄는 회귀 | 각 항목마다 **변이 검증** |
| B의 `test:e2e` 추가로 CI 동작이 바뀐다 | 기존 `test`는 건드리지 않는다. 새 스크립트만 추가 |

## 7. 검증

- A·C·E 각각 변이 검증
- 전체 E2E·단위·린트 회귀 없음
- **해소된 항목은 문서에 근거와 함께 남긴다** (다음 사람이 다시 파헤치지 않도록)
