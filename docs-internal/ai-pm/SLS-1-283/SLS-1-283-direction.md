# SLS-1-283 방향 — 프로덕션 의존성 취약점 6건 + lockfile + Dependabot

> 정본. 훅 통과용 사본은 `docs/00-discovery/`.

작성: 2026-09-28 · 확정: 사용자 선택 「취약점 수정 + Dependabot (Recommended)」

| 카테고리 | 내용 |
| --- | --- |
| 목표 | 설치본·웹 번들에 실려 나가는 의존성의 알려진 취약점을 없앤다. 앞으로는 GitHub이 알려 주게 한다 |
| 사용자 | 전국 농업기술센터 사용자(동작 변화 없어야 함), 유지보수자(Dependabot 알림 수신) |
| 범위 | `npm audit --omit=dev` 6건 · `package-lock.json` 동기화 · Dependabot **alerts** 켜기 (security updates는 플랜 리뷰 1R로 제외 — PR용 CI가 없고 웹 병합이 티켓·`docs/` 재빌드를 우회한다. 사용자에게 채팅으로 알림, 명시적 동의는 받지 않음) |
| 범위 밖 | `electron` 39.2.6(런타임 교체, Windows 실기 필요) · 개발 의존성 49건 → 후속 티켓 |
| 제약 | 앱 소스(`src/`) 변경 없음. 같은 메이저 안의 버전만 올린다. 막 나온 버전은 피한다 |
| 리스크 | `electron-updater`는 자동 업데이트 경로다. 확인·다운로드·설치는 Windows 실기로만 검증된다 |
| 검증 | `npm ci` 성공, `npm audit --omit=dev` 0건, 유닛·린트·빌드·E2E, 업데이터 코드 diff 검토 |

## 발견 경위

2026-09-28 프로젝트 점검. GitHub에 열린 PR·이슈가 없고 Actions가 모두 초록이었지만
Dependabot이 꺼져 있어(`dependabot_security_updates: disabled`, alerts API 403)
공개 저장소인데도 취약점 알림이 한 건도 오지 않았다.

`npm ci`는 lockfile 불일치로 거부된다. CI는 `npm install`을 써서 지나쳤다.
`package.json`은 v1.14.14 이후 버전 번호만 바뀌었으므로 lockfile 자체가 어긋난 것이다.
