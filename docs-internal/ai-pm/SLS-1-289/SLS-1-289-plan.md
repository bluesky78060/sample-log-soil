# SLS-1-289 플랜 — 설치본에서 dev server 탐색을 끈다

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

작성: 2026-09-29 · 근거: `SLS-1-289-direction.md`

## 변경

### 1. `src/dev-server-probe.js` (신규, 메인 프로세스 CommonJS)

```js
async function isDevServerReachable({ isPackaged, url, httpGet, timeoutMs = 1000 })
  // isPackaged → 즉시 false, httpGet 을 부르지 않는다
  // 그 밖: 지금과 같은 1초 http.get, 응답 → true / error·timeout → false
function isDevNavigationAllowed({ isPackaged, url })
  // !isPackaged && url.startsWith('http://localhost:')  (팝업 will-navigate 용)
```

`src/index.js` 안에 두지 않는 이유: index.js 는 require 시점에 `app.whenReady` 등 부작용이 있어 유닛에서 실행할 수 없다.
분리하면 런타임으로 검사할 수 있다(기존 index.js 테스트는 정적 정규식뿐).

### 2. `src/index.js`

- `loadApp()`: `try { await new Promise(http.get …) }` → `if (await isDevServerReachable({ isPackaged: app.isPackaged, url: VITE_DEV_SERVER_URL, httpGet: http.get }))`.
  나머지(docs/ 로드, 없으면 안내)는 그대로.
- 팝업 로더: 같은 교체. 팝업 `will-navigate` 의 `if (url.startsWith('http://localhost:')) return;` → `isDevNavigationAllowed(...)`.
- 메인 창 `will-navigate` 는 `activeDevServerUrl`(설치본에서는 늘 null)로 이미 막힌다 — 변경 없음.
- 82행 주석("packaged 앱에서는 연결 실패 후 docs/ 로 폴백")은 틀린 주장이라 고친다.

`VITE_DEV_SERVER_URL` 환경변수 재정의도 `isPackaged` 에서 탐색 자체를 안 하므로 함께 막힌다.

## 검증

- 유닛 `tests/unit/dev-server-probe.test.js`: isPackaged=true 면 httpGet 미호출·false / 응답 → true / error → false / timeout → false(req.destroy 호출) / navigation 허용 표.
- 정적 가드(같은 파일): `src/index.js` 에 `http.get(VITE_DEV_SERVER_URL` 직접 호출이 남지 않았는지, 팝업 will-navigate 에 맨 `startsWith('http://localhost:')` 허용이 남지 않았는지 — 한쪽만 고치는 회귀를 막는다.
- 변이: `if (isPackaged) return false` 를 지우면 유닛이 죽는지. index.js 의 헬퍼 호출을 옛 코드로 되돌리면 정적 가드가 죽는지.
- mac 패키징 재현(수정 후): 같은 주입 서버에서 메인·팝업이 `file://…/docs/` 를 로드하는지, 앱 로그 `빌드된 파일에서 로드`. 주입 서버 없이도 정상 기동.
- 개발 흐름: 패키징 전 `electron-forge start`(isPackaged=false)에서 주입 서버를 dev server 로 여전히 찾는지(= 개발 동작 불변) — 가능하면 확인.
- build / unit / lint / E2E(E2E 는 이 경로를 안 밟는다 — 회귀 확인용).
- 못 하는 것: Windows 실기.

## 릴리스

보안 수정이라 다음 릴리스(v1.14.19)에 넣는다. v1.14.18(새 업데이터 첫 설치) 수신이 확인된 뒤 태그하는 것이 원인 분리에 좋다 — 결정은 사용자.

## 플랜 리뷰 1R 반영 (critic APPROVE, MINOR 5 · SUGGESTION 4)

- **fail-closed**: 두 헬퍼 모두 `if (isPackaged !== false) return false;` — 인자를 빠뜨리거나 undefined 면 탐색하지 않는다.
  유닛에 "isPackaged 누락 → false, httpGet 미호출", "잘못된 URL(http.get 동기 throw) → false" 추가.
- **origin 비교**(SUGGESTION 1 채택): `isDevNavigationAllowed({ isPackaged, url, devServerUrl })` 는 `new URL(url).origin === new URL(devServerUrl).origin`.
  `startsWith('http://localhost:')` 는 `http://localhost:@evil/` 에, 메인 창 `startsWith(activeDevServerUrl)` 는 `http://localhost:3000@evil/` 에 뚫린다. 메인 창 will-navigate 도 이 헬퍼를 쓴다.
- **정적 가드 보강**: 헬퍼 호출마다 `isPackaged: app.isPackaged` 가 글자 그대로 있는지, `loadURL(` 로 dev server URL 을 여는 곳 수 == `isDevServerReachable(` 호출 수(지금 2)인지, 맨 `http.get(VITE_DEV_SERVER_URL` 과 맨 `startsWith('http://localhost:')` 가 없는지.
- **변이 추가**: 호출부 `app.isPackaged` → `false` 로 바꾸면 정적 가드가 죽는지.
- **팝업 이동 런타임 확인**: probe 에서 file:// 로 뜬 흙토람 팝업에 `location.href = 'http://localhost:3000/'` → URL 이 file:// 에 머무는지.
- **eslint**: `eslint.config.mjs` `NODE_FILES` 에 `src/dev-server-probe.js` 추가.
- **asar 확인**: 스모크를 돌린 바로 그 패키지에서 `/src/dev-server-probe.js` 존재, 앱 로그 `빌드된 파일에서 로드`.
- **주석**: 82행에 더해 350-352행("VITE_DEV_SERVER_URL 이 있으면 dev server 사용"), 86행(가리키는 코드 없음)도 고치거나 지운다.
- 테스트는 `createRequire(import.meta.url)` 로 CJS 헬퍼를 불러온다(선례 `tests/unit/extract-whatsnew.test.js`).
- 범위 밖으로 남긴 것(SUGGESTION 2·3·4): IPC 발신자 검증, `web-contents-created` 전역 가드, vite `--strictPort` → 후속 티켓.
