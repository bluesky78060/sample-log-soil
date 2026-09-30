# SLS-1-292 코드 리뷰 — 2레인 + 플랜 리뷰 반증

> 정본. 훅 통과용 사본은 `docs/03-code-review/`.

2026-10-01 · 대상: `package.json`(vite 한 줄), `package-lock.json`, `docs/`(vite 6 빌드 산출물), 이 폴더 기록

## 결과

| 레인 | 판정 | C / M / m / S |
| --- | --- | --- |
| `critic` 플랜 리뷰(산출물 JS 정규화 비교 포함) | APPROVE | 0 / 0 / 5 / 3 — `SLS-1-292-plan-review.md` |
| `codex` (`codexa`) | APPROVE | 0 / 0 / 0 / 0 — `review-codex.md` |
| `code-reviewer` (Opus) | APPROVE | 0 / 0 / 4 / 4 |

lock 전수 비교: 비-dev 패키지의 version·resolved·integrity 변경 0, dev 변경은 vite 6.4.3 · esbuild 0.25.12 · `@esbuild/*` · vite 하위 fdir·picomatch 뿐, 새 항목 출처는 모두 `registry.npmjs.org`, `@esbuild/win32-x64` 에 os/cpu 있음.
산출물: HTML 13개가 참조하는 로컬 파일 82개 전부 존재, `docs/assets` 72 = 72(해시 제거 이름 집합 동일), 옛 해시 파일 잔존 0, 설명서 이미지·캡처 36개 SHA-256 동일, HTML 차이는 청크 해시뿐(정규화하면 HEAD 와 바이트 동일), 설명서 배지는 src·docs 모두 「9월」.

## code-reviewer MINOR 4 → 반영 (모두 기록·증거 정확성)

1. 프로덕션 audit 5건이 기록에 없고 「= 0」만 남아 있음 → `evidence/audit-after.json` 에 `omitDev`·GHSA·공개 시각 추가, direction·plan 의 「0」에 「9/30 실험 시점」 명시. **이번 변경과 무관**(프로덕션 lock 변경 0, 권고가 2026-09-30T15:35Z 에 새로 공개) → SLS-1-296.
2. 릴리스 페이지 CSP 위반이 설명 없이 증거에 남음 → `smoke/README.md` 에 「기존 결함, v1.0.0 부터, vite 5 산출물과 동일」과 근거, SLS-1-295.
3. 스모크의 `csp` 필드가 항상 비어 있음(리스너를 로드 뒤에 붙임) → `addInitScript` 로 고쳐 다시 돌림. **그 결과 이전에 안 보이던 `manual/firebase-setup.html` 의 같은 인라인 스크립트 위반이 드러났다**(vite 5 산출물과 동일) → SLS-1-295 범위에 포함(`docs-internal/ai-pm/SLS-1-295/NOTE-scope.md`).
4. 팝업·실사용 폴더·최종 상태 증거 부족 → `popup-after.json`, 실사용 폴더 전후 392개 파일 mtime·크기 동일, 진입점 13개로 확대.
- SUGGESTION 반영: 「24 + 2 = 26」 정정, E2E 실패 7건 스펙 이름 기록, 진입점 13개 스모크, Windows CI 수동 실행은 main push 전에(아래).

## 검증

npm ci · build · unit 972 · lint 0 errors · E2E 496/496(첫 실행 7건은 부하 — 재실행 전부 통과) · 패키징 스모크 13개 페이지(11개 깨끗, 3개는 vite 5 와 동일한 기존 항목) · dev 서버 6개 페이지 200(단 `vite src` 는 `vite.config.js` 를 읽지 않으므로 설정 검증 아님).
못 한 것: Windows 실기. **main push 전에** 브랜치로 `workflow_dispatch` 를 돌려 Windows `npm ci` + vite 6 + `make` 를 확인한다(Release 는 태그에서만 생성, Pages 는 main 에서만 배포).
