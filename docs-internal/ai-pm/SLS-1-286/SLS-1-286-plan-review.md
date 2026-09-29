# SLS-1-286 플랜 리뷰

> 정본. 훅 통과용 사본은 `docs/02-review/`. 리뷰어: `critic` 에이전트(Opus, 읽기 전용).

## 1R — REVISE (CRITICAL 0 · MAJOR 2 · MINOR 4 · SUGGESTION 4)

- **MAJOR 1** 캐시 제거 근거의 전제가 틀렸다. 태그 실행에서는 캐시가 애초에 복원되지 않는다.
  러너 로그(v1.14.14~17)가 모두 `npm cache is not found`이고, 원인은 Actions 캐시의 ref 범위다.
  캐시 경로도 `C:\npm\cache`다. 결론(지워도 된다)은 오히려 강해진다.
- **MAJOR 2** 병합 후 확인으로 제시한 `npm ci --dry-run`은 win32 바이너리 누락을 잡지 못한다.
  lock에서 win32 항목을 모두 지워도 exit 0이다(`--os=win32` 포함).
- MINOR: git 의존성 `@electron/node-gyp`는 무결성 검사 제외 / 태그가 실패하면 revert만으로는 복구되지 않는다 /
  mac 회귀 검증은 Windows 증거가 아니다 / 재시도 설명은 대체로 맞다.
- SUGGESTION: v1.14.14·16의 실제 드리프트를 근거로 쓸 것 / `@emnapi` 사례의 성질을 적을 것 /
  pre-push에 dry-run 추가 / `node-version` 부동 버전.
- install과 ci의 차이 때문에 Windows에서 새로 생기는 실패 경로는 없다. 확인한 것: 루트 lifecycle,
  peer, git·URL 의존성, CRLF, npm 버전(러너 10.9.8). win32 모의 설치 결과 924 패키지로 러너와 같다.

## 반영

플랜을 전면 수정하고 `check-lock-win32.sh`를 추가했다. 실제 설치로 win32 완전성을 본다.

## 2R — APPROVE (CRITICAL 0 · MAJOR 0 · MINOR 3 · SUGGESTION 3)

1R 지적은 모두 해소됐다. 남은 것은 스크립트의 진단 품질 문제다.

- MINOR 1 실패 시 `tail -20`이 npm Usage 블록에 가려 `EUSAGE`가 보이지 않는다
  → `npm error (code|Missing|Invalid)` 줄을 grep하도록 고쳤다.
- MINOR 2 바이너리 목록이 고정돼 있어 SLS-1-285가 들여오는 새 계열을 놓친다
  → 설치된 모든 패키지의 win32-x64 optional 의존성을 Node 해석 규칙으로 확인하도록 고쳤다.
- MINOR 3 `grep -m1 added`가 `set -e` 아래에서 오탐할 수 있다 → `|| true`를 붙였다.
- SUGGESTION `.npmrc` 복사 / Actions 캐시 7일 만료 / 「세 태그」 표현 정정 → 모두 반영했다.

반영 후 다시 실행한 결과:

| lock | 결과 |
| --- | --- |
| 현재 | exit 0 (5종·6건 해석) |
| win32 항목 전부 제거 | exit 1 (6건 MISSING) |
| rolldown 하나만 제거 | exit 1 (1건 MISSING) |
| v1.14.16 | exit 1 (EUSAGE와 목록 표시) |

2R 판정이 APPROVE이므로 3R 없이 구현으로 넘어간다. 스크립트 수정본은 코드리뷰에서 다시 본다.
