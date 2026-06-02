# 경지구분 1차 + 흙토람式 가져오기 모달 — 구현 계획

> 실행: superpowers:subagent-driven-development. 설계 원본: `docs-internal/plans/2026-06-02-landclass1-import-plan.html`

**Goal:** 토양 시료에 경지구분 1차 필드(11값)·경지구분별 독립 번호·목록 탭을 추가하고, 흙토람式 가져오기 모달을 구현한다.

**Architecture:** 코어 변경(soil-script.js, soil/index.html, soil-style.css)은 한 스트림으로 순차 진행. 흙토람 연동(heuktoram-script.js)과 가져오기 모달 신규 모듈(soil-result-importer.js, 모달 DOM을 JS로 자체 생성)은 파일이 겹치지 않아 병렬 진행.

**Tech Stack:** Vanilla JS(window.* 전역), Vite, Tailwind, Playwright E2E, xlsx-js-style.

---

## 파일 소유(충돌 방지 병렬 분할)

| 스트림 | 소유 파일 | 병렬성 |
|--------|-----------|--------|
| **A. 흙토람 연동** | `src/heuktoram/heuktoram-script.js` | C와 병렬 가능(파일 분리) |
| **C. 코어** | `src/soil/index.html`, `src/soil/soil-script.js`, `src/soil/soil-style.css` | A와 병렬, B 선행 |
| **B. 가져오기 모달** | `src/soil/soil-result-importer.js`(신규), `src/soil/soil-entry.js`(import 1줄) | C의 레코드 API 확정 후 |

> 핵심 사실: 저장키 `soilSampleLogs_{year}`(연도별 배열). 레코드 필드: `id, receptionNumber, date, name, phoneNumber, address, subCategory(구분), purpose(목적), note(비고), groupId, parcelIndex, totalParcels, lotAddress, area, cropsDisplay, isComplete, parcels[]`. 폼 수집 `collectFormData`/저장 ~1616~1760, 다음번호 생성 ~640~671, 마이그레이션 `migrateCompletedField` 247, 완료필터 `#completedFilter`.

---

## 스트림 A — 흙토람 dataRow[4] 연동 (독립, 병렬)

**Files:** Modify `src/heuktoram/heuktoram-script.js`

- [ ] **A1.** `exportToHeuktoram`의 데이터 행 생성부(약 1541줄 `dataRow[4] = '농가의뢰';`)를 레코드의 `landClass1` 값 사용으로 변경:
```js
dataRow[4] = (row.log.landClass1 && String(row.log.landClass1).trim()) || '농가의뢰';
```
`row.log`에 landClass1이 없으면 기본 '농가의뢰' 유지(기존 동작 보존). 'gap'이 들어오면 표기는 흙토람 서식 규약상 'GAP' 권장 — 단 흙토람 서식이 소문자 허용 여부 불명이면 입력값 그대로 두고, 화면 표기만 GAP. (보수적으로 값 그대로 출력)
- [ ] **A2.** `npm run build` 성공 확인 후 커밋 `feat(heuktoram): 경지구분1차(landClass1) dataRow[4] 연동`. docs/ 미커밋.

---

## 스트림 C — 코어 (순차)

**Files:** Modify `src/soil/index.html`, `src/soil/soil-script.js`, `src/soil/soil-style.css`

### C1. 경지구분 1차 상수 + 폼 3열 배치
- [ ] soil-script.js 상단에 상수 추가:
```js
const LAND_CLASS1_OPTIONS = ['개량제','전략','직불','자체','기타','친환경','유기농','무농약','GAP','농가의뢰','대표필지'];
const LAND_CLASS1_DEFAULT = '농가의뢰';
```
- [ ] `src/soil/index.html` 240~268줄: 기존 `#subCategory`(구분)·`#purpose`(목적)가 든 `.form-row`를 **3열**로 만들고 그 안에 `#landClass1` select 추가(11 options, 기본 농가의뢰). `#note`(비고)는 기존대로 다음 줄 full-width 유지. (계획서 HTML 폼 목업의 3열 레이아웃 채용 — 구분·목적·경지구분1차 한 줄)
- [ ] 폼 그리드가 3열이 되도록 `soil-style.css`의 해당 `.form-row` 규칙 보강(2열→3열, 모바일 1열 접힘).
- [ ] 빌드 후 `/soil/` 접수 화면에서 3열·드롭다운 렌더 확인. 커밋.

### C2. landClass1 수집·저장 + 마이그레이션
- [ ] `init`에서 `this.landClass1Select = document.getElementById('landClass1')` 추가.
- [ ] `collectFormData`/저장부(~1616~1760)에서 `commonData`에 `landClass1: formData.get('landClass1') || LAND_CLASS1_DEFAULT` 추가하고, 생성되는 각 레코드 객체에 `landClass1` 포함(parcel 단위 레코드 모두).
- [ ] `migrateCompletedField`(247) 패턴을 참고해, 로드된 레코드에 `landClass1`이 없으면 `LAND_CLASS1_DEFAULT`로 채우는 마이그레이션 추가(표시/저장 시).
- [ ] 수정 모드(편집) 시 `#landClass1`에 기존 값 채우기.
- [ ] 빌드 후 등록→저장→localStorage에 landClass1 저장 확인. 커밋.

### C3. 경지구분별 독립 번호
- [ ] 다음 접수번호 생성 로직(~640~671)을 **(현재 선택 경지구분 1차) 범위로 한정**: 같은 연도+같은 landClass1 레코드들에서만 max(receptionNumber base)+1 계산. 성토(F) 분기도 동일 범위.
- [ ] 폼의 `#landClass1` 변경 시 접수번호 자동추천을 해당 분류 기준으로 갱신(접수번호를 비워두거나 자동 제안하는 기존 UX에 맞춤).
- [ ] 중복 검사를 `연도+landClass1+receptionNumber` 단위로 변경.
- [ ] 빌드 후 서로 다른 경지구분에서 각각 1,2,3… 매겨지는지 확인. 커밋.

### C4. 목록 탭(경지구분 1차 전환)
- [ ] `src/soil/index.html` 접수 목록 영역(목록 뷰 상단)에 경지구분 1차 탭/드롭다운(`#landClass1Tab`, '전체' + 11값) 추가.
- [ ] soil-script.js 목록 렌더에서 선택된 탭 값으로 레코드 필터(전체면 모두). 통계/엑셀 내보내기는 현재 선택 탭 기준 데이터로 동작.
- [ ] 기존 데이터는 농가의뢰 탭에 보이는지(마이그레이션 기본값) 확인.
- [ ] `soil-style.css`에 탭 스타일. 빌드 후 탭 전환 동작 확인. 커밋.

### C5. 레코드 생성 API(스트림 B 연동용) + 모달 트리거
- [ ] soil-script.js에 외부(가져오기 모달)에서 호출할 공개 메서드 정의 — 인터페이스 계약(B가 이 시그니처에 맞춤):
```js
// 한 건을 현재 연도 저장소에 추가. landClass1별 독립 번호 자동 부여(접수번호 미지정 시).
// record: { name, phoneNumber, lotAddress, cropsDisplay, area, subCategory, purpose, note, landClass1, receptionNumber? }
// 반환: 저장된 레코드(부여된 receptionNumber 포함)
addImportedRecord(record) { ... }
getNextNumberForClass(year, landClass1) { ... }  // C3 로직 재사용
```
- [ ] 기존 "가져오기" 버튼(soil/index.html의 `#excelImportInput`/관련 버튼)을 새 모달 오픈으로 연결할 자리만 확보(실제 연결 호출은 `window.SoilResultImporter?.open(...)`). B 완료 후 검증.
- [ ] 커밋.

---

## 스트림 B — 가져오기 모달 (신규 모듈, C5 이후)

**Files:** Create `src/soil/soil-result-importer.js`; Modify `src/soil/soil-entry.js`(import 1줄)

- [ ] **B1.** `heuktoram-result-importer.js`를 참고해 `SoilResultImporter` 클래스 작성. **모달 DOM을 JS로 자체 생성**(index.html 미수정)하여 흙토람 모달 톤 재현. 구성:
  - 1) 엑셀 데이터 입력: 파일 업로드/붙여넣기 토글(xlsx-js-style로 시트 파싱, 붙여넣기 탭 파싱)
  - 2) 컬럼 매핑: 접수번호(선택)·성명·연락처·지번주소·작물·면적·구분·목적(용도)·비고 + 자동 매핑 추정
  - 3) 경지구분 1차 일괄선택(11값, 기본 농가의뢰)
  - 4) 옵션: 접수번호 자동부여(경지구분별 독립 번호)/중복 시 건너뛰기·덮어쓰기
  - 5) 미리보기: 생성될 행 표 + 신규/중복/오류 배지·건수
  - 푸터: 취소 / 가져오기 → 각 행을 `window.soilManager.addImportedRecord(record)`로 저장, 목록 새로고침
- [ ] **B2.** `window.SoilResultImporter = new SoilResultImporter()` 노출. `soil-entry.js`에 `import './soil-result-importer.js'` 추가.
- [ ] **B3.** soil/index.html의 가져오기 버튼이 `window.SoilResultImporter.open()`를 호출하도록 C5 자리와 연결(C 소유 파일 변경은 C 스트림에 위임하거나, B 완료 후 한 줄 연결 커밋).
- [ ] **B4.** 빌드 후 `/soil/`에서 가져오기 버튼→모달 오픈→붙여넣기 샘플→미리보기→가져오기→목록 반영 확인. 커밋.

---

## 통합 검증 (모든 스트림 후)
- [ ] `npm run build` 성공.
- [ ] Playwright 스모크: 접수 폼 3열·landClass1 저장, 경지구분별 번호 독립, 목록 탭 필터, 가져오기 모달 오픈/미리보기/저장, 흙토람 내보내기 dataRow[4]=landClass1.
- [ ] docs 동기화 커밋.

## Self-Review
- 설계(HTML 계획서) 커버리지: 경지구분1차 필드=C1·C2, 흙토람연동=A1, 독립번호=C3, 목록탭=C4, 마이그레이션=C2, 가져오기모달=B. 모두 매핑됨.
- 병렬성: A↔C 파일 분리로 병렬, B는 C5(addImportedRecord API)·모달버튼 연결에 의존하므로 C 이후. 같은 파일 동시 편집 없음.
- 인터페이스 일관성: B는 `window.soilManager.addImportedRecord(record)` 시그니처에 맞춤(C5 정의와 동일).
