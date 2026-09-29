# SLS-1-285 코드 리뷰 — electron 39.2.6 → 39.8.10

> 정본. 훅 통과용 사본은 `docs/03-code-review/`.

대상: 커밋 `e3fe0cb`(기준 `90b70d8`) — `package.json`·`package-lock.json`(electron 한 항목) + `docs-internal/ai-pm/SLS-1-285/`. `src/` 무변경.
2026-09-29 · 3중 검증: `code-reviewer`(Opus) + `codexa` 독립 리뷰 + `critic` 적대적 검증(반증 시도)

## 검증 실행 (리뷰 시점, 이 워크트리)

| 항목 | 결과 |
| --- | --- |
| `npm ls electron` | `electron@39.8.10` |
| lock 전수 비교(`smoke/lockdiff.js`, JSON 전체 비교) | `(root)`(devDependencies 문자열) + `node_modules/electron` 39.2.6 → 39.8.10 **두 항목뿐** |
| `npm audit` electron 항목 | `via: ["extract-zip"]`만 (GHSA 직접 advisory 0, `fixAvailable` 44.4.5 메이저). audit 전체는 exit 1 — electron 외 개발 도구 항목(forge·vite 등, 이 티켓 범위 밖) |
| Dependabot 열린 electron 알림 | **32건**(high 8, medium 18, low 6), 전부 `package-lock.json`, GHSA 중복 0, `first_patched_version` 최댓값 39.8.10 |
| `npm run build` | 성공, `docs/` diff 없음 |
| `npm run test:unit` | 60 files / **925 passed** |
| `npm run lint` | **0 errors** / 6 warnings |
| `npx playwright test` | **496 passed** (3.3m, 재실행 없음) |
| mac 패키징 스모크 | `SLS-1-285-smoke.md` (1차 워커 실행) |

## 1R

### code-reviewer — APPROVE (CRITICAL 0 / MAJOR 0 / MINOR 4 / SUGGESTION 4)

lock·integrity·의존성 범위·CI `npm install` 해석을 스크래치에서 재현, 39.2.7~39.8.10 릴리스 노트 20개와 문서의 file:line 인용을 전수 확인.

- MINOR 릴리스 권고 전제 "39.8.10은 v1.14.18 설치에 관여하지 않는다"가 부정확 — Squirrel이 새 실행 파일을 `--squirrel-updated`로 띄운다. "업데이트 후 앱이 안 뜸"은 버전으로 못 가른다
- MINOR 스모크 "콘솔 오류·경고 0"이 수집 범위(메인 창, 연결 후)보다 넓다 — 팝업 콘솔 미수집
- MINOR 업데이트 확인 실패 경고 "mac에만 해당"은 과장 — 네트워크 오류는 Windows도
- MINOR mac에서도 IPC 저장 대화상자·자동저장 쓰기 미실행이 "못 한 검증"에 없음
- SUGGESTION 스모크 스크립트 재현성(단언 없음·포트 하드코딩·원출력 미저장), `docs-internal/`이 asar에 실림(기존), 태그 전 Windows 확인 PC 후속, 인용 `extract-whatsnew.js:91`→`:88`
- 범위 밖 기존 결함(카운트 제외, **별도 티켓 권고**): 설치본도 `http://localhost:3000`을 먼저 로드한다 — `app.isPackaged` 가드 없음(`src/index.js:82`·`:358-372`·`:625-634`). 그 페이지에도 preload `electronAPI`가 노출되고 헤더 CSP는 file://에만 붙는다. 오케스트레이터가 코드로 확인

### codexa — APPROVE (CRITICAL 0 / MAJOR 0 / MINOR 1 / SUGGESTION 1)

원문: `review-codex-r1.md` (5,336바이트). 실행은 exit 1이었지만 리뷰 본문·판정은 온전하다 — codexa가 끝에 슬롯 한도를 감지해 낸 종료코드다.

- MINOR 스모크 "콘솔 오류·경고 0" 과장(위와 같음)
- SUGGESTION CI가 `npm ci`가 아니라 `npm install`(`build.yml:30`) — 지금은 정확 고정이라 무해

### critic 적대적 검증 — ACCEPT (CRITICAL 0 / MAJOR 0 / MINOR 4 / SUGGESTION 1)

주장 6개(lock 단일 변경, audit 직접 advisory 0, 바이너리 39.8.10, 한 커밋 롤백, CSP 헤더 바이트, 스모크 판정)를 명령으로 재현 — **반증 0건**.
CSP 등 헤더 6개 값에 0x20–0x7E 밖 바이트 0(39.8.1 헤더 검증 무관), GitHub advisory DB `affects=electron@39.8.10` 0건, 프레임워크 바이너리 문자열 `Electron/39.8.10`.

- MINOR 알림 수 17 → 실제 32
- MINOR `lockdiff.js`가 version/integrity/resolved만 비교 — "전수 비교" 근거로 부족
- MINOR 스모크 콘솔 주장 과장 / 표 일부(①Info.plist·⑦fuses)는 스크립트 산출이 아님
- SUGGESTION `git revert e3fe0cb`는 이 티켓 문서까지 지운다 — 롤백은 `package.json`·`package-lock.json`만

## 오케스트레이터 판단

MINOR 9건(중복 제외 7건)과 SUGGESTION 중 문서 정정 4건을 반영했다 — **전부 `docs-internal/` 문서·스모크 스크립트이고 `package.json`·lock·`src/`는 그대로**라 빌드·테스트 재실행 대상이 아니다.
`lockdiff.js`는 JSON 전체 비교로 바꿔 다시 돌렸다(결과는 위 표). 반영하지 않은 것: CI `npm ci` 전환·`docs-internal/` asar 제외·`checkForUpdates` `.catch`·localhost:3000 가드 — 모두 기존 코드이고 이 티켓 소유 범위(`src/`·`forge.config.js`·`build.yml` 밖)라 후속 권고로 보고한다.

## 2R — 수정본 재리뷰 (CRITICAL 0 / MAJOR 0 / MINOR 1 / SUGGESTION 1)

`code-reviewer`(Sonnet)가 미커밋 수정본만 재검토했다. codexa는 슬롯 한도라 이 라운드에 쓰지 않았다.
정정한 숫자(32건, high 8/medium 18/low 6)와 인용(`src/index.js:74`·`:485`, `extract-whatsnew.js:88`, 설치 폴더 `soil-sample-log` = `forge.config.js:48` maker-squirrel name)을
직접 확인하고 `lockdiff.js`를 다시 돌렸다. 1R 지적은 전부 닫혔다고 판정했다.

- MINOR `SLS-1-285-plan.md:128` 권고 B에 옛 숫자 "high 5건"이 남음 → "high 8건"으로 정정
- SUGGESTION `smoke/cdp-check.cjs:1` 머리말 "①③④⑤"가 스모크 문서의 "①의 UA·③④⑤"와 어긋남 → 맞춤

둘 다 숫자·주석 한 줄 정정이라 3R은 돌리지 않았다.

## 판정

**APPROVE** — 1R 합계 CRITICAL 0 / MAJOR 0 / MINOR 9 / SUGGESTION 6, 2R CRITICAL 0 / MAJOR 0 / MINOR 1 / SUGGESTION 1, 전부 문서 정정으로 반영.
의존성 변경 자체에 대한 지적은 세 레인 모두 0건.
