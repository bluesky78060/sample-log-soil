# SLS-1-298 플랜

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

작성: 2026-10-01 · 근거: `SLS-1-298-direction.md`

## 변경

`package-lock.json` 의 `node_modules/axios` 1.18.1 → 1.20.0 (`npm update axios`). 그 밖의 항목이 바뀌면 멈추고 원인을 본다. `package.json`·소스·`docs/` 변경 없음.

## 검증

- lock 전수 비교(HEAD 대비): 프로덕션 변경 0, dev 변경 axios 하나, 출처 registry.npmjs.org.
- `npm ci`(npm 10), audit(axios 소멸), 빌드 후 `docs/` 불변, unit · lint.
- E2E 는 돌리지 않는다 — 앱 코드·산출물이 바뀌지 않아 신호가 없다(근거: 빌드 후 `git status` 가 lock 한 파일뿐).
- `wait-on` 실제 동작(응답 감지, 타임아웃 시 비-0 종료) — 이 패키지가 `dev:electron` 의 유일한 사용처다.

## 배포

lock 만 바뀌므로 웹판·설치본에 영향 없음. 릴리스 노트 없음. Windows CI 는 `npm ci` 로 같은 lock 을 쓴다(axios 는 dev 라 설치본 산출물과 무관).
롤백: lock 변경 커밋 하나.
