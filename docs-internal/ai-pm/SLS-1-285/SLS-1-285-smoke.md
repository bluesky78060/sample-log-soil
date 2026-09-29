# SLS-1-285 mac 패키징 스모크 결과

> 정본. 2026-09-29, darwin arm64, `npx electron-forge package`(`.env`·`feedback-auth.json`은 빈 자리표시 → 끝나고 삭제, `out/` 삭제).
> 스크립트: `smoke/` (`cdp-check.cjs` ①의 UA·③④⑤, `rawcdp-click2.mjs` ⑥, `lockdiff.js`, `snap.sh`). ①의 Info.plist와 ⑦(`npx @electron/fuses read --app <.app>`)은 손으로 실행했다.
> 원출력(JSON·로그)은 저장하지 않았다 — 아래 표는 실행 당시의 요약이다.

실행: `VITE_DEV_SERVER_URL=http://127.0.0.1:1 …/MacOS/soil-sample-log --user-data-dir=<임시> --remote-debugging-port=<포트> --use-mock-keychain`

| # | 확인 | 결과 |
| --- | --- | --- |
| ① | 번들 버전 | `Electron Framework` Info.plist 39.8.10, UA `… Chrome/142.0.7444.265 Electron/39.8.10` |
| ② | 로드·업데이터 | `[App] 빌드된 파일에서 로드: …app.asar/docs/index.html`, `업데이트 확인 중...` → `latest-mac.yml` **HTTP 404**(GitHub 응답 헤더 수신) → `업데이트 파일 없음 (정상)` |
| ③ | 헤더 CSP | 메인·soil 이동·흙토람 팝업 3곳 모두 eval → `EvalError`, 위반 **2건**(헤더 정책 `…upgrade-insecure-requests;` + meta), `featurePolicy.allowsFeature('camera') === false` |
| ④ | IPC 왕복 | `getVersion()` = 1.14.17, `getAppPath()` = 임시 user-data-dir |
| ⑤ | will-navigate·팝업 | `docs/soil/index.html` 이동 후 `electronAPI` 있음, `openHeuktoram()` → 두 번째 대상 `docs/heuktoram/index.html`(file://) |
| ⑥ | 다운로드 저장 대화상자 | 설정 → `exportAllBtn` → `Page.downloadWillBegin`(sample-log-backup-2026.json) → **내장 저장 시트 표시**(위치·파일명·취소·저장) → 파일명 지정·[저장] → 파일 생성(`{}`, 2B) → 앱 생존·렌더러 응답. 확인 후 파일 삭제 |
| ⑦ | fuses | RunAsNode Disabled, EnableCookieEncryption Enabled, EnableNodeOptionsEnvironmentVariable Disabled, EnableNodeCliInspectArguments Disabled, EnableEmbeddedAsarIntegrityValidation Enabled, OnlyLoadAppFromAsar Enabled (`forge.config.js`대로) |
| — | 렌더러 콘솔 | CDP 연결 후 **메인 창**(메인 → soil 이동)에서 ③의 의도된 위반 외 error·warning 0. 연결 전 시작 구간과 흙토람 팝업 창 콘솔은 수집하지 않았다. 메인 프로세스 stdout 경고는 아래 절 |

## 탐침에서 배운 함정

- **CDP `Runtime.evaluate` 안의 `eval`은 CSP를 우회한다**(`allowUnsafeEvalBlockedByCSP` 기본 true). 1차 탐침이 `EVAL_ALLOWED`를 낸 원인. 평가가 끝난 뒤 `setTimeout` 콜백에서 eval해야 CSP가 걸린다
- **Playwright `connectOverCDP`는 다운로드를 자기 임시 폴더로 가로챈다** → 저장 대화상자가 안 뜨고 파일도 사라진다. ⑥은 Playwright 없이 raw CDP(`Page.enable` 이벤트 관찰만, `userGesture: true`)로 눌렀다. 시트 조작은 `orca computer`(접근성 `AXSetValue`·클릭). 좌표 클릭은 창 포커스를 못 얻어 실패했다

## 로그의 경고 — 회귀 아님

- `[DEP0180] fs.Stats constructor is deprecated`: electron 39.2.6(Node 22.21.1)에서도 같은 코드로 재현된다
- `UnhandledPromiseRejectionWarning`(latest-mac.yml 404): `src/index.js`의 `autoUpdater.checkForUpdatesAndNotify()`(`src/index.js:485`)에 `.catch`가 없어서 생긴다. 코드는 바뀌지 않았다. 404는 mac에만 해당하지만(Windows에는 latest.yml이 있다) 오프라인·프록시·DNS 실패는 Windows에서도 같은 경고를 낸다(크래시 아님)

## 실사용 데이터 보호

`~/Library/Application Support/토양 시료 접수 대장`을 실행 전에 백업하고(비교 후 삭제) 파일 394개의 크기·mtime을 전후로 비교했다.
**`DIPS-wal` 1개만 바뀌었는데 이 스모크가 한 일이 아니다.** 다른 워크스페이스 `orca/workspaces/sample-log-soil/soil`의 개발용 `Electron .`
(PID 58313, 2026-09-28 17:30 시작)이 이 폴더를 열고 있었다(`lsof` 17건). 스모크 인스턴스의 DIPS는 임시 프로필에 생겼고
(`getAppPath()` = 임시 폴더), 기본 경로 폴더 `soil-sample-log`도 만들어지지 않았다.

## 못 한 검증

- Windows 실기: Squirrel 설치, 자동 업데이트, 자동저장 폴더, 파일 대화상자
- juso·vworld 조회(`node:https`): `.env`가 빈 자리표시라 태우지 못함
- `window.print()`(라벨), 쿠키 암호화 경로(`--use-mock-keychain`으로 우회)
- mac에서도 돌리지 않은 것: IPC 저장 대화상자(`saveFileDialog` → `write-file`)와 자동저장 쓰기, 흙토람 팝업 창의 콘솔 수집
