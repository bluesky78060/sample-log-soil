# SLS-1-290 플랜 리뷰

> 정본. 훅 통과용 사본은 `docs/02-review/`.

리뷰어: `critic`(Opus, 읽기 전용) + 오케스트레이터 · 2026-09-30

## 1R — APPROVE 조건부 (CRITICAL 0 / MAJOR 0 / MINOR 4 / SUGGESTION 3)

- 허용 목록이 빠뜨린 런타임 파일 없음: 메인 require 는 electron·node:*·electron-updater·electron-squirrel-startup·`./dev-server-probe` 뿐, `__dirname` 참조는 docs·preload·`.env`·`feedback-auth.json`(둘 다 `resourcesPath` 폴백), 렌더러는 `docs/` 밖을 안 가리킨다(`../../` 0건), `app-update.yml` 은 extraResource.
- packager ignore 계약(`@electron/packager` 18.4.4, forge 7.11.2): 함수를 주면 기본 제외가 사라지나 영향 0(프로덕션 모듈에 락파일·`.node` 없음, `.bin` 은 forge afterCopy 가 지움). out/ 재귀 없음. 경로는 `/…` 형식, Windows 는 정규화, 루트 `''`.
- `.env`·`feedback-auth.json` 을 asar 에서 빼도 같은 패키징 실행의 같은 원본이라 내용 동일.
- MINOR 1 `.catch` 로는 다운로드 실패 거부를 못 막음(`AppUpdater.js:294`) · 2 효과 측정이 로컬 트리 기준 · 3 정적 테스트 판정이 느슨함 · 4 스모크로 resources 사본 여부를 구분 못 함. SUGGESTION 1 기본 제외 복원 · 2 Windows asar 를 워크플로 수동 실행으로 사전 확인 · 3 `node_modules/.vite` 등.

## 오케스트레이터 판단

MINOR 4건과 SUGGESTION 1 을 플랜 「플랜 리뷰 1R 반영」과 방향 문서 「잔여」에 넣었다. SUGGESTION 2 는 릴리스 때 사용자에게 권한다. 재리뷰 없이 착수하고 반영분은 코드리뷰에서 본다.
