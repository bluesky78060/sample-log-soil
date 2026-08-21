# SLS-1-193 리뷰 — 퇴비 검정결과 페이지 + IPC 이식

- 리뷰어: **codex (codex-cli 0.147.0)** — 독립 레인 · 적대적 검증 **변이 3건**
- 일시: 2026-08-21 · 판정: **APPROVED**

## 결론부터 — 이식은 이미 끝나 있었다

이 티켓이 요구한 작업은 **SLS-1-205(커밋 `206ea5b`)에서 완료**됐다.
티켓이 열린 뒤(2026-07-26) 다른 티켓이 같은 일을 해 버린 것이고, 이 티켓만 남아 있었다.

| 요구 항목 | 상태 |
| --- | --- |
| `src/compost-analysis/` 4종 | ✅ + `compost-heuktoram-export.js` 하나 더 |
| `vite.config.js` `compostAnalysis` entry | ✅ `vite.config.js:52` |
| `src/index.js` `ipcMain.handle('open-compost-analysis')` | ✅ `:656-663` |
| `src/preload.js` `openCompostAnalysis` 노출 | ✅ `:97` |
| E2E | ✅ `compost-analysis-page.spec.js` **28건 통과** |

**티켓 문구만 믿고 착수했으면 이미 있는 것을 다시 만들었을 것이다.**

## 그래서 무엇을 했나 — 회귀 가드

이식 자체는 손댈 것이 없다. 대신 **조용히 끊길 수 있는 배선**을 묶었다.

별도 창 페이지는 네 곳이 동시에 맞아야 한다.
`src/<dir>/index.html` · vite entry · `ipcMain.handle` · preload 노출.

⚠️ **E2E는 이 중 절반을 못 밟는다.** `http://localhost:8888`의 `docs/`만 돌아
**메인 프로세스와 preload를 아예 거치지 않는다**(알려진 검증 공백).
즉 IPC나 preload가 빠져도 451건이 전부 초록불이다.

→ `tests/unit/popup-window-wiring.test.js` 5건. `src/index.js`에서 등록된 팝업을
   **전부 뽑아** 네 지점을 대조한다. 새 팝업이 늘어도 자동으로 검사 대상이 된다.

## 리뷰 지적 반영

**SUGGESTION — 문자열 검색 대신 `vite.config.js`를 import해 검증하면 더 강하다.**
→ import는 플러그인 로딩에 얽혀 불안정했다. 대신 **주석을 걷어낸 뒤
   `키: resolve(… 'src/<dir>/index.html')` 형태**인지까지 본다.
   **변이 (n)으로 확인**: entry를 주석 처리만 해도 테스트가 실패한다.

## 리뷰어가 확인해 준 것

- 이식 산출물이 **모두 존재**하며 반례가 없다
- 정규식이 아무것도 못 잡으면 **공허하게 통과하지 않는다** —
  `popups.length > 0`과 `open-compost-analysis` 포함을 명시적으로 검사한다
- `makePopupWindowHandler`의 `route`/`dirName`이 실제 로딩 경로와 일치한다
  (개발: `http://localhost:3000/compost-analysis/`, 배포: `docs/compost-analysis/index.html`)
- 웹 폴백(`../compost-analysis/index.html`)과 대상 페이지의 모듈·스타일·저장소 연결도 정상

> ⚠️ 리뷰어 환경에서 vitest가 `EPERM`으로 실행되지 않아 정적 검토로 대조했다고 밝혔다.
> 실행 결과는 이쪽 값이다.

## 적대적 검증 — 변이 3건

| 변이 | 결과 |
| --- | --- |
| (l) preload에서 `openCompostAnalysis` 제거 | **2건 실패** |
| (m) vite entry에서 `compostAnalysis` 제거 | **1건 실패** |
| (n) entry를 **주석 처리만** (강화 검증) | **1건 실패** |

## 검증

build ✓ / E2E **451 passed** / unit **883 passed** (878→883) / lint 0 errors

## 남은 공백 (이번 범위 밖)

Electron 메인 프로세스와 `file://` 경로는 여전히 자동 검증되지 않는다.
이번 가드는 **배선이 존재하는지**를 정적으로 볼 뿐, 실제로 창이 뜨는지는 실기 확인이 필요하다.
