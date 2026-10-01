# SLS-1-296 플랜

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

작성: 2026-10-01 · 근거: `SLS-1-296-direction.md`

## 변경

1. `package.json` `dependencies.dompurify`: `^3.4.15` → `^3.4.16`
2. `package-lock.json`: `node_modules/dompurify` 3.4.15 → 3.4.16 **한 항목**(프로덕션). 그 밖의 변경이 있으면 멈추고 원인을 본다.
3. `docs/` 재생성: purify 청크 + 그것을 import 하는 6개 진입 청크(compost·feedback·feedbackAdmin·labelPrint·settings·soil)와 HTML 6개.
4. 설명서 배지: `sync-version` 이 빌드 시점의 월을 찍는다 → `src/manual/index.html`·`docs/manual/index.html` 은 **함께 되돌려** 커밋하지 않는다(SLS-1-292 와 같은 처리).
5. `@grpc/grpc-js`: **코드·lock 변경 없음.** 도달 불가 근거를 `docs-internal/guides/decisions.md` 에 한 항목으로 남기고(재검토 조건 포함), 알림 dismiss 는 사용자 결정으로 보고한다.

## 검증

- lock 전수 비교(HEAD 대비): 프로덕션 변경이 `dompurify` 하나뿐, 출처 registry.npmjs.org.
- 산출물: 새 purify 청크의 `version="3.4.16"`, 청크 이름 집합 동일, 진입 청크 6개 비교. **검증된 성질만 기록한다**: 6개 모두 바이트 크기 동일, 2개는 해시 치환 후 완전 동일, 4개는 지역 변수 두 개의 전단사 교환뿐(`F↔_`·`A↔_`·`I↔_`·`m↔u`), 속성 위치 교환 0. 원인은 적지 않는다(플랜 리뷰: Rollup 이 esbuild 에 넘기는 것은 최종 해시가 아니라 플레이스홀더라 「문자 빈도 설명」은 맞지 않고, 실제 원인은 재빌드 비교 없이는 확정 불가).
- purify 청크 자체: 3.4.15 → 3.4.16 의 diff 가 라이브러리 변경 범위인지(앱 코드 아님).
- unit · lint · E2E 전체(이 워크트리 `docs/` 서빙, 포트 확인). **E2E 의 sanitize 관련 스펙이 3.4.16 에서 통과**하는지(유닛은 DOMPurify 를 목으로 바꿔 신호가 없다 — `tests/unit/setup.js:4-6`).
- 패키징 스모크(SLS-1-292 의 13개 페이지 스크립트): CSP 위반·오류가 SLS-1-292 결과와 같은지(기존 3개 항목 외 신규 0), 실사용 폴더 무변경.
- audit: `dompurify` 항목 소멸, 남는 프로덕션 4건은 `@grpc/grpc-js` 계열(firebase·@firebase/firestore·firestore-compat 전이)뿐.

## 배포

`docs/` 가 바뀌므로 main push 즉시 웹판에 반영된다. 설치본에는 다음 릴리스. 사용자에게 보이는 변화 없음 — 릴리스 노트·팝업 없음. 릴리스 전에 Windows CI 는 SLS-1-292 에서 이미 한 번 확인했다.
롤백: 커밋 하나.
