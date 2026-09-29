# SLS-1-286 플랜 — CI `npm ci` 전환

> 정본. 훅 통과용 사본은 `docs/01-plan/`. 플랜 리뷰 1R(REVISE) 반영본.

## 변경

`.github/workflows/build.yml`

```diff
-      - name: Clean npm cache
-        run: npm cache clean --force
-
+      # lock과 package.json이 어긋나면 재해석하지 않고 실패한다 (SLS-1-286)
       - name: Install dependencies
-        run: npm install
+        run: npm ci
```

다른 스텝은 그대로 둔다.

## 왜 필요한가 — 실제로 어긋나 있었다

v1.14.14·v1.14.16 태그의 `package.json`·lock으로 `npm ci --dry-run`을 돌리면 **exit 1**이 난다.

```
npm error code EUSAGE
npm error Missing: @emnapi/core@1.11.3 from lock file
npm error Missing: @emnapi/runtime@1.11.3 from lock file
```

같은 lock이 CI의 `npm install`에서는 통과해 릴리스됐다. `npm ci`였다면 그 자리에서 멈췄다.

알고 있어야 할 성질이 있다. 위 `@emnapi/*`는 wasm32 바인딩의 의존성이라 Windows에는 설치조차
되지 않는다. 그런데도 `npm ci`는 릴리스를 막는다. 의도한 엄격함이다. 막히면 `npm install`로
lock을 맞춰 커밋하면 된다.

## `npm cache clean --force`를 지우는 근거

- **지금 태그 실행에서는 캐시가 한 번도 복원되지 않았다.** 플랜 리뷰가 읽기 전용
  `gh run view`로 러너 로그를 확인했다. v1.14.14~17 모두 `npm cache is not found` →
  `Cache saved`다. v1.14.14~16 세 태그는 lock 해시가 같은데도 그렇다. GitHub Actions 캐시는 ref 범위라
  태그 ref에 저장한 캐시를 다른 태그가 읽지 못한다. 모든 ref가 읽을 수 있는 것은 기본
  브랜치(main)에 저장된 캐시뿐이다. 그러므로 clean은 **빈 캐시를 지우는 무의미한 스텝**이다.
- main에서 이 워크플로가 한 번 돌아 캐시가 생기면 그때부터 태그 실행이 캐시를 재사용한다.
  clean이 남아 있으면 그 이득을 스스로 버린다.
- **도입 이유가 기록에 없다.** `ae37120`(v1.0.0 최초 커밋, 통합본에서 분리)에 이미 있었고,
  커밋·문서 어디에도 근거가 없다.
- **지워도 손상된 캐시로 빌드하지 않는다.** npm 캐시는 내용 주소(cacache)라 오래된 항목이
  섞이지 않는다. `npm ci`는 lock의 `integrity`(sha512)로 tarball을 검증한다. 예외가 하나 있다.
  git 의존성 `@electron/node-gyp`는 lock에 `integrity`가 적혀 있어도 pacote가 지우고 비교하지 않는다
  (`pacote/lib/git.js` 「skipping integrity check for git dependency」, npm/rfcs#525). `npm install`도 마찬가지다.
  캐시 항목이 손상돼 있으면 pacote가 「cached data … seems to be corrupted. Refreshing cache」를
  남기고 그 항목을 지운 뒤 `resolved` URL에서 다시 받는다(재시도 1회). 그래도 안 맞으면
  EINTEGRITY로 **멈춘다**. 근거: npm 10.9.8 `pacote/lib/fetcher.js` `tarballStream`.
- 러너의 npm 캐시 경로는 `C:\npm\cache`다(러너 로그의 `npm config get cache`).
- `npm ci`는 설치 전에 `node_modules`를 지운다. 새 러너에는 원래 `node_modules`가 없으니
  CI에서는 의미가 없다.

## Windows optional 의존성 위험 조사

알려진 함정은 npm/cli#4828이다. 한 플랫폼에서 `node_modules`가 있는 채로 lock을 만들면
다른 플랫폼의 optional 바이너리 항목이 lock에서 빠질 수 있다.

**현재 lock**(`lockfileVersion 3`)의 플랫폼 한정 패키지를 계열별로 세 보았다.

| 계열 | win32-x64 항목 | 버전 |
| --- | --- | --- |
| `@esbuild/*` (vite) | `@esbuild/win32-x64` | 0.21.5 |
| `vitest/node_modules/@esbuild/*` | `@esbuild/win32-x64` | 0.28.2 |
| `@rollup/rollup-*` | `rollup-win32-x64-msvc`, `-gnu` | 4.62.2 |
| `@rolldown/binding-*` | `binding-win32-x64-msvc` | 1.1.4 |
| `lightningcss-*` | `lightningcss-win32-x64-msvc` | 1.32.0 |

- 전부 `optional: true`에 `os`/`cpu`가 있고 `resolved`·`integrity`도 들어 있다.
- 플랫폼 한정인데 optional이 아닌 패키지는 없다. tailwind는 3.x라 oxide가 없고, sharp·@swc 같은 다른 네이티브 계열도 lock에 없다.
- win32 항목이 없는 것은 `fsevents` 3개와 `electron-installer-debian`·`-redhat`뿐이다.
  모두 `os: darwin/linux`로 한정돼 있어 Windows에서는 건너뛰는 것이 맞다.
- 스크래치 폴더에서 `npm ci --ignore-scripts --os=win32 --cpu=x64`로 **실제 설치**했다.
  결과는 924 패키지이고, 러너의 `npm install` 로그(`added 924 packages`)와 같다.
- 설치 스크립트(`electron`, `esbuild`, `protobufjs`, `@firebase/util`, `electron-winstaller`),
  루트 lifecycle, git·URL 의존성, peer 처리, npm 버전(러너도 10.9.8)은 `npm install`과
  경로가 같다. 이 변경으로 새로 생기는 위험은 찾지 못했다.

**`npm ci --dry-run`은 이 위험을 잡지 못한다.** lock에서 win32 항목을 전부 지워도 dry-run은
exit 0이다. `--os=win32 --cpu=x64`를 줘도 마찬가지다. 그래서 실제 설치로 확인하는 스크립트를 둔다.

`docs-internal/ai-pm/SLS-1-286/check-lock-win32.sh [저장소 루트]`

1. `npm ci --dry-run`으로 동기화를 확인한다. 실패하면 `npm error code/Missing/Invalid` 줄을 보여 준다.
2. 임시 폴더에 `--os=win32 --cpu=x64`로 실제 설치한다(저장소 `.npmrc`가 있으면 함께 복사).
3. 설치된 모든 패키지(루트 포함)의 `package.json` `optionalDependencies` 중 Windows x64용인 것이
   Node 해석 규칙으로 찾아지는지 본다. Windows x64용은 이름(`win(32|dows)[-_]?(x64|amd64|64)`)
   또는 lock 항목의 `os`/`cpu`에 win32·x64가 모두 있는 것으로 고른다. 이름을 고정하지 않으므로
   SLS-1-285가 새 네이티브 계열을 들여와도 잡는다. 목록을 lock이 아니라 설치된 `package.json`에서
   읽으므로 lock의 부모 항목에서 줄이 빠진 경우도 잡는다(코드리뷰 MINOR-1).

출력의 「N종」은 이름 수다. `@esbuild/win32-x64`가 두 버전이라 현재는 5종(6건)이다.

| lock | 결과 |
| --- | --- |
| 현재 | exit 0 — 924 패키지, win32-x64 optional 5종(6건) 모두 해석 |
| win32 항목 전부 제거 | dry-run 통과 → 6건 MISSING, **exit 1** |
| `@rolldown/binding-win32-x64-msvc` 하나만 제거 | 1건 MISSING, **exit 1** |
| v1.14.16 (드리프트) | 1단계에서 EUSAGE + `Missing:`/`Invalid:` 목록, **exit 1** |

## `npm ci`의 판정 기준 (스크래치 실험, `--dry-run --ignore-scripts`)

| 상황 | 결과 |
| --- | --- |
| 현재 그대로 | 성공 |
| `package.json` `version`만 올림(lock은 그대로) | **성공 (exit 0)** |
| `dependencies.dompurify`를 lock이 만족하지 못하는 `3.4.0`으로 | **실패 (exit 1, EUSAGE "… are in sync")** |

v1.14.15·16은 `package.json`만 버전을 올리고 lock 루트 버전은 1.14.14에 남아 있었다.
그래도 첫 줄 결과대로 **버전만 올리는 지금 릴리스 방식은 막히지 않는다.**
`validate-lockfile.js`는 의존성 버전만 비교한다.

## 검증

1. YAML 파싱: actionlint가 없으므로 `js-yaml`로 파싱하고 두 스텝의 모양을 단언한다.
2. `rm -rf node_modules && npm ci` 로컬 성공(mac): exit 0, 953 패키지.
3. `check-lock-win32.sh`: 현재 lock exit 0, 변이·드리프트 lock exit 1(위 표).
4. 회귀: `npm run build`, `npm run test:unit`, `npm run lint`, E2E. `npm ci`로 설치한
   **mac 트리가 멀쩡하다는 증거일 뿐 Windows 증거는 아니다.**
5. Windows에서의 실제 동작은 원격 실행 없이는 확인할 수 없다. 아래 권고안으로 넘긴다.

## 원격 검증 권고안 (실행하지 않음)

- 이 워크플로에는 `workflow_dispatch`가 **이미 있다**(7행). 병합 후 main에서 Actions 탭으로
  수동 실행하면 Release 스텝은 `startsWith(github.ref, 'refs/tags/')` 조건에 걸려 건너뛴다.
  설치와 패키징만 돌려 볼 수 있다. 다음 릴리스 태그 전에 한 번 돌리기를 권한다.
- 이 실행에는 부수 효과가 있다. **main ref에 npm 캐시가 저장돼** 이후 태그 실행이 그 캐시를 재사용한다.
  단, Actions 캐시는 7일간 접근이 없으면 지워진다. 릴리스 간격이 그보다 길면 재사용되지 않는다.
- 산출물(installer)이 Actions artifact로 올라가지만 Release는 만들어지지 않는다.

## 태그 빌드가 실패했을 때

태그 빌드는 **태그가 가리키는 커밋의** 워크플로와 lock으로 돈다. main을 revert해도 이미 실패한
태그는 고쳐지지 않는다.

1. lock 불일치(EUSAGE)가 원인이면 `npm install`로 lock을 맞춰 커밋한다.
2. 태그를 다시 붙인다. 같은 버전 태그를 옮기거나 버전을 올린다.
   버전을 올리면 `extract-whatsnew`가 `release/index.html`에 그 버전 항목을 요구한다.

## 병합 순서 주의 — 코디네이터 확인 항목

SLS-1-285가 `package.json`·lock을 바꾼다. 두 티켓을 병합한 뒤 **다음 태그 전에** 아래를 돌린다.

```bash
bash docs-internal/ai-pm/SLS-1-286/check-lock-win32.sh .
```

exit 0이 아니면 태그를 붙이지 않는다. EUSAGE는 lock 동기화 문제이고, MISSING은 lock을
`node_modules` 없이 다시 만들어야 한다는 뜻이다(npm/cli#4828).

## 범위 밖 (후속 제안)

- `.githooks/pre-push`에 `npm ci --dry-run --ignore-scripts`를 넣어 CI 전에 드리프트를 잡는다.
- `node-version: '22'`는 부동 버전이다. 러너의 npm이 바뀌면 lock 해석이 달라질 수 있다.
