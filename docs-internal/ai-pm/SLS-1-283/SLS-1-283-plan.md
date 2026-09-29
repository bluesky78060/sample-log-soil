# SLS-1-283 플랜 — 프로덕션 의존성 취약점 6건

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

작성: 2026-09-28 · 근거: `SLS-1-283-direction.md` · 개정: 플랜 리뷰 1R(REVISE, MAJOR 2) 반영

## 대상과 목표 버전

| 패키지 | 현재 | 취약 범위 | 목표 | 방법 |
| --- | --- | --- | --- | --- |
| `electron-updater` (직접) | 6.6.2 | 2.9.0–6.8.8 | **`"6.8.9"` 정확 고정** | 자동 업데이트 채널이라 `^`를 두지 않는다 |
| └ `builder-util-runtime` | 9.3.1 | <9.7.0 | 9.7.0 | updater 6.8.9가 정확히 `9.7.0`을 요구 |
| └ `sax` | 1.4.3 | — | 1.6.1 | 위 교체 때 재해석됨(취약점 아님). atom 파서라 적어 둔다 |
| └ `js-yaml` | 4.3.0 | 4.0.0–4.3.1 | ≥4.3.2 | `overrides` `^4.3.2`. 4.3.0이 이미 `^4.1.0`을 만족해 **저절로는 안 오른다** |
| `dompurify` (직접) | 3.4.11 | ≤3.4.12 | **3.4.15** (`^3.4.15`) | 3.4.16은 09-23 출시(5일) — 6.8.10을 피한 기준과 같게 |
| `websocket-driver` (firebase 경유) | 0.7.4 | ≤0.7.4 | 0.7.5 | `overrides` `^0.7.5` |
| `protobufjs` (firebase 경유) | 7.6.4 | 7.5.0–7.6.4 | ≥7.6.5 | 기존 override `^7.6.1` → `^7.6.5` |

- `electron-updater` 6.8.10(2026-09-26)은 이틀 된 것이라 6.8.9(06-05)로 둔다.
- `firebase` 자체는 올리지 않는다. websocket-driver·protobufjs는 firebase의 Node 전용 경로라 렌더러(vite 브라우저 빌드)와 메인 프로세스 어디서도 실행되지 않는다(플랜 리뷰 확인). asar에 실리므로 올린다.
- 하한·override를 쓰는 이유: CI는 `npm install`이라 lock이 어긋나면 재해석한다.

## lockfile 동기화 — 실제 명령

```bash
npm install --package-lock-only                 # 1. 기존 lock을 package.json에 맞춘다
# package.json overrides: js-yaml ^4.3.2, websocket-driver ^0.7.5, protobufjs ^7.6.5
npm install --save-exact electron-updater@6.8.9 # 2. 대상만 올린다
npm install dompurify@3.4.15
rm -rf node_modules && npm ci                   # 3. 동기화 확인
npm audit --omit=dev                            #    = 0
```

lockfile을 지우고 새로 만들지 **않는다**. 설치 패키지 953개(lock 항목 1056개)가 전부 범위 안 최신으로 바뀐다.

**예상 lock diff**(리뷰 스크래치 재현): 1단계 = dev optional 약 33개(vitest 아래 esbuild 0.28.1→0.28.2, `@emnapi/*`) + 루트 version. 2단계 = 위 표 7개. 그 밖의 프로덕션 패키지가 바뀌면 멈추고 원인을 본다.

## electron-updater 6.6.2 → 6.8.9 코드 검토 (앱이 쓰는 경로)

앱 설정: `provider: 'github'`, 공개 저장소, 토큰 없음, `allowPrerelease` 기본값(false), `autoDownload`, `autoInstallOnAppQuit`.

| 변경 | 우리 영향 |
| --- | --- |
| GitHubProvider 태그 정규식 `v?` 허용, semver 아닌 태그 건너뜀 | 정식 버전 경로는 github.com `/releases/latest`(Accept: json)를 쓴다. 태그 `v1.14.x`는 유효한 semver |
| 차등 다운로드: 새 blockmap 먼저, 옛 blockmap은 캐시 우선 | 릴리스에 `.blockmap`이 없다 → 실패 → `catch`에서 `return true` → 전체 다운로드. 호출이 모두 `try` 안(`AppUpdater.js:644-711`) |
| 다운로드 파일명 `path.basename` | 경로 탈출 차단. `setup.exe` 무관 |
| `BaseUpdater` PATH 정제, Linux sudo 제거 | Windows 경로 무관 |
| NsisUpdater | 오류 문구만. `doInstall` 인자 `["--updated"]` 그대로 |
| `verifySignature` | `publisherName`이 없으면 건너뜀 — `app-update.yml`에 없다 |
| sha512 판별 | `latest.yml`은 hex(CI `.ToLower()`). 9.7.0 `httpExecutor.js`에 hex 판별 유지 |
| `builder-util-runtime` 9.7.0: 교차 출처 리다이렉트에서 `Authorization` 제거 | 토큰을 안 써 실노출은 없었다 |

플랜 리뷰가 실제 `releases.atom`·`/releases/latest`·`latest.yml`(CRLF)을 9.7.0 + sax 1.6.1 + js-yaml 4.3.2로 파싱해 태그·버전·파일명이 정상임을 확인했다.

## 검증

- `npm ci` 성공 · `npm audit --omit=dev` = 0
- `npm run test:unit`, `npm run lint`, `npm run build`, `npm test`(E2E)
  - 유닛은 DOMPurify를 목(`tests/unit/setup.js:4-6`, `sanitize: html => html`)으로 바꾸므로 **DOMPurify 신호가 없다.** 실제 신호는 E2E와 빌드 산출물이다.
- 빌드 산출물 `docs/assets/purify.es-*.js`의 `version="3.4.15"`
- **mac 패키징 스모크**: `npm run package` → 패키징된 앱 실행(`app.isPackaged` = true) → 로그에 `업데이트 확인 중...` 후 `latest-mac.yml` 404로 끝나는지. require 시점 로드와 GitHubProvider(atom·sax·latest 태그·리다이렉트)가 Electron `net` 위에서 동작한다는 증거다. asar 안 `electron-updater/package.json` = 6.8.9, resources에 `app-update.yml`.

### ⚠️ 새 업데이터는 이 수정이 나간 **다음 릴리스**에서 처음 돈다

릴리스 N+1(이 수정을 담은 것)은 사용자 PC의 **6.6.2가** 받아 설치한다. 6.8.9의 확인·다운로드·설치는 N+2 때 처음 실행된다. 그때 실패하면 전국 설치본이 N+1에 멈추고 자동으로는 못 고친다. 실패는 `src/index.js:541` `console.error` 한 줄로만 남고, `404`가 든 오류는 537행이 삼킨다.

실패 확률은 위 검토상 낮다. 그래도 **이 티켓은 릴리스 태그를 붙이지 않는다.** 태그 시점과 아래 중 무엇을 할지는 사용자가 정한다.

- (a) 태그 전에 Windows에서 N+1 설치본 → 테스트 릴리스로 업데이트를 돌려 본다. `setFeedURL`이 `src/index.js:67-71`에 하드코딩이라 테스트용 분기가 필요하다
- (b) 위험을 받아들이고, N+2 이후 업데이트가 안 된다는 신호가 오면 공지 팝업(SLS-1-219)으로 수동 재설치를 안내한다

## Dependabot — 알림만 켠다

`gh api -X PUT repos/bluesky78060/sample-log-soil/vulnerability-alerts` 후 alerts API가 403 대신 목록을 돌려주는지 확인한다.

**보안 업데이트(자동 PR)는 켜지 않는다.** dev 취약점 49건과 electron에 대한 PR이 한꺼번에 열릴 수 있는데 PR용 CI가 없다(`build.yml`은 태그용). 웹에서 병합하면 티켓 워크플로와 `docs/` 재빌드를 건너뛴다.

## 배포 경로와 롤백

| 쪽 | 언제 나가나 |
| --- | --- |
| 웹 (GitHub Pages) | 커밋된 `docs/`를 서빙한다. **`docs/`를 다시 빌드해 커밋해야** DOMPurify 수정이 나간다 |
| 설치본 | 릴리스 태그 때. 위 ⚠️ 절 |

⚠️ `docs/` 빌드에는 `src/shared/network-config.js`(gitignore)가 필요하다. 커밋된 `docs/`는 `ALLOWED_GATEWAY:""`로 빌드돼 있다 — 웹에서 Firebase 접근 거부 → 로컬 모드(`network-access.js:23`, `:141`). 예시 파일(`'0.0.0.0'`)을 복사해 빌드하면 **웹판 접근 제어 값이 바뀐다.** 빈 값으로 만들어 빌드하고, 결과 번들에서 `ALLOWED_GATEWAY:""`를 확인한다.

롤백: 커밋을 되돌린다(`package.json`, `package-lock.json`, `docs/`). Dependabot 알림은 `-X DELETE`로 끈다.

## 후속 티켓 후보

- `electron` 39.2.6 → 39.8.10 (high, Windows 실기 필요)
- CI `npm install` → `npm ci` — lock이 다시 어긋나는 것을 막는다
- 개발 의존성 취약점 정리
- override 3개(`js-yaml`·`websocket-driver`·`protobufjs`)는 상위 패키지(electron-updater·firebase)가 올라가면 제거한다. 전역 `js-yaml ^4.3.2`는 나중에 js-yaml@3을 요구하는 의존이 들어오면 4.x를 강제한다 — `"electron-updater": { "js-yaml": … }`로 좁히는 것도 방법
