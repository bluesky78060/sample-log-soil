# SLS-1-295 코드리뷰

판정: **승인** — 최종 CRITICAL 0 / MAJOR 0 / MINOR 0 / SUGGESTION 3(수용·후속).

## 1라운드 (수정 전)

| 레인 | 결과 | 주요 지적 |
| --- | --- | --- |
| codex (`codexa`) | APPROVE 0/0/3/2 | 정적 가드의 `importmap` 허용, docs 참조 검사기 범위 협소, 청크 증빙 서술 오류(38B → 45B) |
| code-reviewer | REQUEST CHANGES 0/1/4/5 | **MAJOR**: `pages-final.json` 이 참조가 끊긴 중간 상태 실행이라 README 와 불일치. 4개 청크의 import 순서 변경(frame-guard 가 맨 앞이 아님), 집계 숫자·기준선 증거·방향 문서 잔존 |

조치: 최종 `docs/` 로 13개 페이지 스모크·클릭 재실행해 교체, 새 두 모듈 첫 줄에 `import '../shared/frame-guard.js'`(polyfill 공유 청크 분리와 기존 청크 10개의 해시·순서 변경이 함께 해소 — docs 변경은 HTML 2개 + 새 청크 2개뿐), 검사기 보강, 기준선을 현재 스펙으로 재측정, 기록 정정.

## 2라운드 (수정본)

- **codex 레인은 돌지 못했다.** `codexa` 5슬롯이 모두 사용 한도(exit=1, 출력 0바이트, stderr `usage limit`). 「지적 없음」이 아니라 「리뷰 안 돌음」이다. 이 라운드의 독립 검토는 **critic 하나**뿐이다.
- critic(적대적): CRITICAL 0 / MAJOR 1 / MINOR 4 / SUGGESTION 2. 제품 코드·docs 산출물·기록의 핵심 주장은 **반증 실패**(HEAD `docs/assets` 72/72 해시 동일, 참조 165/165·청크 import 86/86 존재, 인라인 0, 복사 문자열 `===` 동일, 개수 32/9 일치).
  - **MAJOR** `smoke/run.sh` 가 저장소 루트의 `.env`·`feedback-auth.json` 을 비우고 지움(gitignore 대상 실제 자격증명 유실 위험, 메인 체크아웃에 실물 있음) → 수정: 이미 있으면 중단, `trap` 으로 자기가 만든 것만 정리, 출력은 `.omc/run-<라벨>/`. 보호 동작 시험(`SECRET` 보존 확인).
  - MINOR 「기존 청크 75개」 → 「72개(JS 29)」, 증거 출처·스크립트 경로 README 추가, `INLINE_HANDLER` 의 한계(`onClick`·`onbeforeunload` 등)를 주석·테스트 이름에 명시, 주석 이력 서술 제거.
- 수정 후 재확인: 정적 32 · docs-references + 클릭 9 통과, lint 6 경고(여유 0).

## 수용한 것

- `localRefs()` 가 점 없는 상대 참조(10개, 현재 모두 존재)·`?`/`#` 붙은 참조·vite `__vite__mapDeps` 를 보지 않는다 — 현재 docs/ 에 해당 위반 0, 필요할 때 보강.
- `.toggle-btn` CSS(죽은 코드)는 이 티켓이 동작만 고치는 범위라 둔다.
- 2라운드 codex 는 한도 복구 뒤 필요하면 별도로 돌린다(a2 슬롯 메시지는 10월 15일 복구라 「290분」은 슬롯마다 다르다 — `codexa` 로 확인).
