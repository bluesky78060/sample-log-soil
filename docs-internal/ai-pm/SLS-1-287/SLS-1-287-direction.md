# SLS-1-287 방향 — 개발 의존성 취약점 정리 (electron 제외)

> 정본. 훅 통과용 사본은 `docs/00-discovery/`.

작성: 2026-09-29 · 출처: Orca 코디네이터 작업 지시(task_0a94182a54c6) + 착수 전 정정 메시지(msg_ff8a213e6afe) + AI PM 티켓 본문.
이 워커는 사용자와 직접 문답하지 않았다 — 아래는 지시문에서 옮긴 것이다.

| 카테고리 | 확정 내용 |
| --- | --- |
| 목표(Why) | Dependabot development 알림 정리. 티켓 본문의 "18건"은 1차분이고, 정정 기준 **비-electron 56건**(xmldom 10, tar 8, fast-uri 7, undici 5, ip-address 5, vite 3, brace-expansion 3, tmp 2, postcss 2, joi 2, extract-zip 2, vitest 1, shell-quote 1, postcss-selector-parser 1, esbuild 1, browserslist 1, baseline-browser-mapping 1, @vitest/mocker 1) |
| 사용자(Who) | 개발자·CI. 대상은 빌드·테스트·패키징 도구로 설치본·웹 번들에 실리지 않는다 |
| 범위(What) | `package.json` devDependencies·overrides, `package-lock.json`. `src/`·`docs/` 불변 |
| 범위 밖 | electron 32건·extract-zip 2건(수정본 없음, electron 메이저 이전과 함께 별도 결정) |
| 제약 | `npm audit fix --force` 금지, forge 6.4.2 다운그레이드 금지, vite 메이저(8.x) 금지, dependencies·electron·electron-updater 불변, `npm audit --omit=dev` = 0 유지 |
| 우선순위 | 낮음(개발 환경 한정). 티켓 priority 4 |
| 리스크 | semver 범위 밖 교체(tar 6→7, tmp 0.0.33→0.2.7)가 소비자 API와 맞지 않을 가능성, lock 재해석 중 prod 항목이 딸려 바뀔 가능성, postcss·browserslist 갱신이 CSS 산출물을 바꿀 가능성 |
| 검증 | `npm ci`, audit 전후표, lock 변경 목록(prod 0), build(docs/ diff 0)·unit·lint·E2E, `electron-forge package`, 플랜 리뷰(critic)·코드리뷰(code-reviewer + codexa) |

방향 확정 근거: 코디네이터 지시문의 Target/Change/Constraints/Acceptance와 정정 메시지가 곧 확정 방향이다.
