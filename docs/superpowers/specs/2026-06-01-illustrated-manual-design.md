# 컴맹 친화 이미지 설명서 보강 — 설계 문서 (계획서)

- **프로젝트**: sample-log-soil (토양 시료 접수 대장, 전국 기관 배포용)
- **작성일**: 2026-06-01
- **대상 산출물**: 인앱 HTML 사용 설명서 (`src/manual/index.html` → `docs/manual/` 동기화)
- **상태**: 설계 승인 완료 → 구현 계획 작성 대기

---

## 1. 목표 (Why)

컴퓨터에 익숙하지 않은 사용자("컴맹")도 **혼자서, 화면을 보고 따라 하기만 하면** 토양 시료 접수 대장 앱을 끝까지 사용할 수 있도록 설명서를 보강한다.

기존 설명서는 9개 섹션과 이미지 6장을 갖추고 있으나:

- 화면이 **빈 상태**로 캡처되어 실제 사용 모습과 동떨어짐
- 스크린샷에 **어디를 눌러야 하는지 표시(화살표·번호)가 없음**
- 절차가 "기능 설명" 위주여서 **단계별 따라하기**가 아님

이 격차를 메워 "보고 따라만 하면 되는" 수준으로 끌어올린다.

## 2. 사용자 (Who)

- 농업기술센터 등 **전국 기관 담당 직원** (연령·디지털 숙련도 다양)
- 신규 인수인계자 / 비정기 사용자 (가끔 쓰는 사람이 가장 헤맴)

## 3. 범위 (What)

### 포함

1. **데모 데이터 시딩 모듈** — 캡처 전 현실적인 더미 토양 시료를 `localStorage`에 주입
2. **스크린샷 캡처 파이프라인 재작성** — `tests/e2e/manual-capture.spec.js` 신규
   - 낡은 비-soil 경로(`/pesticide/`, `/water/`, `/compost/`, `/heavy-metal/`) 제거
   - soil 전용 화면 단계별 30~45컷 캡처
   - DOM 오버레이 주석(번호 원 ①②③ · 화살표 · 강조 박스) 코드 주입
3. **설명서 HTML 재구성** (`src/manual/index.html`)
   - 9개 섹션을 "1단계 → 2단계 → 3단계" 번호형 절차로 재서술
   - 단계별 주석 스크린샷 삽입 + 💡팁 / ⚠️주의 박스
   - 용어 풀이, FAQ 확충
4. **docs/ 동기화** (`scripts/sync-docs.js` 또는 `npm run build`)

### 제외 (YAGNI)

- 인쇄/PDF 버전 (인앱 HTML만)
- 영상 튜토리얼
- 다국어 (한국어만)
- 데스크톱 전용 기능(Firebase 인증 파일, 자동저장 폴더 선택)의 **신규 캡처** — 웹 캡처로 재현 불가, 기존 이미지 재사용 또는 텍스트+안내 박스로 설명

## 4. 제약 (Constraints)

- 캡처는 **웹 빌드(`docs/`) + Playwright Chromium** 기준 (테스트 인프라 재사용)
- 데스크톱 전용 UI는 웹에서 안 보일 수 있음 → 해당 섹션은 기존 이미지/텍스트로 보완
- 설명서는 기존 스타일(다크모드·검색·반응형·Noto Sans KR) 유지
- 더미 데이터는 **가공의 가명·주소**만 사용 (실제 개인정보 금지)
- 메인 프로젝트(`sample-log-electron`)와 별개 — 이 작업은 sample-log-soil 단독

## 5. 아키텍처 / 컴포넌트

### 5.1 데모 데이터 시더 — `tests/e2e/helpers/seed-demo-data.js`

```
seedSoilDemoData(page)  → page.addInitScript 로 localStorage 주입
  - soilSampleLogs_2026 등 연도별 키에 더미 5~10건
  - 농가명/필지/주소/접수번호/검정항목 채움 (가공 데이터)
```

- **책임**: 캡처 화면을 "채워진 실사용 상태"로 만든다
- **인터페이스**: `await seedSoilDemoData(page)` — goto 이전 호출
- **의존**: 앱의 STORAGE_KEY 규칙 (`{storageKey}_{year}`)

### 5.2 주석 오버레이 헬퍼 — `tests/e2e/helpers/annotate.js`

```
annotate(page, steps)
  steps = [{ selector, number, label?, arrow?: 'left'|'top'|... }]
  → page.evaluate 로 대상 요소 위치 계산 후
    빨간 번호 원 + (선택)화살표 + (선택)강조 테두리 DOM 삽입
clearAnnotations(page) → 주석 제거 (연속 캡처용)
```

- **책임**: 이미지에 "여기를 누르세요" 시각 표시를 굽는다
- **인터페이스**: 순수 함수, 캡처 spec에서 호출
- **의존**: 없음 (DOM 좌표만 사용) — 독립 테스트 가능
- **설계 포인트**: 오버레이는 `position:fixed`, 높은 z-index, `data-annotation` 속성으로 식별/제거

### 5.3 캡처 시나리오 — `tests/e2e/manual-capture.spec.js`

섹션별 시나리오(각각 독립 test 블록, 실패 격리):

| # | 섹션 | 주요 컷 (예시) |
|---|------|----------------|
| 1 | 시작하기 | 메인 화면 전체 + 통계 패널 클로즈업 + 다크모드 토글 |
| 2 | 시료 접수 | 접수 탭 → 연도/접수번호/날짜 → 농가정보 → 필지 추가 → 등록 버튼 (필드별 번호 주석) |
| 3 | 접수 목록 | 목록 탭 → 검색 → 필터 → 페이지네이션 |
| 4 | 흙토람 가져오기 | 흙토람 버튼 → 엑셀 모달 → 결과 매핑 |
| 5 | 데이터 관리 | 수정/삭제 → 성명 클릭 일괄선택 → 발송일자 일괄입력 → 엑셀 내보내기/가져오기 |
| 6 | 통계·라벨 | 통계 보기 → 라벨 인쇄 |
| 7 | 클라우드 동기화 | (기존 Firebase 이미지 재사용 + 동기화 버튼 캡처) |
| 8 | 설정 | 설정 화면 (웹 가능 범위) |

- **출력**: `src/manual/images/step-XX-*.png` (소스 기준 저장 후 docs 동기화)

### 5.4 설명서 HTML — `src/manual/index.html`

- 섹션별 `.step-list` 컴포넌트 (번호 배지 + 설명 + 스크린샷)
- `.tip-box` / `.warning-box` / `.term-box` 재사용 스타일 추가
- 기존 목차/헤더/다크모드 CSS 유지, 절차형 마크업만 확장

## 6. 데이터 흐름

```
[seed-demo-data] localStorage 주입
        ↓
[manual-capture.spec] page.goto → 상호작용 → annotate() → screenshot
        ↓
src/manual/images/*.png  (주석 포함 PNG)
        ↓
[index.html] <img> 참조 + 단계별 설명
        ↓
npm run build / sync-docs.js → docs/manual/  (GitHub Pages 배포)
```

## 7. 에러 처리 / 엣지 케이스

- **요소 미존재**: `annotate`는 selector 미발견 시 해당 step 스킵 + 콘솔 경고 (캡처 중단 금지)
- **앱 라우트 변경**: soil 전용 경로만 사용, 존재 안 하는 경로 캡처 금지
- **데스크톱 전용 기능**: 웹에서 안 보이면 기존 이미지 유지 + "데스크톱 앱 전용" 배지 표기
- **이미지 누락**: 빌드 시 깨진 `<img>` 없도록 캡처 산출 파일명과 HTML 참조 1:1 검증
- **반응형**: 캡처 viewport 고정(예: 1280×800)으로 일관성 확보

## 8. 검증 (Testing)

- `npm test`로 캡처 spec 실행 → 지정한 PNG 파일이 모두 생성되는지 확인
- 캡처된 이미지 육안 점검: 주석 위치·가독성·데모 데이터 노출 적절성
- 설명서 페이지를 브라우저로 열어 모든 `<img>` 정상 로드 + 다크모드 깨짐 없음 확인
- `docs/manual/`와 `src/manual/` 내용 일치 확인 (sync)

## 9. 산출물 체크리스트

- [ ] `tests/e2e/helpers/seed-demo-data.js`
- [ ] `tests/e2e/helpers/annotate.js`
- [ ] `tests/e2e/manual-capture.spec.js` (기존 screenshots.spec.js 정리/대체)
- [ ] `src/manual/images/step-*.png` (신규 주석 스크린샷 30~45컷)
- [ ] `src/manual/index.html` 절차형 재구성
- [ ] `docs/manual/` 동기화
- [ ] 캡처 재현 방법 README 메모 (선택)

## 10. 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 웹 캡처로 데스크톱 UI 재현 불가 | 일부 섹션 신규 이미지 부족 | 기존 이미지 재사용 + 텍스트/배지 보완 |
| 주석 좌표가 레이아웃 변화에 민감 | 재캡처 시 위치 어긋남 | selector 기반 동적 좌표 계산, 고정 viewport |
| 더미 데이터에 실제 정보 혼입 | 개인정보 노출 | 명백한 가공 가명/주소만 사용 |
| 이미지 30~45장으로 페이지 용량↑ | 로딩 지연 | PNG 최적화, `loading="lazy"` 적용 |

## 11. AI PM 워크플로우

- 프로젝트 ID: `0a5f80f1-ede5-4b09-89b2-0001d6b89426` (SLS)
- General 에픽: `4d7bdd33-38c5-4c17-9cfc-c3c37b664549`
- 구현 단계에서 티켓 발행 → start_work → 구현 → build/test → 코드리뷰 → approve_review
