# SLS-1-286 코드리뷰

> 정본. 훅 통과용 사본은 `docs/03-code-review/`.

대상: `.github/workflows/build.yml`(+2/−4), `docs-internal/ai-pm/SLS-1-286/check-lock-win32.sh`(새 파일).

## 1R

### `code-reviewer`(Claude Opus) — APPROVE (CRITICAL 0 · MAJOR 0 · MINOR 2 · SUGGESTION 3)

워크플로 변경으로 Windows 러너에 새 실패 경로가 생기지 않는다. optional 플랫폼 바이너리,
git 의존성, 설치 스크립트, 캐시 동작 모두 `npm install`과 경로가 같다. 나머지 스텝은 바뀌지 않았다.

- **MINOR-1** 스크립트가 optional 목록을 설치된 패키지가 아니라 lock에서 읽는다. 부모 항목에서
  win32 줄이 빠지면 `npm ci`는 바이너리를 설치하지 않는데 검사는 통과한다.
- **MINOR-2** 플랜 3단계 설명(「이름에 `win32-x64`」)이 실제 선택 기준(정규식 + lock `os`/`cpu`)과 다르다.
- SUGGESTION-1 루트(`key ""`)의 optional 의존성을 보지 않는다.
- SUGGESTION-2 semver가 아닌 범위(`npm:` 별칭 등)는 무조건 MISSING이다. 실패 쪽이라 안전하다.
- SUGGESTION-3 문서 「6건」과 출력 「5종」이 어긋나 보인다(esbuild 두 버전).
- 참고: 스크립트가 intent-to-add(빈 blob) 상태다. 커밋 전 `git add` 필요.

### `codexa` 독립 리뷰 — 차단 없음 (CRITICAL 0 · MAJOR 0 · MINOR 0 · SUGGESTION 1)

- SUGGESTION 플랜이 `@electron/node-gyp`에 무결성 정보가 없다고 쓴 것처럼 읽히는데 lock에는
  `integrity`가 있다.
  → 확인 결과 플랜의 요지는 맞다. npm 10.9.8 `pacote/lib/git.js` 32–35행이 git 의존성의
  `integrity`를 지우고 「skipping integrity check for git dependency」를 남긴다(npm/rfcs#525).
  lock에 값이 있어도 비교하지 않는다는 뜻으로 문구를 고쳤다.

## 반영

| 지적 | 처리 |
| --- | --- |
| MINOR-1 | 설치된 `<key>/package.json`의 `optionalDependencies`를 읽고, 없으면 lock으로 폴백 |
| MINOR-2 | 플랜 3단계를 실제 기준(정규식·`os`/`cpu`, 설치된 `package.json`)으로 고침 |
| SUGGESTION-1 | 루트도 검사(`if (key && !exists)`) |
| SUGGESTION-2 | 반영 안 함 — 실패 쪽이고 MISSING 줄에 범위가 그대로 찍힌다 |
| SUGGESTION-3 | 문서를 「5종(6건)」으로 맞춤 |
| codexa SUGGESTION | 플랜 문구 정정(위) |
| intent-to-add | 커밋 시 `git add`로 실제 내용 스테이지 |

수정 후 실측(스크래치 폴더, `--os=win32 --cpu=x64` 실제 설치):

| lock | 수정 전 스크립트 | 수정 후 |
| --- | --- | --- |
| 현재 | exit 0 | exit 0 — 924 패키지, 5종 누락 0 |
| win32 항목 전부 제거 | exit 1 | exit 1 — 6건 MISSING |
| rolldown 자식 항목만 제거 | exit 1 | exit 1 — 1건 MISSING |
| rolldown 부모 줄 + 자식 항목 제거 (MINOR-1 시나리오) | **exit 0 (놓침)** | **exit 1** — 1건 MISSING |
| v1.14.16 태그 lock | exit 1 | exit 1 — EUSAGE + `Missing:`/`Invalid:` |

수정 전 스크립트가 MINOR-1 시나리오를 놓치는 것을 변이로 확인했으므로, 이 수정은 실제 결함을 닫는다.

## 2R — 수정본 재리뷰

찾은 쪽(code-reviewer)과 고친 쪽(오케스트레이터)이 다르므로 수정 diff를 `codexa`에 다시 넣었다.

**CRITICAL 0 · MAJOR 0 · MINOR 0 · SUGGESTION 0.** 루트 포함 오탐 없음(루트 `package.json`은 원본 복사),
설치본 우선 읽기가 1R 누락을 막음, JSON 파싱 실패는 fail-closed, 변수 충돌 없음.

## 검증 (로컬, mac)

- YAML: actionlint 미설치 → `js-yaml` 파싱. 10 스텝, Install=`npm ci`, `Clean npm cache` 없음, `npm install` 문자열 없음, 스텝 순서 유지.
- `rm -rf node_modules && npm ci` exit 0 (953 패키지).
- `npm run build` exit 0 — `docs/`·`src/manual/index.html` 추적 변경 없음.
- `npm run test:unit` 60 files / 925 tests 통과.
- `npm run lint` 0 errors, 6 warnings(기존, 허용치 6).
- E2E: 첫 실행 408 passed / 88 failed — 전부 `ERR_CONNECTION_REFUSED http://localhost:8888`.
  `reuseExistingServer`가 다른 워크트리의 8888 서버에 붙었다가 그 서버가 내려간 것이다.
  같은 이유로 통과분도 다른 워크트리의 `docs/`를 봤을 수 있어, 포트만 18286으로 바꾼 임시 config(커밋하지 않고 삭제)로
  전체를 다시 돌렸다: **496 passed**.
- Windows 실행은 확인하지 않았다(원격 실행 금지). 권고안은 플랜 「원격 검증 권고안」.

## 판정

**APPROVE** — 합계 CRITICAL 0 · MAJOR 0 · MINOR 2(반영) · SUGGESTION 4(3 반영, 1 비반영 사유 기재).
