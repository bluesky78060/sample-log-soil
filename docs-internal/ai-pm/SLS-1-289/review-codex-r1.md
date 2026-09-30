## 독립 리뷰 결과

판정: **APPROVE WITH MINOR**

- CRITICAL: 0
- MAJOR: 0
- MINOR: 1
- SUGGESTION: 1

### MINOR — 탐색 Promise의 자체 종료가 보장되지 않음

[src/dev-server-probe.js:17](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/src/dev-server-probe.js:17)

`timeoutMs`는 `http.get`의 socket timeout에만 의존합니다. `httpGet`이 요청 객체를 반환한 뒤 `response`, `error`, `timeout` 중 아무 이벤트도 내지 않으면 Promise가 영원히 pending 상태로 남습니다.

재현 시나리오:

```js
const req = new EventEmitter()
req.destroy = () => {}
const get = () => req

await isDevServerReachable({
  isPackaged: false,
  url: 'http://localhost:3000',
  httpGet: get,
  timeoutMs: 10
}) // 끝나지 않음
```

영향은 비패키징 개발 실행의 메인 창 또는 팝업 로드 정지입니다. 설치본은 16행에서 즉시 `false`로 반환하므로 이번 취약점 수정의 보안 경계에는 영향이 없습니다.

독립 타이머를 두고 단일 `finish()` 함수에서 타이머 정리, 요청 파기, 한 번만 resolve하도록 만들면 됩니다. 무응답 케이스의 유닛 테스트도 필요합니다.

### SUGGESTION — 정적 가드의 probe/load 개수 비교는 대응 관계까지 증명하지 않음

[dev-server-probe.test.js:106](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/tests/unit/dev-server-probe.test.js:106)

`loadURL` 두 개와 probe 두 개의 개수만 비교하므로, 한 로드가 무조건 실행되고 다른 곳에 죽은 probe 호출이 추가되어도 통과할 수 있습니다. 다만 현재 테스트는 공허하지 않습니다. 직접 `http.get`, 기존 `startsWith`, `app.isPackaged` 누락 등 핵심 회귀는 실제로 잡습니다.

향후에는 `index.js`를 부작용 없는 로더 함수로 더 분리해 런타임 테스트하거나 AST 기반 검사를 쓰는 편이 더 강합니다.

## 보안 경계 확인

설치본에서 HTTP(S) 페이지가 preload/electronAPI가 붙은 창에 올라가는 잔여 경로는 찾지 못했습니다.

- 메인·팝업의 dev-server `loadURL`은 모두 `app.isPackaged !== false`에서 거부됩니다.
- 환경변수로 `VITE_DEV_SERVER_URL`을 조작해도 설치본에서는 탐색되지 않습니다.
- 메인·팝업 `will-navigate` 역시 설치본에서 HTTP(S)를 거부합니다.
- origin 비교로 userinfo·포트 prefix 우회가 닫혔습니다.
- `setWindowOpenHandler`는 새 Electron 창을 만들지 않고 항상 `deny`합니다.
- 설치본은 `loadFile`/고정 `data:` 오류 페이지만 초기 로드하므로 HTTP redirect 경로도 없습니다.
- BrowserWindow 생성은 두 곳뿐이며 양쪽 모두 이번 보호 범위에 들어갑니다.
- `electron-forge start`와 `dev:electron`은 `app.isPackaged === false`라 기존 개발 서버 흐름을 유지합니다.
- 주석에서 확인한 과장이나 코드와 어긋난 설명은 없습니다.

검증상 ESLint는 오류 없이 통과했습니다(기존 경고 6개). 새 Vitest 파일은 실행 환경의 임시 디렉터리 생성 권한 오류로 수집 전에 중단되어, 이 리뷰 환경에서는 실행 결과를 재확인하지 못했습니다.
