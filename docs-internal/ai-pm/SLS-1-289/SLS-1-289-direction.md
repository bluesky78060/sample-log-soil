# SLS-1-289 방향 — 설치본이 localhost:3000을 먼저 로드

> 정본. 훅 통과용 사본은 `docs/00-discovery/`.

작성: 2026-09-29 · 확정: 사용자 「계속 진행」(발행 시 우선순위 1 보안 티켓)

| 카테고리 | 내용 |
| --- | --- |
| 목표 | 설치본은 어떤 경우에도 `docs/`(file://)만 로드한다 |
| 사용자 | 전국 농업기술센터 설치본 사용자 — 동작 변화 없어야 한다. 개발자 — `npm start`·`dev:electron`은 그대로 |
| 범위 | `src/index.js` 메인 창 `loadApp()`, 팝업 로더 `makePopupWindowHandler`, 팝업 `will-navigate`의 localhost 허용 |
| 범위 밖 | 패키징 앱에서 `--dev`/`DEV_MODE`로 DevTools가 열리는 것 — 로컬 실행 권한이 필요하고, `--dev`만 막아도 `--remote-debugging-port`로 디버깅이 열린다(이 재현이 그렇게 했다). 3000번 포트는 권한 없이 바인딩되므로 위협 모델이 다르다 · SLS-1-290 |
| 제약 | 개발 실행은 모두 패키징 전(`electron-forge start`)이라 `app.isPackaged`가 false — 가드해도 개발 흐름은 유지 |
| 리스크 | 설치본의 창 로드 경로 자체를 건드린다 — 잘못되면 앱이 안 뜬다. mac 패키징 스모크로 확인, Windows는 못 한다 |
| 검증 | 수정 전 재현(완료) → 수정 후 같은 재현에서 docs/ 로드, 유닛(런타임) + 변이 검증 |

## 재현 (수정 전, 2026-09-29)

`127.0.0.1:3000`에 주입 페이지를 띄우고 `npx electron-forge package`한 앱을 임시 `--user-data-dir`로 실행:

```json
{"main":{"url":"http://localhost:3000/","title":"INJECTED api=object keys=20"},
 "popup":{"url":"http://localhost:3000/heuktoram/","title":"INJECTED api=object keys=20"}}
```

메인 창과 팝업 모두 외부 페이지를 로드했고, 그 페이지에 `window.electronAPI` 20개 메서드(readFile·writeFile 등)가 노출됐다.
앱 로그: `[App] Vite dev server에서 로드: http://localhost:3000`. 원자료 `repro-before.json`, 스크립트 `.omc/sls289/`(로컬).
