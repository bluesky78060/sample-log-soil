# SLS-1-285 플랜 — electron 39.2.6 → 39.8.10

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

작성: 2026-09-29 · 근거: `SLS-1-285-direction.md` · 개정: 플랜 리뷰 1R(REVISE, MAJOR 3) 반영

## 대상

| 항목 | 현재 | 목표 |
| --- | --- | --- |
| `package.json` devDependencies `electron` | `"39.2.6"` | **`"39.8.10"`** 정확 고정 (39.x 마지막 릴리스, 2026-05-05) |
| `package-lock.json` `node_modules/electron` | 39.2.6 | 39.8.10 |

`npm audit`의 electron 항목은 GHSA 33건이고 전부 `<39.8.10` 이하에서 닫힌다(가장 늦은 것: GHSA-v3j7-r9gq-3gjw ·
GHSA-9f4c-93c8-jc8g · GHSA-pfmc-3mgc-p6fp, `<39.8.10`). Dependabot 열린 electron 알림은 32건(high 8, medium 18, low 6)으로 이 중 일부다
(착수 때 적은 17건은 1차분만 센 것 — 코드리뷰에서 정정).

**39.8.10 뒤에도 audit의 electron 항목은 남는다.** 직접 advisory 33건은 모두 닫히지만 electron의 의존성
`extract-zip ^2.0.1`(최신이 2.0.1)의 GHSA-jmr9-qjv8-65gv 등이 `via: ["extract-zip"]`로 electron에 붙는다(스크래치 lock으로 실측,
`fixAvailable` = 44.4.5 메이저). extract-zip은 `node_modules/electron/install.js`(바이너리 다운로드 postinstall)에서만 쓰이고
**설치본에는 실리지 않는다.** 그래서 합격 기준은 "electron 항목의 `via`에 GHSA 직접 advisory 0건, 남은 것은 extract-zip 경유뿐"이다.

⚠️ **39.x는 지원 종료다.** 39.8.10 릴리스 노트 머리에 end-of-support 경고가 있다. 이후 Chromium 보안 수정은 39에 백포트되지 않는다.
메이저 이전은 **후속 티켓**으로 권고한다 — 목표 40.10.3 이상(extract-zip 경유 항목도 audit 범위를 벗어난다). 발행은 코디네이터 소관.

## lock 절차

```bash
git show HEAD:package-lock.json > HEAD-lock.json   # 먼저 떠 둔다
npm install --save-exact electron@39.8.10
node lockdiff.js HEAD-lock.json package-lock.json    # packages 항목 version·integrity·resolved 전수 비교
rm -rf node_modules && npm ci
npm ls electron                      # = 39.8.10
npm audit                            # electron via에 GHSA 직접 advisory 0건 (extract-zip 경유만)
```

**예상 lock diff**: 스크래치 사본에서 `--package-lock-only --ignore-scripts`로 재현 → `CHANGED node_modules/electron 39.2.6 -> 39.8.10`
**한 건뿐**(+ 루트 `devDependencies` 문자열). 그 밖의 항목이 바뀌면 멈추고 원인을 적는다.
CI는 `npm install`(build.yml:30)이지만 정확 고정이라 39.8.10으로만 해석된다.

## 39.2.7 ~ 39.8.10 릴리스 노트 + GHSA 대조 (앱이 쓰는 API 기준)

Chromium은 142 패치 범위(→142.0.7444.265), Node는 22.22.1 — 메이저 변화 없음. **breaking change 표기 없음.**

앱이 쓰는 Electron API: `BrowserWindow`(contextIsolation·sandbox·nodeIntegration:false), `setWindowOpenHandler`(항상 deny),
`will-navigate`, `loadFile`/`loadURL`(file://, data:), `session.defaultSession.webRequest.onHeadersReceived`(CSP),
`contextBridge.exposeInMainWorld` + `ipcRenderer.invoke`, `ipcMain.handle`, `dialog.show{Open,Save,MessageBox}`,
`shell.openExternal`, `Menu`, `app.getPath`, 메인에서 `node:http`·`node:https`(juso·vworld, `src/index.js:1151`·`1256`)·`fs`.
렌더러 쪽 Electron 경로: **Chromium 기본 다운로드**(`will-download` 핸들러 없음 → 내장 저장 대화상자) — `XLSX.writeFile`
(`soil-script.js:5389`, `compost-script.js:1066`), blob + `a.download`(흙토람 업로드 파일 `heuktoram-script.js:1497`, 백업 `settings-script.js:547`),
라벨 `window.print()`(`label-app.js:615`). 업데이트는 electron 내장 `autoUpdater`가 아니라 electron-updater 6.8.9.

| 변경 (버전) | 우리 영향 |
| --- | --- |
| webRequest 응답 헤더 값의 잘못된 문자 거부 (릴리스 노트 39.8.1, GHSA-4p4r-m79c-wq3v `<39.8.3`) | **가장 직접 영향.** CSP·보안 헤더 값은 ASCII 문자열이라 유효하다. 스모크 ③에서 헤더가 실제로 붙는지 **헤더에만 있는 신호로** 확인한다 |
| 다운로드 저장 대화상자 콜백 use-after-free 수정 (GHSA-9w97-2464-8783 `<39.8.0`) | **주 내보내기 경로**(흙토람 업로드 파일·접수대장·백업)가 이 대화상자를 탄다. 스모크 ⑥ |
| contextBridge: VideoFrame 프로토타입(39.8.0), prototype setter 무시·`Function.prototype.bind` 탈취 차단(GHSA, `<39.8.9`) | preload는 화살표 함수만 노출하고 값은 `invoke` 결과다. 렌더러의 `.bind`·`.call` 사용은 전달 경로에 없다 → 영향 없음 예상. 스모크 ④로 IPC 왕복 확인 |
| 권한·디바이스 핸들러가 subframe origin을 받음 (39.8.1) | 핸들러를 등록하지 않는다 → 무관 |
| HTTP 리다이렉트 → 로컬 파일 로더 차단 (GHSA, `<39.8.8`) | 리다이렉트로 file://에 가지 않는다 |
| window.open features·named target 제한 (GHSA, `<39.8.5`·`<39.8.8`) | `setWindowOpenHandler`가 항상 deny |
| 커스텀 프로토콜 CORS (39.8.10) | `protocol.handle` 미사용 |
| 프로토콜 클라이언트명 RFC 3986 검증 (39.8.1) | `setAsDefaultProtocolClient` 미사용 |
| `autoUpdater.quitAndInstall` macOS 수정 (39.8.1), Squirrel.Mac (39.5.2·39.8.10) | 내장 autoUpdater 미사용, mac 피드 없음 |
| macOS 다이얼로그 패키지 필터 (39.4.0) | 파일 대화상자는 xlsx/json 필터 — 스모크 범위 밖, Windows 무관 |
| 자식 창 닫은 직후 메시지 박스 → 부모 창 멈춤 수정 (39.8.1, Windows) | 팝업 창(흙토람·퇴비) 이후 `dialog.showMessageBox` 경로가 있다면 오히려 개선 |
| Node 22.22.0·22.22.1 (보안 릴리스) | 메인은 `node:http`·`node:https`·`fs`. juso·vworld(`node:https`)는 스모크에서 `.env`가 비어 태울 수 없다 → **못 한 검증** |
| `window.print()` (라벨) | 변경 항목 없음. 스모크 범위 밖 |
| fuses (`@electron/fuses`) | 같은 메이저라 fuse 스키마 동일(추론). 스모크 ⑦에서 `npx @electron/fuses read`로 실측 |

## 검증

- `npm ci` 성공 · `npm ls electron` = 39.8.10 · `npm audit`의 electron `via`에 GHSA 직접 advisory 0건(extract-zip 경유만 남음)
- `npm run build` · `npm run test:unit`(925) · `npm run lint`(0 errors) · `npx playwright test --reporter=line`(496)
  - **E2E는 docs/를 http로 돌려 electron을 쓰지 않는다** — 런타임 교체의 신호가 없다. 회귀 없음 확인용일 뿐이다
  - vite 빌드는 electron 버전과 무관해 `docs/` 산출물 diff가 없어야 정상이다(배지 날짜만 바뀌면 되돌림). 방향 문서의 "docs/ 재빌드"는
    검증 목적이며, diff가 생기면 원인을 적는다

### mac 패키징 스모크 (실제 신호)

1. `.env`·`feedback-auth.json`이 없으면 빈 자리표시(`''`, `{}`)로 만든다 → `npx electron-forge package` → 끝나면 자리표시·`out/` 삭제
2. 실사용 폴더 `~/Library/Application Support/토양 시료 접수 대장`을 실행 **전에** `cp -Rp`로 스크래치에 백업하고, 파일 목록(경로·크기·mtime)을 전후 비교한다. 백업에는 농업인 개인정보가 있으므로 비교가 끝나면 스크래치에서 삭제한다
3. **바이너리를 직접** 실행한다(`open -a`는 인자를 버린다):
   `VITE_DEV_SERVER_URL=http://127.0.0.1:1 out/…/soil-sample-log.app/Contents/MacOS/soil-sample-log --user-data-dir=<임시> --remote-debugging-port=<포트> --use-mock-keychain`
   - `VITE_DEV_SERVER_URL`: 패키징 앱도 dev 서버를 먼저 시도한다(`src/index.js:358-372`) — 다른 워크트리의 `npm run dev`에 붙으면 file:// 경로를 안 탄다
   - `--use-mock-keychain`: `EnableCookieEncryption` 때문에 키체인 "Safe Storage" 항목은 user-data-dir과 무관하게 공유된다. 실사용 앱의 키체인 항목에 손대지 않고 접근 확인 창도 막는다(쿠키 암호화 경로 자체는 검증 범위 밖)
4. 합격 조건:
   - ① 번들 `Electron Framework` Info.plist 버전 = 39.8.10, 렌더러 `navigator.userAgent`의 `Electron/39.8.10`
   - ② 로그 `[App] 빌드된 파일에서 로드`, `location.href`가 `file://`. `업데이트 확인 중...` 후 `latest-mac.yml` **HTTP 404**로 종료(DNS·TLS 오류가 아님), 메인 프로세스 오류 없음
   - ③ **헤더 CSP 적용**: 모든 페이지에 meta CSP가 있어 `eval` 차단만으로는 헤더 유무를 가를 수 없다(플랜 리뷰가 39.2.6으로 재현).
     헤더에만 있는 신호 두 가지로 본다 — (a) `securitypolicyviolation` 리스너를 건 뒤 `eval('1')` → 수백 ms 기다린 뒤 위반 이벤트 **2건**(주 기준). 보조 기준으로 그중 하나의
     `originalPolicy`가 `upgrade-insecure-requests;`로 끝남 (b) `document.featurePolicy.allowsFeature('camera') === false`(`Permissions-Policy`는 헤더로만 온다)
   - ④ **IPC 왕복**: `window.electronAPI.getVersion()` = `package.json` 버전, `getAppPath()` = 임시 user-data-dir
   - ⑤ **will-navigate·팝업**: 메인 → soil 페이지 링크 이동 후 URL이 `docs/soil/…`이고 `electronAPI`가 있다. `openHeuktoram()`으로 팝업 창을 띄워 두 번째 CDP 대상이 file://로 뜬다. 이동한 페이지에서도 ③(a)가 성립
   - ⑥ **다운로드 저장 대화상자**: 설정 → `exportAllBtn`(백업) → 내장 저장 대화상자가 뜨고, 임시 폴더에 저장해 파일이 생긴다. `Browser.setDownloadBehavior`로 대화상자를 건너뛰지 않는다(검증 대상 경로를 우회한다). 대화상자 조작은 손쉬운 사용 권한이 있을 때만 osascript 또는 `computer-use`로 한다(권한 요청 창을 띄우지 않는다). 권한이 없으면 최소 신호로 "클릭 뒤 앱이 살아 있고 CDP로 렌더러가 응답한다"를 본다 — 이 GHSA는 use-after-free라 크래시로 드러난다. 저장 완료를 못 보면 **못 한 검증**으로 보고한다
   - ⑦ `npx @electron/fuses read --app <.app>` — fuse 6개가 `forge.config.js:77-85`대로 뒤집혀 있다
   - 콘솔에 ③ 외의 CSP 위반·오류 없음
5. `process.versions.electron`은 sandbox 렌더러에서 안 보이므로 ①의 두 경로로 갈음한다

Windows 실기(설치·자동 업데이트·자동저장 폴더·다운로드)와 juso·vworld 조회는 이 환경에서 불가 — **못 한 검증으로 보고한다.**

## 릴리스 권고 (결정은 사용자)

전제: electron-updater 6.8.9는 v1.14.17 설치본에 이미 들어 있고, **v1.14.18의 다운로드와 설치 파일 실행은 사용자 PC에 이미 깔린
v1.14.17(= 6.8.9 + electron 39.2.6)이 한다.** 다만 Squirrel이 설치를 마무리할 때 새로 깔린 실행 파일(= 39.8.10)을 `--squirrel-updated`로
띄우고(`src/index.js:74` `electron-squirrel-startup`), 그다음 첫 실행도 39.8.10이다 — 설치 훅과 첫 실행은 새 런타임이 맡는다.

| 증상 | 원인 판별 |
| --- | --- |
| 사용자가 v1.14.17에 머문다 (앱은 뜨고 버전이 그대로) | 업데이터 6.8.9 (런타임 무관) |
| 업데이트 후 앱이 뜨지 않는다 | 버전 번호를 볼 수 없다. `%LOCALAPPDATA%\soil-sample-log\app-1.14.18\` 폴더가 있으면 설치는 됐고 런타임 39.8.10 쪽, 없으면 업데이터 쪽. `SquirrelSetup.log` 확인 |
| v1.14.18로 올라왔는데 앱이 이상하다 | 런타임 39.8.10 |

앱이 뜨면 버전 번호로, 뜨지 않으면 설치 폴더로 두 원인이 갈린다. 따라서 **합쳐 내도(v1.14.18 = electron) 원인 분리는 가능하다.**
6.8.9가 39.8.10 위에서 처음 도는 것은 **그다음** 업데이트이고, 이것은 A·B 모두 같다.

**롤백은 새 릴리스뿐이다.** electron-updater는 기본적으로 다운그레이드하지 않으므로 되돌리려면 electron 39.2.6으로 v1.14.19를 새로 내야 하고,
그것은 39.8.10 위의 업데이터가 정상이어야 받아진다. 39.8.10에서 앱이 뜨지 않으면 업데이터도, 공지 팝업(SLS-1-219)도 돌지 않아
**수동 재설치 안내만 남는다.** 이 위험은 릴리스를 나눠도 electron이 나가는 릴리스에서 똑같이 생긴다 — 그래서 태그 전 Windows 확인이 중요하다.

**태그 전 Windows 확인 방법**: `package.json` 버전을 1.14.18로 올리고 `src/release/index.html`에 1.14.18 항목을 함께 넣은 브랜치에서(없으면 `extract-whatsnew`가 빌드를 실패시킨다, `scripts/extract-whatsnew.js:88`·`:147`) `build.yml`의 `workflow_dispatch`(`build.yml:7`)로 돌리면 릴리스 없이
artifact(`build.yml:87-91`)만 나온다. 그 setup.exe를 v1.14.17이 깔린 PC에 수동 설치해 실행·자동저장·내보내기를 본다.
이 확인은 **런타임과 Squirrel 설치 훅만** 검증하고 6.8.9 자동 업데이트 경로는 검증하지 않는다.
그 PC에는 정식 v1.14.18이 같은 버전이라 업데이트로 오지 않는다 — 태그 후 정식 setup.exe로 다시 설치하거나 실사용 PC가 아닌 PC로 확인한다.

- **권고 A (합침, 권장)**: v1.14.18에 이 티켓**만** 넣는다(다른 기능 변경 동봉 금지). 태그 전 Windows PC 1대에서 v1.14.17 → v1.14.18
  수동 설치·실행 확인을 권한다. 보안 수정(Dependabot 32건)이 한 릴리스 빨리 나간다.
- **권고 B (분리)**: v1.14.18을 electron 없이 내 6.8.9 첫 설치를 먼저 확인하고 v1.14.19에 electron. 원인 분리는 완전하지만
  high 8건 해소가 한 주기 늦어진다. 권고 A 대비 추가로 얻는 판별력은 작다.

이 티켓은 태그·릴리스를 하지 않는다(코디네이터 소관).
