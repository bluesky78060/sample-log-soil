# SLS-1-285 방향 — electron 39.2.6 → 39.8.10

> 정본. 훅 통과용 사본은 `docs/00-discovery/`.

작성: 2026-09-29 · 출처: Orca 코디네이터 작업 지시(task_05c315c3ea36)와 AI PM 티켓 본문. 이 워커는 사용자와 직접 문답하지 않았다 —
아래 7개 항목은 지시문에서 옮긴 것이고, 지시문에 없는 결정(릴리스 분리)은 **사용자 결정으로 남긴다.**

| 카테고리 | 확정 내용 |
| --- | --- |
| 목표(Why) | Dependabot electron 알림 17건(high 5, medium 8, low 4) 해소. `devDependencies`지만 설치본에 실리는 런타임이다 |
| 사용자(Who) | 전국 농업기술센터 Windows 설치본 사용자. 자동 업데이트로 받는다 |
| 범위(What) | `package.json` `"electron": "39.8.10"` 정확 고정, `package-lock.json`, `docs/` 재빌드. `src/`는 건드리지 않는다 |
| 제약 | 같은 메이저(39) 안에서만. lock 재생성 금지 — `npm install --save-exact electron@39.8.10`로 대상만. electron 외 패키지가 바뀌면 멈춘다 |
| 우선순위 | 보안 패치. 기능 변경 없음 |
| 리스크 | 런타임 교체 — 메인 프로세스 CSP, `file://` 로딩, preload `contextBridge` IPC, 자동저장, electron-updater 6.8.9 경로. E2E는 http로만 돌아 이 경로를 못 잡는다 |
| 검증 | `npm ci`, `npm ls electron`, audit, build/unit/lint/E2E, mac 패키징 스모크(임시 user-data-dir), 플랜·코드 리뷰. Windows 실기는 이 환경에서 불가 |

방향 확정 근거: 코디네이터 지시문의 Target/Change/Constraints/Acceptance가 곧 확정 방향이다.
릴리스 분리 여부만 사용자에게 넘긴다(플랜 §릴리스 권고).
