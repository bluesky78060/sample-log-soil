# SLS-1-298 방향 — axios 1.18.1 → 1.20.0 (dev, wait-on 하위)

> 정본. 훅 통과용 사본은 `docs/00-discovery/`.

작성: 2026-10-01 · 확정: 사용자 「계속 진행해줘」(SLS-1-292 작업 중 Dependabot 신규 알림, 우선순위 4)

| 카테고리 | 내용 |
| --- | --- |
| 목표 | Dependabot axios 알림 9건(high 4, medium 5, 2026-09-30 15시 UTC 공개, 첫 패치 1.20.0)을 닫는다 |
| 사용자 | 설치본·웹판 사용자에게는 무관 — axios 는 devDependencies `wait-on 9.0.4`(`npm run dev:electron`) 하위로만 있다. 개발자 도구 동작이 유지돼야 한다 |
| 범위 | `package-lock.json` 의 axios 한 항목(`npm update axios`). `package.json` 변경 없음 |
| 범위 밖 | wait-on 자체 업그레이드, 프로덕션 의존성 |
| 제약 | wait-on 의 axios 범위 `^1.13.5` 안이어야 한다 → 안이다(1.20.0) |
| 리스크 | 낮음 — 개발 도구의 마이너 점프. 빌드 산출물·설치본 불변 |
| 검증 | lock 전수(프로덕션 변경 0), `npm ci`, audit, 빌드 산출물 불변, wait-on 실제 동작 |

## 확인한 것 (2026-10-01)

- `npm ls axios`: `wait-on@9.0.4 → axios@1.18.1` 한 경로뿐. 설치본 asar·`docs/` 에는 실리지 않는다(`devDependencies`).
- lock 변경: `axios` 1.18.1 → 1.20.0 한 항목(dev), 그 안의 `form-data` 범위 `^4.0.5` → `^4.0.6` 한 줄. **프로덕션 변경 0.** resolved `registry.npmjs.org`, integrity 있음.
- `npm ci` 통과. `npm audit`: axios 항목 소멸(전체 high 26, 프로덕션 4 — 프로덕션 4건은 SLS-1-296 에서 도달 불가로 판단한 grpc 계열).
- `npm run build` 후 `docs/` 변경 없음.
- `wait-on`(axios 1.20.0)이 `vite src` 서버 응답을 0.5초에 감지, 없는 포트에서는 타임아웃 오류로 비-0 종료.
