# SLS-1-300 방향 — 흙토람 내보내기 xlsx 포장 보정

> 정본. 훅 통과용 사본은 `docs/00-discovery/`.

- 분류: 버그 예방(외부 연동 산출물 형식). 정식 워크플로우 — 내보내기 산출물 형식 변경이라 fast-track 대상이 아니다
- 출처: 자매 저장소 sample-log-electron SAMPL-1-186(PR #49, 머지 `8777a3cb`, v1.17.14) 이식. 코디네이터 지시

## 목표 (Why)
sample-log-electron 에서 흙토람 일괄입력 xlsx 가 「변조된 확장자 또는 허용되지 않은 확장자」로 거부됐다.
이 저장소도 같은 SheetJS(xlsx-js-style 1.2.0) 출력 구조를 가진다 — `[Content_Types].xml` 이 ZIP 첫 엔트리가 아니고,
xlsb 본문 선언 `<Default Extension="bin" ContentType="application/vnd.ms-excel.sheet.binary.macroEnabled.main"/>` 이 들어 있다.

## 시험 이력과 미확인 사항 (이 문서가 기준이다)
- 시험됨(sample-log-electron, 소유자 업로드): 두 변경을 함께 적용한 파일은 흙토람에서 통과했고, bin 만 제거한 파일은 실패했다.
- 미시험: CT 만 이동한 파일. 서버 판별 규칙은 모른다.
- **이 저장소의 산출물로 흙토람 업로드를 시험한 적은 없다.** 구조가 같다는 것은 xlsx-js-style 로 가짜 데이터를 써서 확인했다.

## 사용자 (Who)
흙토람·공익직불제에 일괄입력 파일을 올리는 농업기술센터 담당자.

## 범위 (What)
XLSX.write 뒤 후처리(CT 첫 엔트리 + bin 선언 삭제 + 재검증 실패 시 중단)를 세 내보내기에 적용:
1. `src/heuktoram/heuktoram-script.js` `exportToHeuktoram` — 흙토람 토양 검정정보 일괄입력
2. 같은 파일 `exportToGongik` — 공익직불제 이행점검 일괄등록(흙토람이 아닌 공익직불제 시스템)
3. `src/compost-analysis/compost-heuktoram-export.js` `exportFile` — 흙토람 퇴비 성분검사결과 일괄입력

공익직불제는 흙토람 업로드 대상이 아니지만 같은 포장을 쓰므로 같은 거부 위험이 있다고 본다(미시험).
보정은 xlsx 의미를 바꾸지 않는다 — bin 확장자 파트가 없는 패키지에서 그 Default 는 쓰이지 않고, CT 를 앞에 두는 것은 Excel 저장본의 순서다.

## 범위 밖
`src/` 의 다른 XLSX.write/writeFile 내보내기. 업로드 호환성은 검증되지 않은 별도 위험이다.

## 리스크
- 재검증이 던지면 내보내기가 실패 토스트로 끝난다(조용한 통과보다 낫다 — 거부를 사용자가 업로드 시점에야 안다).
- JSZip 이 없으면 보정도 불가하므로 던진다. 두 entry 모두 JSZip 을 window 에 싣는다.

## 검증
실제 xlsx-js-style/JSZip 단위 테스트 + 변이 검증. 실제 흙토람 업로드는 소유자 확인이 필요하다.

## 방향 확정
코디네이터 지시(sample-log-electron 에서 소유자가 업로드 통과를 확인한 수정의 이식)를 근거로 한다. 이 저장소에 대한 소유자의 별도 승인은 받지 않았다.
