# SLS-1-286 워커 보고

## 요약

1. `.github/workflows/build.yml`에서 `Clean npm cache` 스텝을 지우고 `npm install`을 `npm ci`로 바꿨다. 다른 스텝은 그대로다.
2. 현재 lock에는 Windows x64 optional 바이너리 5종(6건)이 모두 들어 있다(`@esbuild/win32-x64` 0.21.5·0.28.2, `@rollup/rollup-win32-x64-msvc`·`-gnu`, `@rolldown/binding-win32-x64-msvc`, `lightningcss-win32-x64-msvc`). win32로 모의 설치한 결과는 924 패키지로 러너와 같았다. 리뷰 두 레인 모두 `npm ci` 전환이 새 실패 경로를 만들지 않는다고 판정했다.
3. 남은 것은 Windows에서 실제로 돌려 보는 검증이다. 원격 실행은 금지라 하지 않았다. 권고안은 아래에 있다.

## 커밋

- 브랜치: `bluesky78060/sls-286-ci`
- 커밋 해시: `git log -1 bluesky78060/sls-286-ci`로 확인한다. worker_done 본문에도 적는다.
- push·태그는 하지 않았다.

## AI PM

SLS-1-286 **done**. start_work는 이전 워커가 했고, 이번에 submit_test(overall pass) → approve_review를 거쳤다. 활성 티켓은 해제했다.

## 검증 수치 (로컬 mac)

| 항목 | 결과 |
| --- | --- |
| YAML | actionlint가 없어 `js-yaml`로 파싱했다. 10 스텝, Install=`npm ci`, Clean 스텝 없음, 순서 유지 |
| `rm -rf node_modules && npm ci` | exit 0, 953 패키지 |
| `check-lock-win32.sh .` | exit 0 — 924 패키지, 5종, 누락 0 |
| `npm run build` | exit 0 — `docs/`·manual 배지에 추적 변경 없음 |
| `npm run test:unit` | 60 files / 925 tests 통과 |
| `npm run lint` | 0 errors, 6 warnings(기존) |
| E2E | 1차 408 passed / 88 failed → 격리 포트 재실행 496 passed |

- **유닛 테스트 불일치는 환경 문제였다.** 이전 워커는 51 files / 842 tests였다. 깨끗한 `npm ci` 뒤에는 60 / 925가 정상으로 나왔다.
- **E2E 1차 실패 88건은 전부 `ERR_CONNECTION_REFUSED localhost:8888`이다.** `playwright.config.js`의 `reuseExistingServer`가 다른 워크트리가 띄운 8888 서버에 붙었다가 그 서버가 내려간 것이다. 1차에서 통과한 테스트도 다른 워크트리의 `docs/`를 대상으로 돌았을 수 있다. 그래서 포트만 18286으로 바꾼 임시 config로 전체를 다시 돌렸다. 이 config는 실행 후 지웠고 커밋하지 않았다. → **병렬 워크트리에서 E2E를 돌리면 포트가 충돌한다. 후속 티켓 후보다.**

## 리뷰 판정

- **플랜 리뷰(critic)**: 1R REVISE, 2R APPROVE. 이전 워커가 진행했다.
- **코드리뷰 1R**
  - code-reviewer: APPROVE (C0/M0/MINOR2/S3)
  - codexa: C0/M0/MINOR0/S1
- **수정**
  - 스크립트: 목록을 설치된 `package.json`에서 읽는다. 루트도 검사한다.
  - 문서: 문구를 정정했다.
  - 변이 검증: 부모 줄과 자식 항목을 함께 지운 lock에서 **수정 전 exit 0(놓침) → 수정 후 exit 1**이다.
- **코드리뷰 2R**(codexa, 수정본): C0/M0/MINOR0/S0
- **합계**: CRITICAL 0 · MAJOR 0 · MINOR 2(반영) · SUGGESTION 4(3 반영) → **APPROVE**

## `check-lock-win32.sh`를 커밋한 이유

- 플랜에서 병합 후 **태그를 붙이기 전의 확인 절차**로 쓰는 스크립트다. SLS-1-285가 lock을 바꾸기 때문이다.
- `npm ci --dry-run`은 win32 바이너리 누락을 잡지 못한다. 그것을 잡는 수단이 이 스크립트뿐이다.
- `docs-internal/`에 있어 빌드·설치본에는 실리지 않는다.
- 상설 도구(`scripts/`, pre-push)로 올릴지는 범위 밖이라 후속 제안으로 남긴다.

## 코디네이터 / 사용자가 결정할 것

1. **SLS-1-285와 병합한 뒤 다음 태그를 붙이기 전에** `bash docs-internal/ai-pm/SLS-1-286/check-lock-win32.sh .`를 실행한다. exit 0이 아니면 태그를 붙이지 않는다.
2. **원격 검증(권고, 하지 않음)**: 병합 후 main에서 Actions의 `workflow_dispatch`(이미 있음)로 한 번 수동 실행한다. Release 스텝은 태그 조건에 걸려 건너뛰고, 설치와 패키징만 돈다. 부수 효과로 main ref에 npm 캐시가 저장된다.
3. **태그 빌드가 실패하면**: main을 revert해도 이미 실패한 태그는 고쳐지지 않는다. lock을 맞춘 뒤 태그를 다시 붙인다. 자세한 절차는 플랜에 있다.

## 못 한 검증

- Windows 러너에서의 실제 `npm ci`와 패키징(원격 실행 금지).
- actionlint·shellcheck(설치돼 있지 않음). YAML 파서와 `bash -n`으로 대신했다.
