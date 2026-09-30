# SLS-1-289 플랜 리뷰

> 정본. 훅 통과용 사본은 `docs/02-review/`.

리뷰어: `critic`(Opus, 읽기 전용) + 오케스트레이터 · 2026-09-29

## 1R — APPROVE (CRITICAL 0 / MAJOR 0 / MINOR 5 / SUGGESTION 4)

- 다른 경로 없음: 창 생성 두 곳(`src/index.js:329`, `:574`), http loadURL 두 곳(`:371`, `:634`) 모두 이번 헬퍼로 바뀜. setWindowOpenHandler 는 항상 deny, iframe 에는 preload 미주입, will-redirect 는 설치본이 file://·data: 만 로드하므로 무해.
  팝업 `startsWith('http://localhost:')` 는 `http://localhost:@evil.example/`(userinfo) 로도 뚫려 설치본 팝업이 사실상 어디로든 이동 가능했다 — 이번에 함께 닫힘.
- 개발 흐름 유지: `app.isPackaged` 는 실행 파일명이 electron 인지로 판정 — `electron-forge start` 는 false, 패키징본(`executableName: 'soil-sample-log'`)은 true.
- 패키징: asar 에 `/src/*.js` 가 모두 들어간다(실측). 메인 프로세스가 기동 중 죽으면 autoUpdater 까지 못 가 수동 재설치가 필요 → mac 스모크 필수.
- `--dev` 를 범위 밖에 둔 판단 타당 — `--remote-debugging-port` 로 CDP 조종이 이미 가능(재현 스크립트가 그렇게 했다).
- MINOR 1 fail-open 헬퍼 · 2 팝업 이동 런타임 미검증 · 3 eslint NODE_FILES · 4 스모크 산출물의 asar 확인 · 5 틀린 주석 두 곳 더.
- SUGGESTION 1 origin 비교(채택) · 2 IPC 발신자 검증 · 3 web-contents-created 전역 가드 · 4 vite --strictPort (2~4 후속).

## 오케스트레이터 판단

MINOR 5건 전부와 SUGGESTION 1을 플랜 「플랜 리뷰 1R 반영」에 넣었다. 판정이 APPROVE 라 재리뷰 없이 착수하고, 반영분은 코드리뷰(3중)에서 함께 본다.
