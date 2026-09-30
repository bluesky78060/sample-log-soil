# SLS-1-290 방향 — 설치본 정리: 업데이트 확인 .catch · asar 개발 파일

> 정본. 훅 통과용 사본은 `docs/00-discovery/`.

작성: 2026-09-30 · 확정: 사용자 「계속 진행」(발행 시 우선순위 4 티켓, SLS-1-289 다음 순서)

| 카테고리 | 내용 |
| --- | --- |
| 목표 | ① 업데이트 **확인** 실패가 처리되지 않은 Promise 거부로 새지 않게(다운로드 실패 경로는 잔여 — 아래) ② asar 에 실행에 필요 없는 저장소 파일이 실리지 않게 |
| 사용자 | 설치본 사용자 — 동작 변화 없어야 한다. 실제 배포본(추적 파일만)에서 빠지는 것은 약 4MB(2%) — 이 티켓의 가치는 크기가 아니라 로컬 패키징 위생과 앞으로 생길 도구 폴더 차단이다 |
| 범위 | `src/index.js` `checkForUpdatesAndNotify()` 호출부, `forge.config.js` `packagerConfig.ignore` |
| 범위 밖 | `node_modules` 정리(119MB, 대부분 firebase 등 프로덕션 의존성 — 렌더러는 docs/ 번들을 쓰므로 메인에 불필요하지만 의존성 구조 변경이 필요), `src/` 세분(아래) |
| 제약 | asar 에서 빠진 파일을 메인 프로세스가 require 하면 **설치본이 뜨지 않고 자동 업데이트로도 복구 불가** — 보수적으로 뺀다 |
| 리스크 | 위 제약. mac 패키징 스모크로 기동 확인, Windows 는 못 한다 |
| 검증 | 패키징 전후 asar 목록·크기 비교, 스모크(창 로드·업데이트 확인 로그·UnhandledPromiseRejection 사라짐), 정적 테스트 |

## 측정 (2026-09-30, darwin-arm64, 수정 전)

app.asar 224MB, 12,994 항목. 최상위 크기: node_modules 118.8MB · **graft 46.0MB** · docs 33.0MB · src 18.2MB ·
assets 1.7MB · tests 1.1MB · playwright-report 0.9MB · .omc 0.8MB · docs-internal 0.6MB 외 `.claude`, `CLAUDE.md`, `AGENTS.md`,
`mockups`, `test-results`, `.github`, `.githooks`, `.env`, `feedback-auth.json` 등 저장소 전체.
`forge.config.js` 에 `ignore` 가 없어서다. 로컬 패키징이면 `.omc/`(작업 스크립트)까지 들어간다.

메인 프로세스가 실제로 읽는 것: `src/index.js`·`preload.js`·`dev-server-probe.js`, `docs/`, `package.json`,
`node_modules`(electron-updater, electron-squirrel-startup), `.env`·`feedback-auth.json`(asar 사본이 없으면 `process.resourcesPath` 폴백 — extraResource 로 이미 동봉).

> ⚠️ 위 크기는 **로컬 작업트리** 기준이다. `graft/`(46MB)·`playwright-report`·`.omc`·`test-results` 는 추적되지 않는 로컬 산출물이라 CI(`checkout` + `npm ci`) 산출물에는 없다.
> 실제 배포본에서 빠지는 것은 tests 1.1MB · assets 1.7MB · docs-internal 0.6MB · 설정 파일 정도(플랜 리뷰 실측).

## 잔여 (범위 밖으로 기록)

`checkForUpdatesAndNotify()` 는 내부에서 `void downloadPromise.then(...)` 로 거부 핸들러 없는 파생 Promise 를 만든다(`electron-updater/out/AppUpdater.js:294`).
**다운로드 실패**(프록시 차단·SHA 불일치)는 바깥 `.catch` 로 닿지 않아 경고가 남는다. 막으려면 `checkForUpdates()` 로 바꿔야 하고, 그러면 OS 알림이 사라지는 UX 변화가 생겨 이 티켓에서 하지 않는다.
