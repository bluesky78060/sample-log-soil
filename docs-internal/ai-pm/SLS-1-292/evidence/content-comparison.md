# 산출물 내용 비교 (플랜 리뷰 critic 수행, 2026-10-01)

HEAD 와 작업트리의 `docs/assets` 를 이름으로 짝지어 해시 참조를 지우고, 같은 esbuild 0.25 로 다시 들여쓰고 짧은 식별자를 정규화해 비교했다.

- JS/CSS 37개 중 해시 정규화 후 동일 24개 + 같은 esbuild 로 들여쓴 뒤 동일 2개(cache-manager, purify.es) = 26개 동일. 나머지 11개가 아래 차이(크기가 달라진 13개 중 CSS 4개는 `@media` 공백뿐).
- soil.js: 식별자 이름만 바뀜 + 상수 인라인 1건. compostAnalysis.js: 상수 `"@"` 인라인.
- xlsx / xlsx.min / heuktoram-result-importer 의 pako: 상수 접기(`25+4*32`→`153`, `24*60*60*1e3`→`1440*60*1e3`), `!(x&1)`→`(x&1)==0`, `switch(x[0]){}`→`x[0];` — 값 동일.
- index.esm.js(firebase, +2KB): 상수 접기 2건 + 원본에 있던 PIFE 괄호 `enqueueRetryable((…))` 를 esbuild 0.25 가 보존(원본 11 · 구버전 출력 8 · 신버전 11). 의미 차이 없음.
- commonjs `strictRequires: true`: dexie·jszip·xlsx-js-style 이 `function X(){return f||(f=1,…)}` 지연 래퍼. 호출이 모두 정의 직후 최상위라 실행 순서 동일(heuktoram `Ao=Co()`, heuktoram-result-importer `Ot=Rt()`, xlsx.min `Qc=Cu()`), entry 의 `window.XLSX = XLSX` 가 여전히 마지막, `XLSXRead` 분리 유지.
- xlsx.min `getAugmentedNamespace`: `n.__esModule` → `hasOwnProperty.call(n,"__esModule")`. 실사용 차이 없음.
- top-level await · 클래스 필드 · `define`: 차이 0건. CSS: `@media` 공백 축소뿐(1440px 뷰포트에서 해당 쿼리 미적용).
- copyManualAssets: emptyOutDir 이후 `manual/images` 23 · `screenshots` 13 이 src 와 cmp 동일.
