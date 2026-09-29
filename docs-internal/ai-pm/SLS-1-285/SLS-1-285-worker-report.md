# SLS-1-285 워커 보고 — electron 39.2.6 → 39.8.10

브랜치 `bluesky78060/sls-285-electron` · 커밋 `e3fe0cb`(의존성 + 플랜·스모크) + 리뷰 반영 커밋(이 보고서 포함) · push·태그 없음
AI PM SLS-1-285 = **done** (2026-09-29 approve_review)

## 요약

electron을 39.8.10으로 정확 고정했다(`package.json`, lock은 `node_modules/electron` 한 항목 + 루트 devDependencies 문자열). 검증은 전부 통과했고, 3중 리뷰(code-reviewer·codexa·critic)가 의존성 변경 자체에서 찾은 결함은 0건이다.
지적은 모두 문서 정확도에 관한 것이라 `docs-internal/`에서 고쳤다. 남은 것은 Windows 실기 확인과 릴리스 방식 결정(사용자)이다.

## 수치

| 항목 | 결과 |
| --- | --- |
| `npm ls electron` | 39.8.10 (바이너리 Info.plist·프레임워크 문자열 `Electron/39.8.10`도 critic이 확인) |
| lock 전수 JSON 비교 | `(root)` + `node_modules/electron` — 그 밖 변화 0 |
| `npm audit` | electron `via: ["extract-zip"]`만 (GHSA 직접 advisory 0). extract-zip은 electron postinstall 전용, 설치본에 없음. audit 전체 exit 1은 electron 외 개발 도구(SLS-1-287 범위) |
| Dependabot 열린 electron 알림 | **32건**(high 8 / medium 18 / low 6), 전부 `first_patched_version` ≤ 39.8.10 → 병합 후 모두 닫힐 것 |
| build | 성공, `docs/` diff 없음 |
| unit | 925 passed (60 files) |
| lint | 0 errors / 6 warnings |
| E2E | 496 passed (3.3m, 재실행 없음) |
| mac 패키징 스모크 | 통과 — `SLS-1-285-smoke.md` (창 표시, file:// 로드, `업데이트 확인 중...` → latest-mac.yml 404, 헤더 CSP·IPC·will-navigate·팝업·다운로드 저장 대화상자·fuses, 실사용 폴더 무변경) |

## 리뷰

| 라운드 | 레인 | 판정 | C / M / m / S |
| --- | --- | --- | --- |
| 플랜 1R·2R | critic | REVISE → APPROVE | 0/3/8/2 → 0/0/3/2 |
| 코드 1R | code-reviewer (Opus) | APPROVE | 0/0/4/4 |
| 코드 1R | codexa | APPROVE | 0/0/1/1 (원문 `review-codex-r1.md`, 5,336B) |
| 코드 1R | critic 적대적 검증 | ACCEPT (반증 0/6) | 0/0/4/1 |
| 코드 2R | code-reviewer (Sonnet, 수정본) | 지적 반영 | 0/0/1/1 |

상세: `SLS-1-285-code-review.md`

## ⚠️ 정정 — 알림 수

티켓 제목·본문과 커밋 `e3fe0cb` 메시지의 "17건(high 5, medium 8, low 4)"은 Dependabot 1차분(#10~#28)만 센 것이다. 실제 열린 electron 알림은 #65~#79를 더한 **32건**이다(`gh api …/dependabot/alerts`).
**SLS-1-287 본문의 "35건 중 electron 17건을 뺀 18건"도 같은 계산이라 다시 셀 필요가 있다.**

## 사용자 결정 — 릴리스 방식 (플랜 §릴리스 권고)

- **권고 A (합침, 권장)**: v1.14.18에 이 티켓**만** 넣는다. 태그 전 Windows PC 1대에서 v1.14.17 → v1.14.18 수동 설치·실행을 확인한다.
  방법: `workflow_dispatch` artifact 사용. 버전과 릴리스 노트 항목을 먼저 넣어야 한다.
  - 원인 판별: 앱이 뜨면 버전 번호로 가른다. 앱이 뜨지 않으면 `%LOCALAPPDATA%\soil-sample-log\app-1.14.18\`이 있는지와 `SquirrelSetup.log`로 가른다.
  - 주의: v1.14.18의 다운로드·실행은 기존 v1.14.17(6.8.9 + 39.2.6)이 한다. 설치 훅(`--squirrel-updated`)과 첫 실행은 39.8.10이 맡는다(2R에서 정정).
- **권고 B (분리)**: v1.14.18은 electron 없이 내 6.8.9 첫 설치를 먼저 보고, v1.14.19에 electron을 넣는다. high 8건 해소가 한 주기 늦어지고, 추가로 얻는 판별력은 작다.
- **롤백은 새 릴리스로만 가능하다.** 되돌릴 때는 `git revert e3fe0cb`를 쓰지 않는다. 이 커밋에 SLS-1-285 문서도 들어 있어 함께 지워진다. `package.json`·`package-lock.json`만 되돌린다.

## 못 한 검증

- Windows 실기: Squirrel 설치·`--squirrel-updated` 훅, 자동 업데이트, 자동저장 폴더, 파일 대화상자, 다운로드
- mac에서도 돌리지 않은 것:
  - IPC 저장 대화상자(`saveFileDialog` → `write-file`)와 자동저장 쓰기
  - 흙토람 팝업 창의 콘솔 수집
  - juso·vworld 조회(`node:https`, `.env` 빈 자리표시)
  - `window.print()`
  - 쿠키 암호화(`--use-mock-keychain`)
- 스모크 원출력(JSON·로그)은 1차 워커가 저장하지 않았다. 표는 실행 당시의 요약이다.

## 후속 권고 (이 티켓 소유 범위 밖, 발행은 코디네이터)

1. **[MAJOR, 기존 코드] 설치본도 `http://localhost:3000`을 먼저 로드한다.** `app.isPackaged` 가드가 없다(`src/index.js:82`·`:358-372`·`:625-634`).
   - 결과: 사용자 PC에서 3000번 포트를 쓰는 무엇이든 메인 창과 팝업에 로드된다. 그 페이지에도 preload `electronAPI`(readFile·writeFile·saveAuthFile 등)가 노출되고, 헤더 CSP는 file://에만 붙는다.
   - 확인: 코드로만 했다. 실제로 재현하지는 않았다.
2. 39.x는 지원 종료다. 메이저 이전(40.10.3+)을 권한다. extract-zip 경유 audit 항목도 이때 사라진다.
3. 작은 것들:
   - `autoUpdater.checkForUpdatesAndNotify()`(`src/index.js:485`)에 `.catch`가 없다. 오프라인이면 Windows에서도 UnhandledPromiseRejection이 난다.
   - `forge.config.js`에 `ignore`가 없어 `docs-internal/`·`tests/`·`.claude/`가 asar에 실린다(asar 미확인).
   - CI가 `npm ci`가 아니라 `npm install`을 쓴다(`build.yml:30`).
