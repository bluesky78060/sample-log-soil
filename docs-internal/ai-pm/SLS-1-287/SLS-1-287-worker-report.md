# SLS-1-287 워커 보고

브랜치 `bluesky78060/sls-287-devdeps` · 기준 aca0699 · 작업 커밋 a769e20 + 이 보고서 커밋. **push·태그·릴리스 안 함.** AI PM: done.

## 요약

tar·tmp overrides와 범위 안 전이 의존성 lock 갱신으로 `npm audit` 49 → 24(critical 0), Dependabot 비-electron 56건 중 50건을 해소했다.
prod lock 변경 0, `npm audit --omit=dev` 0, docs/ 빌드 diff 0. 잔존은 vite 3·esbuild 1(vite 메이저 필요)과 범위 밖 extract-zip 2.

## 변경

| 파일 | 내용 |
| --- | --- |
| `package.json` | overrides `tar ^7.5.22`, `tmp ^0.2.7` · 하한 `concurrently ^9.2.4`, `postcss ^8.5.23`, `vitest ^4.1.11` |
| `package-lock.json` | 추가 8 / 삭제 11 / 변경 66, 전부 dev (`evidence/lock-diff.txt`) |

## 결과

| 항목 | 수치 |
| --- | --- |
| `npm ci` | 성공 (npm 10.9.8), `npm ls --all` exit 0 |
| `npm audit` | 49 (c1/h38/m5/l5) → 24 (c0/h23/m1/l0) |
| `npm audit --omit=dev` | 0 |
| Dependabot 비-electron | 56 → 잔존 6 (vite 3, esbuild 1, extract-zip 2) |
| build | 성공, `docs/`·`src/` diff 0 |
| unit / lint | 925/925 · 0 errors, 6 warnings |
| E2E | 496/496, 재실행 없음 |
| `electron-forge package` | 성공 (darwin-arm64), `out/`·자리표시 삭제 |
| tar 7 실경로 | `@electron/node-gyp install --target=39.8.10` 헤더 다운로드·체크섬·해제 성공 |

## 리뷰

- 플랜: critic APPROVE — C0 / M0 / MINOR 4(반영) / S5
- 코드: code-reviewer APPROVE (C0/M0/m2/S2) + codexa APPROVE (C0/M0/m0/S1) → 합계 C0 / M0 / MINOR 2(처리) / S3

## 코디네이터·사용자 결정이 필요한 것

1. **vite 5 → 6.4.3+ 메이저 이전** (vite 3·esbuild 1건). dev 서버 한정 취약점이지만 docs/ 산출물이 바뀐다 → 별도 티켓 여부.
2. **extract-zip 2건 + forge 체인 audit 19건**: extract-zip은 수정본이 없다. electron 메이저(≥40.10.3) 결정과 함께 판단.
3. **Windows CI 실경로 미검증**: `build.yml`의 `npm install`(npm 10) → `npm run make`. push 금지라 못 돌렸다 → 병합 후 `workflow_dispatch` 한 번 또는 다음 태그에서 확인.
4. **npm 10.9.8 arborist 버그**: vitest를 다시 올리면 `edgesOut` null 크래시가 난다. 우회 절차(npm 11.20.0으로 lock만 해석 → npm 10 정규화)는 플랜에 있다. Node 24(npm 11)로 옮기려면 CI도 함께 옮겨야 한다(esbuild optional peer 27개 왕복).
5. **(SUGGESTION)** 게시 4~5일 된 dev 버전(undici 7.30.0, rolldown 1.2.11, vite 8.3.1) — 공급망 쿨다운 정책을 둘지.
6. **(SUGGESTION, 미채택)** tar·tmp override를 소비자별 scoped로 좁힐지 — 기존 전역 형식과의 일관성을 택했다.

## 못 한 검증

- Windows CI(위 3).
- 패키징된 앱 실행은 하지 않았다(지시상 불필요). 따라서 `~/Library/Application Support/토양 시료 접수 대장`은 건드리지 않았다.
