# SLS-1-300 플랜

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

1. `src/shared/xlsx-package.js` 신설 — `finalizeXlsxPackage(arrayBuffer)` 를 `window.finalizeXlsxPackage` 로 노출.
   두 페이지(클래스형 `HeuktoramManager`, IIFE `CompostHeuktoramExport`)가 한 구현을 공유한다 — 사본 둘이면 한쪽만 고치는 사고가 난다.
2. 호출부: `heuktoram-entry.js`·`compost-analysis-entry.js` 가 모듈을 import. 세 내보내기에서 `injectDataValidations` 결과를 항상 보정에 통과(early-return 경로 포함).
3. 테스트 `tests/unit/xlsx-package.test.js`: 전제(원본 bin 보유), 보정 결과(CT 첫·bin 없음·payload 보존·validation 보존), 재검증 throw 두 분기(forgeZip 으로 개별), 세 호출부.
4. 변이 검증: 순서 predicate / bin predicate / throw / 호출부 각각 제거 → 테스트 실패 확인.
5. 빌드: 메인 체크아웃의 `network-config.js`(ALLOWED_GATEWAY '')로 빌드, docs 를 부모 대비 비교해 흙토람 외 의미 변경 없음 확인. sync-version 부산물은 원복.
6. 버전 bump 하지 않는다(소유자 결정 전).

## 구현 중 추가
- E2E `heuktoram-export-real-output.spec.js` 8번: 빌드된 번들로 실제 내보낸 파일의 CT 첫 엔트리·bin 선언 없음을 본다. 단위 테스트가 토양·공익직불제 호출부를 소스 텍스트로만 보기 때문이다.
