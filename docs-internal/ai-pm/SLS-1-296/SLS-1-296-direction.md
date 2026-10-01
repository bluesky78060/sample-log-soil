# SLS-1-296 방향 — 프로덕션 신규 권고 2건 (dompurify · @grpc/grpc-js)

> 정본. 훅 통과용 사본은 `docs/00-discovery/`.

작성: 2026-10-01 · 확정: 사용자 「진행해줘」(SLS-1-292 작업 중 발견, 우선순위 2)

| 카테고리 | 내용 |
| --- | --- |
| 목표 | `npm audit --omit=dev` 가 0 → 5건(2026-09-30 15시 UTC 공개 권고 3건)으로 늘었다. 이 앱에 **실제로 해당하는지**를 코드로 가리고, 해당 여부와 무관하게 값이 싼 수정은 한다 |
| 사용자 | 웹판·설치본 사용자. 동작 변화 없어야 한다 |
| 범위 | ① `dompurify` 3.4.15 → 3.4.16(직접 의존성, 웹 번들·설치본 양쪽) ② `@grpc/grpc-js` 1.9.16(firebase 전이)은 **도달 가능성 판단과 기록** |
| 범위 밖 | firebase 업그레이드, override 로 grpc-js 를 올리는 것(아래 판단), electron(SLS-1-297) |
| 제약 | dompurify 는 XSS 방어선이라 번들 내용이 바뀐다 → 산출물 비교·E2E. `docs/` 가 바뀌므로 push 하면 웹판에 반영된다 |
| 리스크 | 낮음(패치 버전 한 칸). 단 minifier 가 import 해시 문자열 변화로 지역 변수 이름을 바꾼다 |
| 검증 | lock 전수, 산출물 비교, unit·lint·E2E, 패키징 스모크(13개 페이지), audit |

## 도달 가능성 판단

### dompurify — GHSA-p98j-92pf-mc4p (low)
조건: `IN_PLACE` 모드 + 현재 노드를 분리하는 훅(수정 범위는 before/upon/after 의 element·attribute 훅 전부). 이 앱은 `src/shared/sanitize.js` 에서 `afterSanitizeAttributes` 훅 하나만 쓰고(`:19`) `IN_PLACE` 를 설정하지 않는다(`:58` `sanitize(html, config)`). **도달 불가.**
그래도 3.4.16(2026-09-23, 8일 경과)으로 올린다 — 패치 한 칸이고 XSS 방어선이라 방어층 가치가 비용보다 크다.

### @grpc/grpc-js — GHSA-m9gg-hp2v-232j · GHSA-f596-whhp-79r4 (high 표기)
**주 근거는 「프로덕션 경로에서 로드되지 않는다」**이고 「서버 쪽 동작」은 보조다(f596 은 서버 쪽이 명확, m9gg 의 클라이언트 영향은 advisory 본문을 못 읽어 미확인 — 로드가 안 되므로 결론에는 영향이 없다). 1.9.16 에는 서버 쪽 `getAuthContext` 가 아예 없다(유일한 정의 `build/src/single-subchannel-channel.js:186` 은 어디서도 참조되지 않는 파일). 이 앱은 gRPC 서버를 돌리지 않는다.
- `@firebase/firestore` 의 `@grpc/grpc-js` 는 **Node 진입점**(`dist/index.node.cjs.js`)에서만 로드된다(`evidence/firestore-entry.json`).
- 렌더러는 `firebase/compat/*` 를 vite 로 번들하는 **브라우저 빌드**를 쓴다 — `docs/assets` 에 `grpc-js`·`@grpc`·`proto-loader`·`http2` 가 0건이고 브라우저 빌드 표지인 `WebChannel` 이 있다(공용 코드의 `"GRPC error has no .code"` 문구는 있으나 grpc-js 가 아니다). 모든 BrowserWindow 가 `contextIsolation:true, nodeIntegration:false, sandbox:true`(`src/index.js:335-337, 569-571`)라 렌더러가 node_modules 를 require 할 경로 자체가 없다.
- 메인 프로세스(`src/index.js`·`preload.js`)는 firebase 를 require 하지 않는다.
- 설치본 asar 에는 `node_modules/@grpc/grpc-js` 파일이 실리지만 **로드되는 경로가 없다.**
**도달 불가.**

수정 방법이 마땅치 않기도 하다: `@firebase/firestore` 는 최신 버전도 `@grpc/grpc-js ~1.9.0` 으로 고정이고, npm audit 이 제안하는 「firebase 9.14.0」은 다운그레이드다. override(`^1.14`)로 마이너를 건너뛰면 Node 경로에서만 쓰이는 코드의 호환성 위험만 생기고 얻는 것이 없다.
vitest(Node 환경)에서 firebase 를 import 하는 테스트가 생기면 node 빌드와 grpc 가 로드될 수 있다 — 개발 전용이라 프로덕션 판단과 무관하나 「어디서도 실행되지 않는다」가 아니라 **「프로덕션 경로에서」**로 한정해 적는다.
→ **코드·lock 을 바꾸지 않고 근거를 기록한다.** Dependabot 알림 dismiss(사유 「vulnerable code not used」)는 GitHub 상태 변경이라 **사용자 결정**으로 남긴다. firebase 가 grpc 고정을 풀면 그때 올린다(재검토 조건).
