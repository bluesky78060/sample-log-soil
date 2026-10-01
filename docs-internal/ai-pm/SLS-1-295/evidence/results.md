# SLS-1-295 결과 요약 (최종 상태 기준)

- 기준선(수정 전 HTML + **현재 스펙**, CSP 헤더 주입 E2E): **5건 모두 실패**. 전체 출력 `baseline-e2e-before-fix.txt`(Expected/Received 10줄 포함) — 실패 지점은 모두 「클릭했는데 효과 없음」(탭 `active` 미부착, FAQ `open` 미부착, 체크 `checked` 미부착, 복사 문구 `복사` 유지, 다크 `data-theme` 유지). 사전 조건 단언은 통과 — 스펙 오류가 아니라 CSP 로 인한 동작 불능. (이전 판 기준선은 이전 스펙 행 번호로 측정돼 있었다 — 현재 스펙으로 다시 쟀다.)
- 수정 후: 같은 5건 통과, **20회 반복 100/100**.
- 변이: 정적 6종(release 인라인 `<script>` · onclick 되살림 · 대문자 SCRIPT · `data-src` 위장 · `javascript:` URL · JS 안 `onclick` 문자열) · E2E 2종(`copy-json` 의 `data-action` 항목 제거 · `data-tab` 오타 — 어느 요소를 지우느냐에 따라 검출 여부가 다르다: FAQ 테스트는 첫 항목만 보므로 FAQ 의 다른 항목은 못 잡는다) · docs 참조 2종(참조 청크 삭제 · 옛 HTML 되돌림) — 전부 검출.
- 최종 전체: **unit 1004**(972 + `no-inline-script` 32) · lint 경고 6(여유 0 유지) · **E2E 505**(496 + 클릭 5 + `docs-references` 4).
- 산출물: `docs/release`·`docs/manual/firebase-setup` 인라인 `<script>`·`onclick=` 0, `docs/` 전체에도 0. **`docs/` 변경은 HTML 2개 수정 + 새 청크 2개(`release-*.js`·`firebaseSetup-*.js`)뿐**, 기존 `docs/assets` 72개(JS 청크 29개)가 모두 같은 이름·같은 해시로 남았다. HTML 로컬 참조 165개 누락 0.

## 중간에 만났던 부수 효과 — 새 공유 청크 `modulepreload-polyfill` (해소됨)

새 모듈 두 개가 처음에는 `frame-guard` 를 import 하지 않았다. vite 의 `modulepreload` polyfill(711B)은 원래 `frame-guard.js` 청크 안에 있었는데, `frame-guard` 를 안 쓰는 진입점이 생기자 vite 가 polyfill 을 **별도 공유 청크로 분리**했다. 그 결과 기존 진입 청크 10개가 **바이트로 정확히 +45B**(`import"./modulepreload-polyfill-XXXXXXXX.js";` 한 구문이 맨 앞에 추가) 늘고 minifier 가 지역 변수 이름을 재배치했으며, `soil`·`compost`·`compostAnalysis`·`heuktoram` 4개 청크는 import 순서가 `frame-guard → address-parser` 에서 `polyfill → address-parser → frame-guard` 로 바뀌어 `frame-guard` 가 맨 앞이라는 의도(`src/soil/soil-entry.js:1`)와 어긋났다.
**해소**: 두 모듈의 첫 줄에 `import '../shared/frame-guard.js'` 를 넣어 모든 진입점이 다시 polyfill 과 `frame-guard` 를 함께 쓰게 했다 → polyfill 이 `frame-guard` 청크(882B, 해시 `BIL41LH3`)로 돌아가고 공유 청크가 사라져 기존 청크가 한 바이트도 바뀌지 않는다. 부수적으로 이 두 페이지도 다른 페이지처럼 클릭재킹 방어(SLS-1-132)를 받는다(기존에도 없던 공백).
(서술 이력 — 초안은 「길이 차이 정확히 38B, import 한 구문 교체」였고 codex 가 샘플 청크에서 45B·이름 재배치를 잡아 정정했으며, 이어 코드리뷰가 「순서 그대로」가 4개 청크에서 틀렸음을 잡았다. 둘 다 샘플을 일반화한 오류였다.)

## 놓칠 뻔한 것 — 설명서 배지를 되돌리다 참조가 끊김

`sync-version` 이 빌드 시점의 월을 찍어 `docs/manual/index.html` 배지가 「10월」이 된다. 이를 `git checkout -- docs/manual/index.html` 로 되돌리면 **청크 해시가 바뀐 빌드에서는** HTML 이 이미 없는 옛 청크를 가리킨다 — 중간 상태에서 패키징 스모크가 `manual/index.html` 의 `ERR_FILE_NOT_FOUND` 로 잡았다. 앞으로 청크가 바뀌는 빌드에서는 되돌리지 말고 `sed` 로 월 표기만 고친다(`src/manual/index.html` 은 소스라 checkout 해도 안전). 재발 방지로 `tests/e2e/docs-references.spec.js` 를 추가했다(옛 HTML 되돌림을 그대로 재현해 검출 확인).

## 남긴 것

- `src/release/index.html` 의 `.toggle-btn`·`.version-card.collapsed` CSS 는 JS 블록을 지운 뒤 완전히 죽은 코드다. 이 티켓은 동작만 고치는 범위라 건드리지 않았다(통합본에 있던 기능인지 확인하지 않음 — 방향 문서 「정정」).
