독립 리뷰 결과: **CRITICAL 0 / MAJOR 0 / MINOR 2 / SUGGESTION 1 — 전반적으로 승인 가능하며, 아래 경미한 수정만 권장합니다.**

## MINOR

1. 본문 내 분리 문서 경로 3곳이 실제 경로와 다릅니다.

- [CLAUDE.md:43](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/CLAUDE.md:43): `ai-pm-workflow.md`
- [CLAUDE.md:73](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/CLAUDE.md:73): `reception-number.md`
- [CLAUDE.md:130](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/CLAUDE.md:130): `decisions.md`

실제 파일은 모두 `docs-internal/guides/` 아래입니다. 안내표의 경로는 정확하지만, 본문의 축약 경로는 저장소 루트 기준으로 존재하지 않아 에이전트가 그대로 열면 실패할 수 있습니다.

권장: 세 곳 모두 `docs-internal/guides/...` 전체 경로로 변경.

2. `lost-lines.txt`의 암호화 시스템 설명 일부가 빠졌습니다.

원본은 다음 세 사실을 담았습니다.

- 메인 프로젝트에도 없음
- 현재 프로젝트에도 없음
- `sample-log-electron-test`에만 있음

하지만 [CLAUDE.md:128](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/CLAUDE.md:128)은 “본 프로젝트에 없다”만 남겼습니다. “메인에도 없다”와 “test 프로젝트에만 존재한다”는 정보는 새 문서 어디에도 없습니다. 즉 `lost-lines.txt`에서 실질적으로 복원되지 않은 유일한 사실입니다.

권장 문구:

> 암호화 시스템(`encryption-manager.js`, `crypto-utils.js`)은 메인 프로젝트와 본 프로젝트에는 없고 `sample-log-electron-test`에만 있다.

## SUGGESTION

[CLAUDE.md:72](/Users/leechanhee/orca/workspaces/sample-log-soil/soil/CLAUDE.md:72)의 저장 구조가 화살표로 연결되어 있어 localStorage → Firestore → JSON의 순차 저장 파이프라인처럼 읽힐 수 있습니다. 원본은 세 저장소를 별도 계층으로 열거했고, 실제로도 Electron 자동저장 JSON은 Firestore 다음 단계라기보다 별도 자동저장 대상입니다.

정보 손실은 아니지만 다음처럼 병렬 관계로 쓰면 더 정확합니다.

> 저장: localStorage(1차), Firestore(선택 동기화), Electron 자동저장 JSON

## 확인 결과

- 작업별 안내표의 다섯 경로는 모두 실제 파일과 일치합니다.
- 각 문서는 표에 적힌 작업 범위를 충분히 포함합니다.
  - 릴리스: 버전, 태그, 캡처, `data-popup`, 공지 발행, Actions, Pages
  - 접수번호: 그룹 규칙, 작물 분할, 하위 지번, 내보내기·흙토람 번호
  - AI PM: 훅, fast-track, `docs/` 사본, 표준 워크플로우
  - 구조 참고: 폴더, 시료 종 계약, 공통 모듈, 저장소 키
  - 결정 기록: 문의게시판 자격증명 위험과 재검토 조건
- 항상 노출되어야 할 핵심 규칙은 모두 새 `CLAUDE.md`에 남아 있습니다.
  - 티켓 필수 및 프로젝트·에픽 ID
  - 레지스트리 6곳
  - CSP 인라인 금지
  - `docs/` 빌드 삭제 위험
  - 빈 `ALLOWED_GATEWAY`의 접근 거부 의미
  - Firebase 프로젝트 격리
  - 설명서 정적 자산 복사 규칙
  - 실사용 데이터 보호를 위한 임시 `user-data-dir`
- `npm ci`, Windows runner, Node 22, 태그 트리거, Release 생성 설명은 `.github/workflows/build.yml`과 일치합니다.
- `npm test`가 `docs/`를 서빙한다는 설명, `capture:manual` 분리, sync-version 대상 3곳, 릴리스 노트 카드 개수 갱신 규칙도 설정·스크립트·테스트와 일치합니다.
- 훅 matcher와 차단 범위는 `.claude/settings.json`, `ticket-guard.sh`, `epic-id-guard.sh`와 일치합니다.
- 분리 문서 머리말의 원래 절 표시는 모두 정확합니다. `release.md`의 “본문은 옮기기만 했다”는 설명도 해당 분리 본문 기준으로 맞습니다.
- `lost-lines.txt`의 나머지 재작성 항목은 의미가 보존됐습니다. 개요, AI PM 식별자, Electron/Web 구조, main/preload 역할, 큰 push 대응, network-config 생성, graft 범위, 독립 진화·수동 cherry-pick, 자동 진행 원칙이 모두 새 `CLAUDE.md`에 살아 있습니다. 티켓 번호 같은 이력 표시는 일부 압축됐지만 운영 규칙이나 사실 손실로 볼 수준은 아닙니다.

코드나 문서는 수정하지 않았습니다.
