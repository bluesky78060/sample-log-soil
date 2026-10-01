# SLS-1-296 플랜 리뷰

> 정본. 훅 통과용 사본은 `docs/02-review/`.

리뷰어: `critic`(Opus, 읽기 전용) + 오케스트레이터 · 2026-10-01

## 1R — APPROVE (CRITICAL 0 / MAJOR 0 / MINOR 3 / SUGGESTION 3)

「도달 불가」 판단 두 개를 반증하려 했으나 깨지지 않았다.
- dompurify: `addHook`·`sanitize` 는 `src/shared/sanitize.js:19·:58` 뿐, `IN_PLACE`·`setConfig`·`RETURN_DOM`·`beforeSanitize*`·`uponSanitize*` 없음, 전이 사본 없음. 3.4.16 의 로직 변경은 `_handleHookDetachedNode` 추가뿐이며 비-IN_PLACE 경로에서는 앱 훅(`setAttribute` 만)에 영향이 없다. **jsdom 차분 실행 16종 diffs 0**, 훅 동작 유지.
- grpc-js: 로드하는 파일은 `@firebase/firestore` 의 `index.node.cjs.js`·`index.node.mjs` 뿐, 렌더러는 브라우저 빌드(`WebChannel` 존재), 모든 BrowserWindow 가 sandbox 라 require 불가, 메인은 firebase 미사용. 1.9.16 에는 서버 쪽 `getAuthContext` 가 없다(참조되지 않는 파일에만 정의).
- override 보류 합리적(`@firebase/firestore@latest` 4.17.2 도 `~1.9.0`, 1.9.x 수정판 아직 없음, audit 제안은 다운그레이드).

- MINOR 1 minifier 지역 변수 이름 변화의 「문자 빈도」 설명이 Rollup 4 동작과 맞지 않음(esbuild 는 최종 해시가 아닌 플레이스홀더를 본다; 같은 해시가 바뀐 settings·soil 은 이름이 그대로) → 원인은 빼고 검증된 성질만 기록
- MINOR 2 「docs/assets 어디에도 grpc 문자열 없음」은 문자 그대로는 틀림(`"GRPC error has no .code"`) → 근거를 `grpc-js`·`@grpc`·`proto-loader`·`http2` 0건 + `WebChannel` 로 정정
- MINOR 3 재검토 조건이 하나뿐 → 1.9.x 백포트, 불변식 3개 추가(`decisions.md`)
- SUGGESTION: 차분 스크립트를 evidence 로(반영) · advisory 조건 문구를 「현재 노드를 분리하는 훅」으로(반영) · 「서버 쪽」을 보조 근거로(반영)

## 오케스트레이터 판단

MINOR 3건과 SUGGESTION 3건을 방향·플랜·`decisions.md` 에 반영했다. 코드·lock 변경은 필요 없다. APPROVE 라 재리뷰 없이 진행하고 반영분은 코드리뷰에서 본다.
