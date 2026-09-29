# SLS-1-287 코드리뷰

> 정본. 훅 통과용 사본은 `docs/03-code-review/`.

대상: `package.json`(overrides `tar`·`tmp`, devDependencies 하한 3개), `package-lock.json`. `src/`·`docs/` 변경 없음.

## 판정

| 레인 | 판정 | CRITICAL | MAJOR | MINOR | SUGGESTION |
| --- | --- | --- | --- | --- | --- |
| `code-reviewer` (Claude Opus) | APPROVE | 0 | 0 | 2 | 2 |
| `codexa` (gpt-5.6-luna, 슬롯 a5 — a1~a4 한도 승계) | APPROVE | 0 | 0 | 0 | 1 |
| **합계** | **APPROVE** | **0** | **0** | **2** | **3** |

codexa 원문: `review-codex-r1.md` (2,903바이트, exit 0).

## 리뷰어가 독립 재현한 것

- 플랜 절차를 HEAD lock에서 scratch로 다시 실행 → 최종 lock이 작업본과 바이트 동일, npm 10 두 번째 실행 멱등. npm 10.9.8 arborist 크래시도 재현.
- lock 전 항목 비교: 추가 8 / 삭제 11 / 변경 66, 전부 `dev`, **prod 0**, 플래그 변화 0. `resolved` 호스트는 registry.npmjs.org 외 2건(@electron/node-gyp git, xlsx cdn)뿐이며 HEAD부터 있던 것.
- `npm ci --dry-run`·`npm ls --package-lock-only --all` exit 0.
- Dependabot 열린 알림 88건을 새 lock과 semver 대조 → 범위 안 54건 중 잔존 vite 3·esbuild 1.
- tar 7: require하는 곳은 `@electron/node-gyp/lib/install.js:217,240`, `@electron/rebuild/lib/clang-fetcher.js:134`뿐, export·옵션·스트림 계약 호환. tmp 0.2.7: `external-editor/main/index.js:131` `tmpNameSync({postfix})` 한 곳.

## 지적과 처리

| # | 출처 | 심각도 | 지적 | 처리 |
| --- | --- | --- | --- | --- |
| 1 | code-reviewer | MINOR | 플랜 사전조사 2번이 vitest 하위 변화를 "패치"로 축소 기술(rolldown·lightningcss·@oxc-project/types는 마이너) | 플랜 문구 정정 |
| 2 | code-reviewer | MINOR | 검증표의 `electron-forge package`에 증거 로그 없음 | 리뷰 시점엔 실행 전이었다. 이후 실행해 `evidence/forge-package.txt`(exit 0) 추가 |
| 3 | 두 레인 | SUGGESTION | 전역 override 대신 소비자별 scoped override | **채택 안 함.** 기존 overrides 3개가 전역 형식이고, 부작용은 플랜 「남는 것」에 기록돼 있다. 바꾸면 lock 재해석·재검증이 필요한데 이득은 가정적이다 |
| 4 | code-reviewer | SUGGESTION | 게시 4~5일 된 버전(undici 7.30.0, rolldown 1.2.11, vite 8.3.1 — 모두 dev) 쿨다운 정책 | 코디네이터 판단 사항으로 보고서에 넘김 |

코드(package.json·lock)는 리뷰 뒤 바뀌지 않았다 — 처리는 문서 정정과 증거 추가뿐이라 재리뷰하지 않았다.

## 검증 결과 (`evidence/`)

| 항목 | 결과 |
| --- | --- |
| `npm ci` (npm 10.9.8) | 성공, `npm ls --all` exit 0 |
| `npm audit` | 49 (c1/h38/m5/l5) → **24 (c0/h23/m1/l0)** |
| `npm audit --omit=dev` | 0 |
| Dependabot 비-electron 56건 | 50 해소, 잔존 6 = vite 3·esbuild 1(메이저 필요) + extract-zip 2(범위 밖, 수정본 없음) — `dependabot-mapping.txt` |
| `npm run build` | 성공, `docs/`·`src/` git diff 0 (manual 배지 포함) |
| unit / lint | 925/925 · 0 errors, 6 warnings |
| E2E | 496/496 (재실행 없음) |
| `npx electron-forge package` | 성공(darwin-arm64), 자리표시 `.env`·`feedback-auth.json`과 `out/` 삭제 |
| tar/tmp 스모크 | node-gyp 호출 형태 그대로 file·stream·`tar.x` 통과, `ExternalEditor({postfix})` 생성·정리 통과 |
| node-gyp 실경로 | `@electron/node-gyp install --target=39.8.10` → 헤더 tarball 다운로드·체크섬·tar 7 해제, 파일 125개 |
| concurrently·wait-on | 9.2.4 / 9.0.4(joi 18.2.9) 스모크 exit 0 |

## 못 한 검증

- Windows CI(`build.yml` `npm install` → `npm run make`): push 금지라 불가. 병합 후 `workflow_dispatch` 또는 다음 태그에서 확인 필요.
