독립 리뷰 결과: **CRITICAL 0 / MAJOR 0 / MINOR 1 / SUGGESTION 0**입니다. 두 핵심 판정은 모두 타당합니다.

### MINOR

- 패키징 스모크가 주석과 달리 앱의 `sanitizeHTML` 래퍼와 `afterSanitizeAttributes` 훅을 검증하지 않습니다. [installed-dompurify-probe.cjs](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/docs-internal/ai-pm/SLS-1-296/smoke/installed-dompurify-probe.cjs:5)에서 `S`로 래퍼를 찾지만 실제 호출은 `raw.sanitize(...)`입니다. 출력에도 `target="_blank"`가 제거되어 `rel="noopener noreferrer"` 훅은 실행되지 않았습니다. 따라서 파일 첫 줄의 “앱의 sanitize 래퍼로 동작하는지 — 훅(rel=noopener)”라는 설명은 과장입니다.
  - 영향: 3.4.16 설치 및 기본 XSS 제거는 검증하지만, 패키징 환경에서 앱 설정·훅 적용까지 검증했다는 증거는 아닙니다.
  - 완화: 별도 differential 테스트가 앱과 동일한 설정·훅으로 16종 `diff 0`을 확인하므로 핵심 결론을 뒤집지는 않습니다.
  - 권고: 스모크에서 `S(payload)`를 호출하고 `rel="noopener noreferrer"`를 단언하거나, 주석과 기록을 “raw DOMPurify 설치·기본 정화 확인”으로 축소하십시오.

### 핵심 판정

1. **DOMPurify 3.4.15 → 3.4.16이 이 앱에 관찰 가능한 동작 변화를 주지 않는다는 판단은 타당합니다.**
   - 앱은 [sanitize.js](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/src/shared/sanitize.js:9)의 `afterSanitizeAttributes` 훅 하나만 사용하며 현재 노드를 분리하지 않습니다.
   - `IN_PLACE`, `setConfig`, DOM 반환 모드 및 다른 element/attribute 훅 사용이 없습니다.
   - differential 스크립트는 앱의 실제 설정을 읽고 동일 훅을 양 버전에 등록한 뒤 16개 페이로드의 문자열 결과를 비교합니다. `diff 0`은 그 한정된 결론에 적합합니다. 전체 DOMPurify 호환성 증명은 아니지만 기록도 그 수준 이상을 요구하지 않습니다.
   - 새 purify 청크는 라이선스 헤더상 3.4.16이고, 구 청크는 3.4.15입니다.
   - 진입 청크 6개는 바이트 크기가 각각 동일했습니다. 3개는 purify 해시 치환 후 동일했고, 나머지는 기록된 지역 변수 교환 형태와 일치했습니다. 앱 로직 변화 정황은 없습니다.

2. **`@grpc/grpc-js`를 프로덕션 비도달로 판단해 코드를 바꾸지 않은 결정도 타당합니다.**
   - `@firebase/firestore`의 grpc import는 `index.node.cjs.js`와 `index.node.mjs`에만 존재합니다.
   - 브라우저 export는 `index.cjs.js`/`index.esm.js`이고 WebChannel 경로를 사용합니다.
   - Vite 설정에 Node 조건이나 SSR override가 없습니다.
   - 두 `BrowserWindow` 생성 경로 모두 `sandbox:true`, `nodeIntegration:false`, `contextIsolation:true`입니다.
   - 메인 및 preload에서 Firebase를 불러오지 않습니다.
   - 생성된 브라우저 번들에 grpc-js/proto-loader/http2 로딩 흔적이 없습니다.
   - 재검토 조건은 1.9.x 백포트, Firestore 의존 범위 변경, BrowserWindow/Vite/메인 프로세스 불변식 변경을 포함하므로 현재 구조에는 충분합니다.

### 기타 검증

- lock 변경은 루트 의존 선언과 `node_modules/dompurify` 항목뿐입니다.
- 새 항목은 `https://registry.npmjs.org/dompurify/-/dompurify-3.4.16.tgz`이며 integrity가 존재합니다.
- `docs/` HTML의 로컬 `src`/`href` 참조 누락: **0건**.
- 이전 purify 및 진입 청크 해시 잔존: **0건**.
- `docs/00-discovery`, `01-plan`, `02-review`, `03-code-review` 사본은 존재하지 않으며 커밋 대상에도 없습니다.
- 월 배지 관련 소스·설명서 변경도 현재 diff에 남아 있지 않습니다.
- 위 스모크 설명 문제 외에는 기록에서 결론을 바꿀 과장이나 중요한 누락을 찾지 못했습니다.
