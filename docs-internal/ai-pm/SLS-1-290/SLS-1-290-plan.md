# SLS-1-290 플랜

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

작성: 2026-09-30 · 근거: `SLS-1-290-direction.md`

## 1. 업데이트 확인 `.catch`

`src/index.js` `autoUpdater.checkForUpdatesAndNotify()` → `.catch(() => {})` + 한 줄 주석(실패는 `'error'` 이벤트 핸들러가 이미 기록 — 중복 로그를 남기지 않는다).
근거: v1.14.17 mac 스모크에서 `'error'` 핸들러 로그(「업데이트 파일 없음 (정상)」)와 `UnhandledPromiseRejectionWarning` 이 함께 찍혔다 — 같은 실패가 두 길로 나온다.

## 2. asar 최상위 허용 목록

`packagerConfig.ignore` 에 함수: 최상위가 `package.json`, `src`, `docs`, `node_modules` 가 아니면 제외.

```js
const ASAR_KEEP = new Set(['package.json', 'src', 'docs', 'node_modules']);
ignore: (p) => { if (!p) return false; const top = p.split('/')[1]; return !ASAR_KEEP.has(top); },
```

- 차단 목록이 아니라 **허용 목록**: 저장소에 새 도구 폴더(graft 처럼)가 생겨도 자동으로 빠진다.
- `src/` 는 통째로 둔다(18MB). 메인이 쓰는 건 3개 파일이지만, 새 메인 파일이 추가됐을 때 빠지면 설치본이 뜨지 않고 복구가 자동 업데이트로 안 된다. 절약보다 이 위험이 크다.
- `.env`·`feedback-auth.json` 은 asar 에서 빠지고 extraResource(`resources/`) 사본을 읽는다 — `index.js` 의 후보 순서가 이미 그렇다.
- electron-packager 의 `ignore` 함수는 앱 루트 기준 `/…` 경로를 받는다. 빈 문자열(루트)은 제외하면 안 된다. 기본 제외(out 디렉터리, `.git` 등)와의 관계는 구현 시 packager 소스로 확인한다.

## 검증

- 정적 유닛 `tests/unit/asar-keep.test.js`: `src/index.js`·`preload.js` 의 `path.join(__dirname, '..', X)` 최상위 `X` 가 허용 목록에 있거나, 같은 파일에 `process.resourcesPath` 폴백이 있는지. 상대 require(`./…`)는 모두 `src/` 안인지. `forge.config.js` 의 허용 목록을 require 해서 비교.
- 변이: 허용 목록에서 `docs` 를 빼면 유닛이 죽는지.
- mac 패키징 전후: asar 항목 수·크기·최상위 목록 비교(목표: package.json·src·docs·node_modules 만).
- mac 스모크(임시 user-data-dir): 창이 docs 로 뜨고, 흙토람 팝업, `업데이트 확인 중...` → latest-mac.yml 404 → `UnhandledPromiseRejectionWarning` **없음**. 게시판 설정 IPC(`read-feedback-config`)가 resources 사본을 읽는지.
- build / unit / lint / E2E.
- 못 하는 것: Windows 설치·Squirrel.

## 플랜 리뷰 1R 반영 (critic APPROVE 조건부, MINOR 4 · SUGGESTION 3)

- **1. `.catch` 의 범위**: 확인 실패 경로만 막는다. 다운로드 실패 경로는 위 「잔여」. 한 줄 주석에 그렇게 적는다.
- **2. 효과 표기**: 크기 수치는 로컬 기준. 성공 기준은 「asar 최상위가 `package.json`·`src`·`docs`·`node_modules` 4개」.
- **3. 테스트는 행동으로**: `forge.config.js` 를 require 해 `packagerConfig.ignore` 를 직접 호출한다(허용 목록 상수를 export 하지 않는다).
  `''`→false, `/package.json`·`/src/index.js`·`/node_modules/firebase/x`·`/docs/index.html`→false, `/docs-internal/a`·`/graft`·`/.env`·`/tests/x`·`/.omc`→true.
  정적 검사는 `path.join`·`path.resolve` 의 `__dirname, '..', X` 를 모두 잡아 `X ∈ 허용 목록 ∪ extraResource basename` 인지 본다.
- **4. 스모크의 게시판 설정**: 식별 가능한 더미 `{"_probe":"resources"}` 로 패키징하고 `electronAPI.readFeedbackConfig` 결과로 resources 사본을 읽는지 확인한다.
- **S-1 채택**: 함수는 기본 제외가 사라지므로 락파일·`.o`·`node_gyp_bins` 를 함수 안에서 복원한다(지금 영향 0, 네이티브 의존성이 생길 때의 패키징 실패 방지).
- **packager 계약 확정**(리뷰가 소스로 확인): 경로는 `/…` 형식·Windows 는 `/` 로 정규화, 루트는 `''` 라 `if (!p) return false` 필요, out/ 은 별도 필터가 먼저 거른다, 사용자 함수를 주면 기본 제외 목록은 사라지지만 forge 의 afterCopy 가 `.bin` 을 지운다.
- **S-2 (Windows 사전 확인)**: 태그 전 `workflow_dispatch` 로 아티팩트만 만들어(Release 는 태그에서만) nupkg 안 `app.asar` 의 최상위와 `resources/.env`·`feedback-auth.json` 동봉을 확인할 수 있다 — 릴리스 때 권한다.
