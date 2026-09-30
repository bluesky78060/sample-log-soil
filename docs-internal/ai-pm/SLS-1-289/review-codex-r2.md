## 리뷰 결과

판정: **APPROVE WITH MINOR**

- CRITICAL: 0
- MAJOR: 0
- MINOR: 1
- SUGGESTION: 1

현재 런타임 코드에서 보안 우회나 리소스 누수는 발견하지 못했습니다. 1라운드의 지적 네 항목도 실제로 수정됐습니다.

### MINOR — `will-navigate` 정적 가드가 검사 제목보다 좁음

[dev-server-probe.test.js:145](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/tests/unit/dev-server-probe.test.js:145)의 테스트는 “file 검사와 헬퍼 말고는 URL을 허용하지 않는다”고 선언하지만, 실제로는 `startsWith(...)` 호출만 검사합니다.

재현 시나리오:

```js
if (/^https?:/.test(url)) return;
```

또는:

```js
if (url.includes('http')) return;
```

를 `will-navigate` 핸들러에 추가하면 외부 HTTP 탐색을 허용하는 보안 회귀가 생기지만, 현재 정적 가드는 통과합니다. 1라운드에서 제시된 `|| url.startsWith("http:")` 변이는 잡지만, 동일한 결과를 내는 간단한 표현 변경에는 무력합니다.

현재 제품 코드에는 이 결함이 없으므로 런타임 취약점이 아니라 **회귀 가드의 사각지대**로 MINOR입니다. 허용되는 `return` 위치나 핸들러 AST 구조를 직접 검증하는 방식이 더 정확합니다.

### SUGGESTION — 소스 구조 파서가 문자열·주석을 인식하지 않음

[dev-server-probe.test.js:106](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/tests/unit/dev-server-probe.test.js:106)의 `callArgs()`는 문자열·템플릿·주석 안의 괄호도 깊이에 포함합니다. 호출 인자에 `')'`, `'('` 또는 괄호가 든 설명 주석이 추가되면 잘못된 범위를 추출할 수 있습니다.

[dev-server-probe.test.js:118](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/tests/unit/dev-server-probe.test.js:118)의 `navHandlers` 역시 등록 줄과 종료 `});`의 들여쓰기에 의존하고, 종료점을 찾지 못한 `-1`도 명시적으로 실패시키지 않습니다.

현재 소스 형태에서는 정상 작동하며 보안 우회를 직접 만들지는 않으므로 SUGGESTION입니다.

## 요청된 집중 검토 결과

- `finish()` 순서: 적절합니다. `done`을 먼저 세우고 타이머 제거, 실패 요청 파기, resolve 순으로 처리하여 재진입을 막습니다.
- 응답 후 타이머: `clearTimeout()`으로 제거됩니다.
- 타이머 후 늦은 응답: 요청을 `destroy()`하며, 그래도 콜백이 도착하면 `res.destroy()`가 실행되고 `finish(true)`는 `done` 때문에 무시됩니다.
- `req === null`: 동기 예외 또는 동기 콜백에서도 안전합니다. 타이머가 이벤트 루프에서 실행되기 전 `httpGet` 호출이 반환되거나 예외 처리가 끝납니다.
- 팝업 재사용: 기존 창은 같은 클로저와 `popupDevServerUrl`을 유지하며 `reload()`됩니다. dev에서 생성된 창은 dev origin을, 파일로 생성된 창은 `null`을 유지합니다. 설치본 우회는 없습니다.
- `file:`/`data:`의 `'null'` origin 문제: HTTP/HTTPS 프로토콜 한정으로 수정됐습니다.
- 팝업 탐색 결과 연동: `popupDevServerUrl`은 탐색 성공 시에만 채워집니다.
- 패키징 재현: `repro-after.json`은 메인·팝업 모두 `file://`이며 외부 이동도 차단됐습니다. `repro-dev-unpackaged.json`은 개발 모드에서 dev server 로드를 확인합니다.
- 유닛 실행: 이 리뷰 환경에서는 Vitest가 시스템 임시 디렉터리를 만들지 못해 `EPERM`으로 테스트 로딩 전에 중단됐습니다. 코드 실패는 아닙니다.
