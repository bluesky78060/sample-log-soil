# SLS-1-287 플랜 — 개발 의존성 취약점 정리

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

작성: 2026-09-29 · 근거: `SLS-1-287-direction.md` · 개정: 플랜 리뷰 1R(APPROVE, MINOR 4) 반영

## 기준선 (HEAD aca0699, `npm ci` 직후)

`npm audit` **49건** — critical 1 / high 38 / moderate 5 / low 5. `npm audit --omit=dev` = 0. `npm ls electron` = 39.8.10.
원문: `evidence/audit-before.txt`.

## 사전 조사로 확인한 것 (스크래치 사본, `--package-lock-only`)

1. **`npm audit fix`는 쓸 수 없다.** npm 10.9.8 arborist가 `#loadPeerSet`에서 `Cannot read properties of null (reading 'edgesOut')`로 죽는다.
   vitest 하위 트리(peer set)를 다시 풀 때마다 재현되며, vitest 항목을 lock에서 지우고 처음부터 풀어도 같다.
2. **npm 11.20.0은 vitest를 풀 수 있다.** 결과 변경은 vitest 하위 트리(vitest·@vitest/* 4.1.4→4.1.11, 중첩 vite 8.1.3→8.3.1, rolldown 1.1.4→1.2.11·lightningcss 1.32→1.33·@oxc-project/types 0.138→0.151 마이너, tinyrainbow·picomatch 패치)와
   optional 항목(`encoding` 추가 — minipass-fetch의 optionalDependency)뿐이었다. rolldown wasm 바인딩이 빠진 것은 npm 동작이 아니라
   rolldown 1.2.11이 `optionalDependencies`에서 뺀 결과다.
3. **vite 5.x 최신은 5.4.21 = 현재.** vite 알림 3건(첫 패치 6.4.2/6.4.3)과 esbuild 1건(vite 5가 `^0.21.3`으로 고정, 첫 패치 0.25.0)은
   같은 메이저 안에서 해소 불가 → 잔존으로 보고.
4. **forge 7.11.2 = 최신.** forge 체인 19건은 전부 `@electron/packager → extract-zip`(수정본 없음) 경유라 잔존한다(범위 밖 extract-zip과 같은 뿌리).

## 변경

### A. 범위 안 lock 갱신 (npm 10 `npm update --package-lock-only`)

brace-expansion(1.1.21 / 2.1.7 / 5.0.12), shell-quote(→1.9.0, concurrently 9.2.3→**9.2.4**가 정확 고정을 바꿈), postcss(8.5.16→8.5.28),
nanoid, browserslist, baseline-browser-mapping, fast-uri, undici, qs, ip-address, joi, @xmldom/xmldom, postcss-selector-parser.

### B. vitest 4.1.4 → 4.1.11 (같은 메이저)

npm 11.20.0으로 lock만 해석(`npx -y npm@11.20.0 install --package-lock-only -D vitest@^4.1.11`, 버전 고정) → 이후 모든 단계는 npm 10으로 돌려 lock을 npm 10 형식으로 정규화한다.
**npm 11 단계 뒤에는 반드시 npm 10으로 정규화한다.** npm 11은 vite 8의 esbuild optional peer(`vitest/node_modules/esbuild`·`@esbuild/*`)를 빼고,
npm 10은 다시 넣는다. HEAD lock에도 같은 항목이 있어 이 변경이 만든 진동은 아니지만, npm 11 결과를 그대로 커밋하면 CI(npm 10)와 왕복한다.

### C. overrides (semver 범위 밖 전이 의존성)

| override | 소비자 | 변화 | 호환 근거 |
| --- | --- | --- | --- |
| `"tar": "^7.5.22"` | @electron/rebuild 3.7.2(`^6.0.5`), @electron/node-gyp 10.2.0-electron.1(`^6.2.1`), cacache 16(`^6.1.11`) | 6.2.1 → 7.5.22 | 호출은 3곳뿐: `node-gyp/lib/install.js:217,240` `tar.extract({file?,strip,filter,onwarn,cwd})`, `rebuild/lib/clang-fetcher.js:134` `tar.x({file,cwd})`. cacache lib는 tar를 require하지 않는다. tar 7 CJS는 `extract`/`x`를 이름 있는 export로 유지 |
| `"tmp": "^0.2.7"` | external-editor 3.1.0(`^0.0.33`) ← @inquirer/editor ← forge cli | 0.0.33 → 0.2.7 | 호출은 `tmpNameSync(fileOptions)` 한 곳, @inquirer/editor가 넘기는 옵션은 `{ postfix }`뿐 |

기존 overrides(protobufjs·js-yaml·websocket-driver)와 같은 전역 형식. tar·tmp를 쓰는 다른 소비자는 없다(`npm ls` 확인, tmp-promise는 이미 0.2.7).

### D. 직접 devDependencies 하한 상향 (lock이 이미 그 버전 — 문서화 목적)

`vitest ^4.1.4 → ^4.1.11`, `concurrently ^9.2.1 → ^9.2.4`, `postcss ^8.5.6 → ^8.5.23`(두 알림의 첫 패치).

## 예상 결과 (스크래치 실측)

`npm audit` 49 → **24** (critical 0 / high 23 / moderate 1 / low 0). 잔존 = forge 19 + @electron/packager + extract-zip + electron(모두 extract-zip 경유) + vite + esbuild.
Dependabot 기준: 범위 안 54건 중 **50건 해소**, 잔존 4건(vite 3, esbuild 1).
lock: prod(= `dev` 플래그 없는 항목) 변경 **0건**, `npm audit --omit=dev` = 0.

## 절차

```bash
git show HEAD:package-lock.json > $S/HEAD-lock.json
# A → B → C → D
npm update --package-lock-only brace-expansion shell-quote postcss nanoid browserslist baseline-browser-mapping \
  fast-uri undici qs ip-address joi @xmldom/xmldom postcss-selector-parser concurrently
npx -y npm@11.20.0 install --package-lock-only -D vitest@^4.1.11
# package.json: overrides tar/tmp, 하한 상향
npm install --package-lock-only          # npm 10 정규화
npm install --package-lock-only          # 두 번째 실행에서 lock diff 0 (멱등성 = CI `npm install`이 lock을 바꾸지 않음)
node lockdiff.js $S/critic-d/package-lock.json package-lock.json  # 사전 조사 결과와 같은지 (다르면 그 사이 레지스트리 변화)
rm -rf node_modules && npm ci            # npm 10
node lockdiff.js $S/HEAD-lock.json package-lock.json   # 전 항목 version·resolved·integrity 비교, prod 0 확인
npm audit / npm audit --omit=dev
```

## 검증

| 항목 | 기준 |
| --- | --- |
| `npm ci` (npm 10) | 성공, `npm ls --all` exit 0 (HEAD에도 있는 `UNMET OPTIONAL DEPENDENCY`는 판정에서 제외) |
| audit | 전후표, `--omit=dev` = 0 |
| `npm run build` | 성공, `git status docs/` 변경 0 (manual 배지 날짜만 바뀌면 되돌림). `src/shared/tailwind-output.css`도 불변이어야 한다 — postcss·browserslist 갱신 영향 확인 |
| unit / lint / E2E | 925 통과 / 0 errors(warnings ≤ 6) / 496 통과(부하성 타임아웃은 해당 스펙만 재실행) |
| `npx electron-forge package` | `forge.config.js` `extraResource`의 `.env`·`feedback-auth.json`이 워크트리에 없으면 빈 자리표시로 만든다(둘 다 gitignore) → package 성공 → 자리표시·`out/` 삭제. forge가 @electron/rebuild를 로드하므로 tar 7 로드 경로 확인 |
| concurrently·wait-on | 버전이 바뀌었는데 unit·E2E는 `dev:electron`을 타지 않는다 → `concurrently`로 명령 둘 실행, `wait-on`으로 파일 대기 스모크 |
| tar 7 기능 | node-gyp가 쓰는 옵션 그대로 `tar.extract` 파일·스트림 두 경로 + `tar.x` 스모크. 가능하면 `@electron/node-gyp install`로 Electron 헤더 실제 다운로드·압축해제(devdir는 임시 폴더) |
| docs/·CSS diff가 나면 | 멈추고 원인 판별: 같은 워크트리에서 HEAD lock으로 `npm ci` → 빌드해 재현되는지 먼저 본다(vite 청크 해시는 node_modules 절대 경로에 민감하다 — 플랜 리뷰 관찰) |
| tmp 0.2.7 | `external-editor`의 `ExternalEditor` 생성(임시 파일 생성·삭제)을 `{ postfix: '.txt' }`로 스모크 |

## 기각한 대안

- **vite 6.4.3+**: "8.x 금지"에는 안 걸리지만 메이저 이전이라 docs/ 산출물이 바뀐다 → "docs/ 불변" 제약 위반.
- **`overrides: { vite: { esbuild: "^0.25" } }`**: esbuild minifier가 바뀌어 docs/가 바뀔 수 있다. 두 알림 모두 dev 서버 한정(`vite dev`/`preview`)이다.
- **forge 또는 @electron/rebuild 4.x 상향**: forge 7.11.2가 최신이고 core-utils가 `@electron/rebuild ^3.7.0`에 묶여 있다. upstream node-gyp 11이 같은 `tar.extract` 호출을 `tar ^7`로 쓰므로 override 근거가 더 강하다.

## 되돌리기

변경은 package.json·package-lock.json 두 파일. 커밋 revert 후 `npm ci`로 원복된다.

## 남는 것 (보고 대상)

- vite 3·esbuild 1: vite 6.4.3+ 메이저 이전 필요(docs/ 산출물 형식 영향 → 별도 티켓).
- extract-zip 2 + electron 32: 범위 밖. extract-zip은 수정본이 없어 electron 메이저(≥40.10.3)·forge 경로 변경과 함께 판단.
- npm 10.9.8 arborist 버그: vitest를 다시 올릴 때 같은 충돌이 난다. 다음 사람은 npm 11로 lock만 해석한 뒤 npm 10으로 정규화해야 한다.
  Node 24(npm 11)로 옮기면 CI도 함께 옮겨야 한다 — 한쪽만 옮기면 esbuild optional peer 27개가 lock에서 왕복한다.
- 전역 override의 부작용: 나중에 다른 의존성이 tar ^6·tmp ^0.0.x를 끌어와도 7·0.2로 강제된다. forge가 tar 7을 직접 쓰게 되면 override를 지운다.
- Windows CI(`build.yml`의 `npm install` → `npm run make`)는 이 환경에서 못 돈다. push 금지라 `workflow_dispatch`도 못 한다 → 병합 후 코디네이터가 한 번 돌리거나 다음 릴리스 태그에서 확인.
