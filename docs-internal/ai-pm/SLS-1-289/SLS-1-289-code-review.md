# SLS-1-289 코드 리뷰 — 3중 검증 + 수정본 재리뷰

> 정본. 훅 통과용 사본은 `docs/03-code-review/`.

2026-09-29 ~ 30 · 대상: `src/dev-server-probe.js`(신규), `src/index.js`, `tests/unit/dev-server-probe.test.js`(신규), `eslint.config.mjs`

## 결과

| 라운드 | 레인 | 판정 | C / M / m / S |
| --- | --- | --- | --- |
| 1 | codex (`codexa`) | APPROVE | 0 / 0 / 1 / 1 — `review-codex-r1.md` |
| 1 | code-reviewer (Opus) | APPROVE | 0 / 0 / 2 / 5 |
| 1 | critic 적대적 검증 | ACCEPT (반증 후보 12개 중 0) | 0 / 0 / 1 / 0 |
| 2 (수정본) | codex (`codexa`) | APPROVE | 0 / 0 / 1 / 1 — `review-codex-r2.md` |

네 레인 모두 결함 수정 자체는 맞다고 판정했다 — 설치본은 메인·팝업 모두 dev server 를 탐색하지 않고, localhost 이동도 막힌다.
critic: exe 이름 변경·`--remote-debugging-port`(CDP) 우회는 같은 사용자 권한이 필요해 새 능력이 없다. fuse(`forge.config.js:108-113`)가 RunAsNode·NODE_OPTIONS·asar 밖 로드를 막는다. 따라서 주장은 「앱 자신의 코드 경로에서는」으로 한정한다.

## 1라운드 MINOR → 반영

1. (codex) 소켓 timeout 에만 의존해 Promise 가 끝나지 않을 수 있음 → 독립 타이머 + 단일 `finish()`.
2. (code-reviewer) 테스트 주석 제거 정규식이 `'file:///*'` 때문에 `index.js` 416~545행을 지움 → 원문 검사.
3. (critic) 정적 가드가 `isPackaged: app.isPackaged && false`, 키 중복, `|| url.startsWith("http:")` 를 통과 → 괄호 짝 맞춤 인자 추출, `isPackaged` 1회·값 직후 종료, will-navigate 의 `startsWith` 는 file:// 와 DOCS_DIR 만.
4. (code-reviewer·critic) 팝업이 탐색 결과와 무관하게 상수를 허용 origin 으로 씀, `'null'` origin 끼리 같다고 판정 → `popupDevServerUrl`, http/https 한정.
- SUGGESTION 반영: 응답 `res.destroy` 확인, 결함 경위 주석은 커밋 메시지로.

## 2라운드

- MINOR: will-navigate 정적 가드가 `startsWith` 형태만 잡는다(`/^https?:/.test(url)` 등은 못 잡음). **받아들이고 테스트에 한계를 명시했다** — 정규식 가드로 모든 표현을 막는 것은 끝이 없고, 실제 차단은 패키징 재현이 증명한다.
- SUGGESTION: 핸들러 끝을 못 찾으면 조용히 넘어감 → 실패하도록 고쳤다. `callArgs` 가 문자열 안 괄호에 속을 수 있는 것은 현재 소스에서 문제없어 남겼다.
- 제품 코드는 2라운드 뒤 바뀌지 않았다(테스트만).

## 검증

- 수정 전 재현 `repro-before.json`: 메인·팝업이 주입 페이지 로드, electronAPI 20개 노출.
- 수정 후 재현 `repro-after.json`: 메인·팝업 모두 `file://…/app.asar/docs/`, 팝업의 localhost 이동 차단. asar 에 `/src/dev-server-probe.js`.
- 패키징 전 실행 `repro-dev-unpackaged.json`: dev server 로드 유지(개발 흐름 불변).
- 변이 13종 모두 유닛에 걸림(설치본 가드 삭제, fail-open, 호출부 `isPackaged:false`, 팝업 옛 코드, origin→startsWith, loadApp 탐색 우회, `&& false`, 키 중복, `|| startsWith("http:")`, 독립 타이머 제거, 팝업 상수 사용, 프로토콜 제한 제거, `res.destroy` 제거).
- build / unit 946 / lint 0 errors / E2E 496. 실사용 데이터 폴더는 모든 실행 전후 변경 없음.
- 못 한 것: Windows 실기.

## 후속 (범위 밖)

IPC 발신자 검증(`event.senderFrame.url`), `web-contents-created` 전역 가드, vite `--strictPort`, 패키징 앱 `--dev`/`--remote-debugging-port`.
