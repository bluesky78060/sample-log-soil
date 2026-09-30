# SLS-1-290 코드 리뷰 — 2레인 + 반증 + 수정본 재리뷰

> 정본. 훅 통과용 사본은 `docs/03-code-review/`.

2026-09-30 · 대상: `forge.config.js`(asar 허용 목록), `src/index.js`(`.catch`), `tests/unit/asar-keep.test.js`(신규)

## 결과

| 라운드 | 레인 | 판정 | C / M / m / S |
| --- | --- | --- | --- |
| 1 | codex (`codexa`) | APPROVE | 0 / 0 / 0 / 0 — `review-codex-r1.md` |
| 1 | code-reviewer (Opus) + 반증 13후보 | APPROVE (반증 성공 0) | 0 / 0 / 2 / 3 |
| 2 (수정본) | codex (`codexa`) | APPROVE | 0 / 0 / 0 / 0 — `review-codex-r2.md` |

허용 목록이 런타임 파일을 빼는 경로는 찾지 못했다: 메인 require 는 electron·node:*·electron-updater·electron-squirrel-startup·`./dev-server-probe` 뿐, `__dirname` 참조는 docs·preload·`.env`·`feedback-auth.json`(둘 다 `resourcesPath` 폴백), 렌더러는 `docs/` 밖을 가리키지 않는다, `\.o(bj)?$` 는 packager 기본값과 한 글자도 다르지 않다, Windows 경로는 packager 가 `/` 로 정규화한다.

## 1라운드 MINOR → 반영 (모두 테스트의 사각지대)

1. 정적 검사가 「extraResource 에 있다」만으로 통과 — `__dirname/../X` 는 `resources/X` 가 아니라 `app.asar/X` 를 가리킨다 → 같은 파일의 `resourcesPath` 폴백을 요구.
2. 스캔 대상이 파일 3개·작은따옴표 분리 인자에 고정 → `main`·preload 에서 상대 require 를 따라가 파일 집합을 만들고, join/resolve·세 종류 따옴표·`'../x'` 합친 형태를 매칭.
- SUGGESTION 반영: 기본 제외 복원에 `.git`·`node_modules/.bin`·`pnpm-lock.yaml`·`.obj` 추가, 정상 파일 오탐 경계 테스트, 스모크 원자료를 `smoke/` 에 저장.
- 재현 변이 7종(위 시나리오)이 모두 새 테스트에 걸렸다. 1라운드 변이 8종과 합쳐 15종.

## 검증

- asar 최상위 `{docs, node_modules, package.json, src}` 4개, 제외 규칙에 걸린 항목 0 (`smoke/asar-top-level.json`). 로컬 224MB → 172MB — **로컬 기준이며 실제 배포본에서는 약 4MB(2%)**.
- mac 스모크(임시 user-data-dir): 창·팝업 `file://…/docs/`, `.env` 는 `Resources/.env`, `readFeedbackConfig` 는 resources 사본(`smoke/feedback-probe-output.json`), `업데이트 확인 중...` → latest-mac.yml 404, UnhandledPromise 0(`smoke/app-log-excerpt.txt`). 실사용 데이터 폴더 변경 없음.
- build / unit 972 / lint 0 errors / E2E 496(수정 전 코드, 이후 변경은 forge 정규식·테스트뿐이라 unit·build·재패키징으로 갈음).
- 못 한 것: Windows 실기(설치·Squirrel). 태그 전 `workflow_dispatch` 로 아티팩트를 만들어 nupkg 안 `app.asar` 최상위를 확인하도록 권한다(Release 는 태그에서만 생성).

## 알려진 잔여

- 다운로드 실패 거부는 `checkForUpdatesAndNotify` 내부 파생 Promise(`electron-updater/out/AppUpdater.js:294`)라 이 `.catch` 로 닿지 않는다. 막으려면 OS 알림이 사라지는 UX 변화가 필요해 하지 않았다.
- 거부 값이 null 이면 'error' 이벤트 없이 삼켜진다(리뷰어 LOW 확신, 실제 가능성 거의 없음).
