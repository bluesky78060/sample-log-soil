# sample-log-soil 이슈 백로그 (후속 과제)

> 심층 분석(`/oh-my-claudecode:analyze`, 2026-06-04) 기반.
> 이번 세션(SLS-1-90~98)에서 HIGH 이슈는 모두 해소. 이 문서는 **남은 후속 과제**를 위험도·우선순위와 함께 정리한다.
>
> ※ 함수 **줄수는 ESLint `max-lines-per-function` 기준**(주석·빈 줄 제외)이다. 파일 전체 줄수와는 다르다.

---

## ✅ 완료 현황 (SLS-1-90 ~ 98, 2026-06-04)

| 티켓 | 작업 | 효과 |
| --- | --- | --- |
| SLS-1-90 | 채번·동기화 핵심 로직 단위 테스트 + 채번 순수함수 추출 | 회귀 안전망 |
| SLS-1-91 | 동기화 경로 단일화(loadYearData → smartMerge) | **오프라인 데이터 유실 방지** |
| SLS-1-92 | VITE_DEV_SERVER_URL 미정의 ReferenceError 수정 | dev 모드 안정화 |
| SLS-1-93 | 웹 빌드 CSP meta 추가 | XSS 2차 방어선 |
| SLS-1-96 | ESLint 최소 도입(버그성 룰 + max-lines-per-function) | 거대함수 기계 탐지 |
| SLS-1-97 | 시도 매핑 단일화(address-parser SSOT) | **강원/전북 표기 불일치 해소** |
| SLS-1-98 | submitForm 레코드 팩토리 추출 | 거대함수 329→241줄, 중복 제거 |

테스트 30개 → 119개, ESLint 0 errors.

### 보안 결론 (종결)
- **Firestore 규칙 `request.auth != null`(느슨)이지만 실질 위험 낮음**: 두 프로젝트 모두 Firebase config가 앱에 없고 `firebase-auth.json` 키 파일로만 연결. electron(봉화군)은 행정망+키파일, soil은 각 기관이 자기 Firebase+키파일로 직접 연결(각 기관 책임). config 미공개라 외부 접근 입구가 막힘 → **App Check 불필요**.

---

## 🔴 남은 과제 — 고위험 (별도 세션·충분한 E2E 필수)

### B-1. `setupTypeSpecificEvents`(686줄) 분해
- **파일**: `src/soil/soil-script.js`
- **위험도**: 🔴 최고. 네비·주소검색·필지·통계·라벨·엑셀 등 10+ 책임이 이벤트 위임으로 얽힘. `const self = this` 클로저, 동적 바인딩.
- **위험 요인**: 분해 시 이벤트 하나만 누락돼도 특정 버튼이 조용히 먹통. 단위 테스트 불가.
- **접근법**: 카테고리별 `bindNavigationEvents()`/`bindParcelEvents()`/`bindStatisticsEvents()` 등으로 분리하되, **모든 버튼·입력 인터랙션을 E2E로 전수 점검**. 한 번에 하나씩.

---

## 🟠 남은 과제 — 중간 위험 (검증 수단 있음)

### B-2. 엑셀 빌드 함수 분해
- **파일**: `src/heuktoram/heuktoram-script.js` — `buildWorksheetData`(180줄), `buildGongikWorksheetData`(123줄)
- **위험도**: 🟠 중간. 흙토람/공익직불제 양식이 컬럼 인덱스(`row[10]` 등)에 민감 — 1칸 어긋나면 외부 사이트가 거부.
- **접근법**: 먼저 **출력 골든 파일 테스트**(현재 엑셀 출력 스냅샷) 작성 → 컬럼 정의 상수맵 + 행 빌더로 분리 → 출력 동치 검증. 인덱스 매직넘버 제거 효과 큼.

### B-3. 렌더링 함수 분해 — ✅ 완료 (SLS-1-102 heuktoram, SLS-1-104 soil)
- **파일**: `src/soil/soil-script.js` — ~~`renderCurrentPage`(199), `renderParcelCard`(136)~~; `heuktoram-script.js` — ~~`createTableRow`(107)~~
- ~~위험도 🟠 중간~~ → **해결**. soil(SLS-1-104): `renderCurrentPage`→오케스트레이션만 유지 + `_buildFarmSeparatorRow`/`_buildLogTableRow` 추출, `renderParcelCard`→삽입·바인딩만 + `_buildParcelCardHTML` 추출. heuktoram(SLS-1-102): `createTableRow`→`_appendHeuktoramFixedCells`/`_appendHeuktoramResultCells`.
- **검증**: E2E 골든 대조 — 분해 전/후 빌드의 innerHTML(일반·공익직불제·필지카드) 모두 `===` byte-identical. 이벤트 바인딩(주소복사·select·산버튼) 보존 확인. ESLint 0 errors, vitest 119/119.
- **잔여**: 추출된 `_buildLogTableRow`(173)·`_buildParcelCardHTML`(121)은 100줄 초과지만 본질적 길이(컬럼·필드 수 비례, 정적 템플릿)로 추가 분해 net-negative 판정(리뷰어 동의).

---

## 🟢 남은 과제 — 낮은 위험 / 낮은 ROI

### B-4. 정적/팩토리 거대함수 (분해 보류 권장)
- `injectStyle`(171)·`buildModal`(113) — 대부분 정적 CSS/HTML 문자열. 쪼개도 가독성 이득 적음.
- `createFormValidator`(168)·`createFileAPI`(114) — 팩토리(메서드 묶음), 응집도 높아 분해 강제 불필요.
- → **위험은 낮지만 이득도 낮아 ROI 낮음. 우선순위 최하.**

### B-5. ESLint sourceType 정밀화
- **파일**: `eslint.config.mjs`
- `src/index.js`·`src/preload.js`·`*.config.js`는 CommonJS인데 `sourceType: 'module'` 일괄 적용 중. 별도 블록으로 `sourceType: 'commonjs'` + `globals.node` 분리하면 정확(현재는 동작하나 환경 매핑 부정확). `Buffer`/`__dirname`을 브라우저 파일에서 오용 시 잡도록 격리 가능.

### B-6. 동기화 잔여 후속 (SLS-1-91 리뷰 SUGGESTION) — ✅ 완료 (SLS-1-105)
- ~~`storage-manager.js`(338줄) 미사용 CRUD 데드코드 제거~~ → **완료**: save/saveItem/load/delete/subscribe/sync/getMode/generateId/MODES 제거(외부 호출 0건 검증), 리스너 없는 `storage-sync-requested` dispatch 체인 제거. 보존: init/migrate/getStatus/isCloudEnabled(settings·main-init 사용). 338→117줄.
- ~~`loadYearData`의 smartMerge 결선 통합 테스트~~ → **완료**: base-manager.test.js에 4건 추가(오프라인 보존·삭제전파·localStorage 저장·빈응답 안전가드). 119→123 테스트.
- ~~`BaseSampleManager.smartMerge` 폴백 주석~~ → **완료**: union merge·삭제 미지원·updatedAt 무비교 로컬우선·순서의존 명시.

---

## 🌍 기능 과제 (별도 트랙)

### F-1. 전국 시군→시도 테이블 (#7-C) — ✅ 이미 해소됨
- **파일**: `src/heuktoram/heuktoram-script.js` `SIGUNGU_TO_SIDO`
- **상태**: 확인 결과 **이미 전국 약 150개 시군**(9개 시도: 경기·강원·충청·전라·전북·경상남/북도 등)으로 매핑되어 있음. SLS-1-97 분석 당시 경북 구간만 보고 오판했던 것. **추가 작업 불필요.**
- **잔여**: 다른 지점의 경상북도 하드코딩(예: 기본 시·도 `app_default_sido`, soil-script 시도 폴백 등)이 있다면 [[sample-log-soil-nationwide]] 과제로 별도 점검.

### F-2. 정식 이행점검명 목록 (공익직불제 기준년도)
- **파일**: `src/soil/soil-script.js` `GONGIK_BASE_YEAR_OPTIONS`
- 현재 임시값(2024~2027 토양화학성분 기준). 농진청 정식 이행점검명 목록으로 교체 대기.

---

## 권장 진행 순서

1. **B-2(엑셀 골든 파일 + 분해)** — 검증 수단 명확, 매직넘버 제거 효과 큼
2. **B-6(동기화 데드코드 정리 + 통합 테스트)** — 저위험, 데이터 안전 강화
3. **B-5(ESLint commonjs 분리)** — 저비용 정확성
4. **B-1(setupTypeSpecificEvents)** — 효과 최대지만 고위험, 충분한 E2E와 함께 별도 세션
5. B-3 → B-4(보류) / F-2는 농진청 정식 이행점검명 확정 후 (F-1은 이미 해소)

> 메모리 참조: `~/.claude/projects/.../memory/sample-log-soil-analysis-backlog.md` (분석 원본)
