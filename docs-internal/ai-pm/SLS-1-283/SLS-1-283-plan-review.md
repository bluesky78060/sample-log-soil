# SLS-1-283 플랜 리뷰

> 정본. 훅 통과용 사본은 `docs/02-review/`.

리뷰어: `critic` 에이전트(Opus, 읽기 전용) + 오케스트레이터 · 2026-09-28

## 1R — REVISE (CRITICAL 0 / MAJOR 2 / MINOR 7 / SUGGESTION 2)

리뷰어가 스크래치 복사본에서 lock 절차를 재현하고, 실제 `releases.atom`·`/releases/latest`·`latest.yml`을
builder-util-runtime 9.7.0 + sax 1.6.1 + js-yaml 4.3.2로 파싱했다. 업데이터가 자동 업데이트를 깨뜨리는
경로는 찾지 못했다(NsisUpdater `doInstall` 인자 동일, `publisherName` 없어 서명 검증 건너뜀, sha512 hex 판별 유지,
차등 다운로드는 `try` 안).

- **MAJOR-1** js-yaml 4.3.0이 `^4.1.0`을 이미 만족해 안 오른다 → audit 0 도달 불가. → override `^4.3.2`
- **MAJOR-2** 새 업데이터는 N+1이 아니라 **N+2**에서 처음 돈다. 실패 시 전국 설치본이 멈추고 알아채기 어렵다.
  → 이 티켓은 태그를 붙이지 않고 (a) Windows 테스트 릴리스 / (b) 위험 수용 + 공지 복구를 사용자 결정으로 넘김. mac 패키징 스모크 추가
- MINOR: `docs/` 재빌드·커밋 필요, dompurify 5일 된 버전 기준 불일치, `^6.8.9`와 "고정" 모순, sax 변경 누락,
  유닛의 DOMPurify 목, CI `npm install`(→ 후속), Dependabot 보안 업데이트 PR 폭주(→ 알림만)

## 2R — APPROVE (CRITICAL 0 / MAJOR 0 / MINOR 1)

개정 명령 재현: 프로덕션 변경 정확히 7개(builder-util-runtime 9.7.0, dompurify 3.4.15, electron-updater 6.8.9,
js-yaml 4.3.2, protobufjs 7.6.6, sax 1.6.1, websocket-driver 0.7.5), `npm audit --omit=dev` 0, `npm ci --dry-run` exit 0.

- MINOR: `ALLOWED_GATEWAY:""`를 "제한 없음"이라 적었으나 실제로는 **웹 접근 거부 → 로컬 모드**
  (`network-access.js:23` `|| null`, `checkAccess()`의 `if (!allowedGateway)`). → 플랜과 CLAUDE.md 모두 정정.
  빈 값으로 빌드해야 기존과 같다는 판단 자체는 맞음(`'0.0.0.0'`이면 ipify 호출·adminIPs 우회·설정 화면 표시가 바뀐다)

## 오케스트레이터 판단

2R 지적 반영 완료. 방향 일치(범위 밖 electron·dev 의존성 유지), 롤백 가능(커밋 하나). 구현 착수.
