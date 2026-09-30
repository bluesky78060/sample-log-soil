# SLS-1-292 플랜

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

작성: 2026-09-30 · 근거: `SLS-1-292-direction.md` 실험 결과

## 변경

1. `package.json` `devDependencies.vite`: `^5.4.11` → `^6.4.3`
2. `package-lock.json`: `npm install` 결과(vite·esbuild 계열만, 프로덕션 0)
3. `docs/`: `npm run build` 재생성(청크 해시·참조 갱신)
4. `vite.config.js` **변경 없음** — 플러그인(`closeBundle` 훅)·`rollupOptions.input`·`server`·`base`·`root` 모두 vite 6 에서 동작을 실험으로 확인했다.

### vite 6 breaking change 조사 (플랜 리뷰 1R 직접 대조, 근거: v6 마이그레이션 문서)

| 항목 | 해당 | 근거 |
| --- | --- | --- |
| `resolve.conditions` 기본값 | 없음 | 설정 없음, 의존성 청크 본문이 minifier 차이 말고 같음 |
| JSON `stringify: 'auto'` | 없음 | src 에 `.json` import 없음 |
| HTML 에셋 참조 확대 | 없음 | 새로 처리되는 요소 없음(빌드 HTML diff 는 청크 해시뿐) |
| postcss-load-config v6 | 없음 | postcss 설정 없음, `tailwind-output.css` 청크가 바이트 동일 |
| Sass modern API | 없음 | 미사용 |
| `build.cssMinify` | 없음 | **SSR 전용 변경.** CSS 의 실제 차이는 esbuild 0.25 의 `@media (max-width: 640px)` → `@media(max-width:640px)` 공백뿐 |
| **commonjs `strictRequires: true`** | **해당, 무해** | dexie(UMD)·jszip·xlsx-js-style 이 `function X(){return f\|\|(f=1,…)}` 지연 래퍼로 바뀜. 호출(`Ao=Co()` 등)이 모두 정의 직후 최상위라 실행 순서 동일, entry 의 `window.XLSX = XLSX` 대입이 여전히 마지막 |
| **esbuild 0.21→0.25 minifier** | **해당, 무해** | 상수 접기(`25+4*32`→`153`), `!(x&1)`→`(x&1)==0`, PIFE 괄호 보존 — 값 동일 |
| tinyglobby(범위 중괄호) | 없음 | `import.meta.glob`·`?url`·`?raw`·`new URL(…, import.meta.url)` 0건 |
| scripts(build:css·sync-version·extract-whatsnew·embed-soil-template) | 없음 | vite 이전에 도는 일반 파일 생성기 |
| Node 엔진 | 충족 | vite 6.4.3 `^18 \|\| ^20 \|\| >=22`, CI Node 22 |

**dev 서버 주의**: `npm run dev` = `vite src --port 3000` 은 root 를 `src` 로 주므로 `vite.config.js` 를 읽지 않는다(vite 5 때부터). 「dev 서버가 뜬다」는 이 설정을 검증한 것이 아니다.

## 검증

- 실험에서 확인한 것을 최종 상태에서 다시: `npm ci`(npm 10), audit(vite·esbuild 항목 소멸; `--omit=dev` 는 기대 0 이었으나 10/1 새 권고로 5건 — 프로덕션 lock 변경 0 이므로 무관, SLS-1-296), 빌드, unit, lint.
- E2E 전체(496, docs/ 대상). **E2E 는 http 로만 돌아 Electron `file://` 로딩을 못 잡는다**(메모리 electron-e2e-gap) → 패키징 스모크: 임시 `--user-data-dir` 로 메인·팝업이 `file://…/docs/` 를 로드하고 CSP 위반이 없는지, 실사용 폴더 무변경. 산출물이 vite 6 것이므로 진짜 확인이다.
- 산출물 전후 **내용 비교**(크기·이름은 대리 지표일 뿐): 해시 참조 제거 → 같은 esbuild 로 다시 들여쓰기 → 짧은 식별자 정규화 → 남은 diff 를 분류. 결과는 `evidence/content-comparison.md`.
- 알림 소멸: 전후 `npm audit --json` 의 vite·esbuild 항목(`evidence/audit-after.json`), push 뒤 Dependabot 알림이 fixed 로 닫히는지(vitest 안 중첩 vite 8.3.1 이 범위에 안 드는지도 여기서 드러난다). vite 5 로 되돌려 재확인하지 않는다(lock·node_modules 를 다시 쓰는 위험).
- E2E 는 **이 워크트리의 `docs/`** 를 서빙한 것이어야 한다(`playwright.config.js` 가 8888 고정 + `reuseExistingServer`) — 실행 때 포트·cwd 를 기록한다.

## 배포

`docs/` 가 바뀌므로 push 즉시 GitHub Pages 에 반영된다. 설치본에는 다음 릴리스에 실린다. 사용자에게 보이는 변화가 없어 릴리스 노트는 릴리스 때 판단(팝업 없음).
롤백: `package.json`·lock·`docs/` 를 되돌리는 커밋 하나.

## 설명서 배지

`sync-version` 이 빌드 시점의 월을 찍는다 — 9/30 에 낸 v1.14.19 가 「2026년 10월」로 바뀐다. `src/manual/index.html` 과 `docs/manual/index.html` 은 **함께 되돌려** 커밋하지 않는다(한쪽만 되돌리면 src 와 docs 가 어긋난다).

## Windows CI 사전 확인

`build.yml` 에 `workflow_dispatch` 가 있고 Release 는 태그에서만 만든다. 브랜치를 올려 `gh workflow run build.yml --ref <branch>` 로 Windows `npm ci` + vite 6 + `make` 를 **머지 전에 릴리스 없이** 확인한다(main 이 아니라 Pages 영향 없음).

## 못 하는 것

Windows 설치·실행 실기(산출물 구성까지만 확인).
