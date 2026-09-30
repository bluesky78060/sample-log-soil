# SLS-1-292 방향 — vite 5.4.21 → 6.4.3 메이저 이전

> 정본. 훅 통과용 사본은 `docs/00-discovery/`.

작성: 2026-09-30 · 확정: 사용자 「남은 티켓 진행해줘」(SLS-1-287 후속으로 발행, 우선순위 4)

| 카테고리 | 내용 |
| --- | --- |
| 목표 | 개발 의존성 Dependabot 알림 vite 3건 + esbuild 1건을 닫는다. vite 5 는 5.4.21 이 최신이라 같은 메이저 안에서는 해소가 불가능하다 |
| 사용자 | 설치본·웹판 사용자에게는 영향이 없어야 한다(dev 서버 한정 취약점). 개발자는 `npm run dev`·`build` 가 그대로 동작해야 한다 |
| 범위 | 루트 `devDependencies` `vite ^5.4.11 → ^6.4.3`, `package-lock.json`, 빌드 산출물 `docs/` |
| 범위 밖 | vite 7/8 · `vite.config.js` 구조 변경 · vitest(자체 중첩 vite 8.3.1 을 써서 루트 vite 와 독립) |
| 제약 | **빌드 산출물(`docs/`)이 바뀐다** — GitHub Pages 에 즉시 반영되고 설치본은 다음 릴리스에 싣는다. SLS-1-287 은 이것 때문에 vite 이전을 뺐다 |
| 리스크 | esbuild 0.21→0.25 minifier·rollup 변화로 청크 내용이 달라진다. 페이지 누락·정적 자산 누락·Electron `file://` 로딩 회귀 |
| 검증 | 산출물 전후 비교(파일·크기·진입점), unit·lint·E2E, dev 서버 기동, 패키징 스모크(임시 user-data-dir) |

## 실험 결과 (2026-09-30, 플랜 작성 전에 커밋하지 않고 시험)

이전을 먼저 시험한 뒤 그 결과를 근거로 이 플랜을 썼다(되돌릴 수 있는 작업트리 변경이었다).

- `npm install` 성공(npm 10.9.8). SLS-1-287 이 기록한 arborist `edgesOut` 크래시는 나지 않았다. `npm ci --dry-run` 통과.
- lock 변경: `vite 5.4.21→6.4.3`, `esbuild 0.21.5→0.25.12`, 하위 `fdir 6.5.0`·`picomatch 4.0.7` 신규, `@esbuild/*` 플랫폼 패키지 26개. **프로덕션 변경 0.** `npm audit --omit=dev` = 0 **(9/30 실험 시점)** — 10/1 에 새 권고 5건이 공개돼 최종 상태는 5건이다(이번 변경과 무관, `evidence/audit-after.json` omitDev, 후속 SLS-1-296).
- 빌드 성공(2.0s), 경고는 기존 것(Tailwind content, chunk size). `docs/` 파일 수 121 → 121, 총 크기 32.98MB → 32.98MB.
- 청크 이름(해시 제거) 기준 추가·삭제 **0**. 크기가 바뀐 청크 13개, 최대 +0.3%(`index.esm.js` 706,039 → 708,087). HTML 은 청크 참조 해시만 바뀜(설명서 배지의 월 표기는 빌드 시점 효과라 되돌림 — 플랜 「설명서 배지」).
- 진입점 13개 모두 존재, `manual/images` 23 · `screenshots` 13 그대로(copyManualAssets 플러그인 동작).
- unit 972 · lint 0 errors. dev 서버(`vite src`)가 `/ /soil/ /compost/ /settings/ /manual/ /release/` 모두 200 — 단 `vite src` 는 `vite.config.js` 를 읽지 않으므로 설정 검증은 아니다.
- E2E 전체: 첫 실행 489/496(부하 중 7건 실패 — 타임아웃 6, list-sticky-columns-drift 측정 전제 1), 실패 5파일 56건 2회 재실행 전부 통과, 조용한 상태 전체 재실행 **496/496**.
