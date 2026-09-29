# SLS-1-286 방향 — CI 설치를 `npm install` → `npm ci`

> 정본. 훅 통과용 사본은 `docs/00-discovery/`.

작성: 2026-09-29 · 확정: Orca 코디네이터 작업 지시(task_b41f0e0d50ec)로 방향이 주어짐. 사용자 직접 문답은 하지 않았다.

| 카테고리 | 내용 |
| --- | --- |
| 목표 | lock과 `package.json`이 어긋나면 CI가 조용히 재해석하지 않고 **실패**하게 한다. 설치본 의존성 = lock |
| 사용자 | 유지보수자(릴리스 태그를 붙이는 사람). 앱 사용자에게는 동작 변화 없음 |
| 범위 | `.github/workflows/build.yml`의 "Clean npm cache"·"Install dependencies" 두 스텝 |
| 범위 밖 | `package.json`·lock(SLS-1-285 소유), 시크릿 파일 생성 스텝, 패키징·릴리스 스텝 |
| 제약 | 태그 push 때만 도는 Windows 워크플로다. 테스트 태그·`workflow_dispatch` 실행 같은 **원격 실행은 하지 않는다** — 권고안으로만 남긴다 |
| 리스크 | Windows runner에서 플랫폼 optional 의존성 때문에 `npm ci`가 실패하면 릴리스가 막힌다 |
| 검증 | YAML 파싱, 깨끗한 상태 `npm ci` 로컬 성공(mac), lock 안 win32 항목 확인, 불일치 시 실패 재현 |

## 발견 경위

SLS-1-283에서 lock이 v1.14.14 이후 `package.json`과 어긋나 있었는데 CI(`npm install`)가
그대로 통과시켰다. 설치본에 실린 의존성이 lock과 달랐을 수 있다.
