# SLS-1-275 플랜 — 고정 열 좌표가 이전 값에 고정되는 문제

## 1. 확정된 원인 (실측)

`src/shared/sticky-columns.js`의 `buildRules()`는 열 좌표를 `th.offsetLeft`로 잰다.

**Chromium에서 `offsetLeft`는 그 요소의 sticky 변위를 포함한다.**
이 모듈이 직접 써 넣은 `left` 규칙 때문에 요소가 오른쪽으로 밀려 있으면,
다시 잴 때 **밀린 위치**가 읽힌다.

열이 **줄어드는** 전환에서 문제가 된다.

| 전환 | 자연 위치 | 직전 규칙 | 결과 |
| --- | --- | --- | --- |
| 농가의뢰 → 공익직불제 | 커진다(163→227) | 163 (더 작다) | 변위 없음 → **정상** |
| 공익직불제 → 농가의뢰 | 줄어든다(227→163) | 227 (더 크다) | 227로 밀림 → 그 값을 다시 씀 → **고정** |

실측(Chromium, 1440×900, docs 빌드):

```
① 초기 (농가의뢰)   col-date{left:163px}  col-name{left:409px}
② 공익직불제        col-order{left:163px} col-date{left:227px}
③ 농가의뢰로 복귀   col-date{left:225px}  col-category{left:332px}   ← 62px 틈
```

③에서 `접수일자`가 62px 오른쪽으로 밀려 `구분`을 덮는다. 사용자가 본 "빈 칸"이
그 틈이고, 사라진 것처럼 보인 `구분`은 밀려 온 셀 밑에 깔린 것이다.

같은 뿌리로 **전체 보기 해제**에서도 재현된다(`col-name` 409px → 484px).
퇴비 목록도 같은 모듈을 쓰므로 동일하다.

기존 E2E가 못 잡은 이유: 왕복 경로가 없고, 검증식이 `offsetLeft - base`를
규칙과 비교하는데 **둘 다 같은 잘못된 값**이라 일치한다.

## 2. 수정

`applyStickyColumns()`에서 **재기 직전에 이 모듈이 넣은 좌표를 무력화**한다.

```js
const sheet = sheetFor(table);
sheet.textContent = `#${table.id} .sticky-col{left:auto}`;  // 변위 제거
sheet.textContent = buildRules(table);                       // 자연 위치로 재고 쓴다
```

- `left:auto`면 sticky가 가로로 걸리지 않아 `offsetLeft`가 **자연 위치**가 된다.
- 특이도 `#id .sticky-col`(1,1,0)이 CSS 폴백 `.data-table.gongik-on .col-date`(0,3,0)를
  이기므로 폴백 좌표의 변위도 함께 제거된다.
- 두 쓰기가 같은 태스크 안에서 끝나므로 페인트는 한 번이다 — 깜빡임 없음.
- 덤: 가로로 민 상태에서 `ResizeObserver`가 불려도 변위가 섞이지 않는다.

`buildRules()`는 손대지 않는다(순수 측정 함수, 유닛 테스트 대상).

## 3. 검증

1. 재현 스크립트(`scratchpad/repro.js`)로 ③의 규칙이 ①과 같아짐을 확인.
2. E2E 추가 `tests/e2e/list-sticky-columns-roundtrip.spec.js`
   - 토양: 농가의뢰 → 공익직불제 → 농가의뢰, 규칙이 최초와 동일.
   - 토양·퇴비: 전체 보기 켜고 끄기, 규칙이 최초와 동일.
   - **규칙 문자열 비교**로 본다. 화면 좌표만 보면 지금처럼 "잘못된 값끼리 일치"해
     통과할 수 있다.
3. 기존 `list-sticky-columns-drift.spec.js` 전부 통과(SLS-1-264 회귀 방지).
4. `npm run test:unit`, `npm run build`.
5. 변이 검증: 수정을 되돌리면 새 E2E가 실제로 실패하는지 확인.

## 4. 범위 밖

- CSS 폴백 좌표 손대기 — 자동 계산이 꺼졌을 때의 안전망이라 그대로 둔다.
- 열 구성·표시 로직 변경.

## 5. 플랜 리뷰 반영 (codex, 2026-08-21)

- 반응형 전환(좁은 화면에서 `col-action`이 `position:static`)에서 관리 열에 동적 `left`가
  남지 않는지 E2E로 확인한다.
- 규칙 문자열뿐 아니라 **머리글과 본문 행의 computed `left`가 같은지**도 단언한다.
- 전환 후 규칙이 **안정 상태로 수렴**하는지(추가 대기 후 재확인) 본다 — 무한 재예약 방지.
- 범위 밖 명시: `src/heuktoram/`·`src/compost/`의 분석 표는 `sticky-col` 클래스를 쓰지만
  이 모듈을 import하지 않는다. 별도 구현이므로 이번 티켓 대상이 아니다.
