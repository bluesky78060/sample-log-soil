# SLS-1-287 플랜 리뷰

> 정본. 훅 통과용 사본은 `docs/02-review/`.

리뷰어: `critic` 에이전트(Opus, 읽기 전용) · 1라운드 · 판정 **APPROVE** — CRITICAL 0 / MAJOR 0 / MINOR 4 / SUGGESTION 5

## 리뷰어가 실측한 것

- 플랜 절차(A → B npm 11.20.0 → C/D → npm 10 두 번)를 HEAD부터 스크래치에서 다시 돌림: 결과 lock이 사전 조사 lock(+D)과 **차이 0**, npm 10 두 번째 실행 멱등.
- lock 차이 85항목 전부 `dev`, prod 0. audit 49 → 24(critical 0 / high 23 / moderate 1). `--omit=dev` 0.
- tar 7: 호출 3곳 줄번호 일치, `filter(path, entry)`·`onwarn(code, message, data)` 시그니처가 tar 6과 같음. upstream node-gyp 11.0.0의 `tar.extract` 블록과 현 @electron/node-gyp 블록 diff = 동일(node-gyp 11은 tar ^7). 스모크(file·stream·`tar.x`) 통과.
- tmp 0.2.7: `tmpNameSync({postfix})` 정상. 절대경로 `dir`은 거부되지만 external-editor는 `dir`을 넘기지 않음. 소비처는 `forge init`뿐.
- tailwind CLI를 HEAD deps·새 deps로 돌린 결과 둘 다 커밋본 `tailwind-output.css`와 동일. vite build도 같은 설치 경로 기준 diff 0.
- concurrently 9.2.4 / wait-on(joi 18.2.9) 스모크 exit 0.

## 지적과 반영

| # | 심각도 | 지적 | 반영 |
| --- | --- | --- | --- |
| 1 | MINOR | `forge.config.js:15` `extraResource`의 `.env`·`feedback-auth.json`이 워크트리에 없어 `electron-forge package`가 ENOENT | 검증표에 자리표시 생성·삭제 절차 추가 (SLS-1-285 선례) |
| 2 | MINOR | npm 11은 최종 lock에서 멱등이 아님(esbuild optional peer 27개 삭제) — HEAD에도 있는 성질 | B절·남는 것에 "npm 11 뒤 반드시 npm 10 정규화" 명시 |
| 3 | MINOR | `npx -y npm@11`이 버전 미고정 | `npm@11.20.0`으로 고정 |
| 4 | MINOR | Windows CI `npm install` → `npm run make` 실경로 미검증 | push 금지라 이 워커는 불가 → 남는 것·보고서에 코디네이터 결정으로 넘김 |
| S | SUGGESTION | `npm ls` 판정 기준, rolldown wasm 서술 정정, concurrently·wait-on 스모크, 기각 대안 기록, 사전 조사 lock과 비교 단계, 명령 목록 명시 | 모두 반영 |

## 관찰 (점수 외)

vite build 청크 해시가 node_modules **절대 경로**에 민감하다 — 같은 HEAD deps라도 `/private/tmp`에 설치해 빌드하면 24개 파일 해시가 달라진다.
같은 워크트리에서 비교하면 유효하다. 원인은 조사하지 않았다(rollup 모듈 순서 추정). 플랜의 "diff가 나면" 행에 반영.
