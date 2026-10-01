# SLS-1-296 코드 리뷰

> 정본. 훅 통과용 사본은 `docs/03-code-review/`.

2026-10-01 · 대상: `package.json`(dompurify 한 줄), `package-lock.json`, `docs/`(재생성), `docs-internal/guides/decisions.md`(grpc 판단 기록), 이 폴더 기록

## 결과

| 레인 | 판정 | C / M / m / S |
| --- | --- | --- |
| `critic` 플랜 리뷰(도달 불가 판단 반증, 차분 실행) | APPROVE | 0 / 0 / 3 / 3 — `SLS-1-296-plan-review.md` |
| `codex` (`codexa`) | APPROVE | 0 / 0 / 1 / 0 — `review-codex.md` |

두 「도달 불가」 판단 모두 반증에 실패했다.
- dompurify: 앱은 `afterSanitizeAttributes` 훅 하나만 쓰고 `IN_PLACE`·`setConfig`·다른 훅이 없다. 3.4.16 의 로직 변경은 `_handleHookDetachedNode` 추가뿐이고 비-IN_PLACE 경로의 앱 훅에는 영향이 없다. jsdom 차분 실행 16종 diffs 0.
- grpc-js: 로드하는 파일은 `@firebase/firestore` 의 Node 진입점뿐, 렌더러는 브라우저 빌드(`WebChannel`), 모든 BrowserWindow 가 sandbox:true·nodeIntegration:false, 메인은 firebase 미사용. 1.9.16 에는 서버 쪽 `getAuthContext` 가 없다.
- lock: 프로덕션 변경 `dompurify` 하나, `registry.npmjs.org`, integrity 있음. docs/ HTML 참조 누락 0, 옛 해시 잔존 0.

## codex MINOR → 반영

패키징 스모크 프로브가 주석과 달리 앱의 `sanitizeHTML` 래퍼·훅을 검증하지 않았다(raw `DOMPurify.sanitize` 만 호출, 출력에 `target` 이 이미 빠져 훅이 실행되지 않음) → 프로브를 앱의 실제 `window.sanitizeHTML` 호출로 고쳐 설치본에서 다시 실행했다: DOMPurify 3.4.16, `rel="noopener noreferrer"` 훅 적용, onerror·script 제거(`PROBE_OK`, `smoke/installed-sanitizeHTML-output.txt`). 고친 쪽(오케스트레이터)과 찾은 쪽(codex)이 달라 수정본은 증거로 재확인했다 — 변경이 검증 스크립트·기록뿐이라 코드·lock 은 그대로다.

## 플랜 리뷰 MINOR → 반영

minifier 지역 변수 이름 변화의 원인 서술을 삭제하고 검증된 성질만 기록(크기 동일·두 이름의 전단사 교환뿐) · grpc 근거를 「문자열 0건」에서 `grpc-js`·`@grpc`·`proto-loader`·`http2` 0건 + `WebChannel` 로 정정 · `decisions.md` 재검토 조건에 1.9.x 백포트와 불변식 3개 추가.

## 검증

npm ci · build · unit 972 · lint 0 errors · E2E 496/496(8888 비어 있는 상태, 4.5m) · 패키징 스모크 13개 페이지(SLS-1-292 와 동일, 신규 0) · 설치본 래퍼 프로브 · audit(`dompurify` 소멸, 남는 4건은 grpc 계열 — 도달 불가 판단).
못 한 것: Windows 실기. 이 변경은 번들 내용이 바뀌는 패치 한 칸이고 Windows CI 는 SLS-1-292 에서 확인했다.
