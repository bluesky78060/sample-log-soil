# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

토양 시료 접수 대장 (Soil Sample Log) — **토양 + 가축분뇨 퇴비(퇴·액비 부숙도)** 시료 접수/관리 시스템 (전국 농업기술센터·분석기관 배포용). **Electron 데스크톱 + GitHub Pages 웹** 듀얼 환경.

> 본 저장소는 [`sample-log-electron`](https://github.com/bluesky78060/sample-log-electron)(5종 시료 통합본)에서 토양 부분만 분리한 독립 프로젝트입니다. v1.0.0 = 2026-05-08 신규 출발.
> 2026-07-26 퇴비를 다시 이식해 **지원 시료 종은 2종**입니다 (SLS-1-192 shared 계약 정렬 → SLS-1-195 페이지 이식).

## AI PM 작업 관리 (필수, Hook 강제)

모든 코드 변경은 **AI PM System MCP** 티켓 발행 후 진행. 전역 워크플로우는 `~/.claude/rules/ai-pm-ticket.md` 참조.

- **프로젝트 ID**: `0a5f80f1-ede5-4b09-89b2-0001d6b89426`
- **프로젝트 코드**: `SLS`
- **General 에픽 ID**: `4d7bdd33-38c5-4c17-9cfc-c3c37b664549`
- **API URL**: `https://ai-pm-system.onrender.com`

`create_task` 시 `epic_id` 누락 금지. `approve_review` notes는 CRITICAL/MAJOR/MINOR/SUGGESTION 카운트 + 판정 형식.

### Hook 강제 시스템 (`.claude/hooks/`)

`.claude/settings.json`에 등록된 PreToolUse hook이 다음을 자동 차단합니다.

| Hook | 트리거 | 차단 조건 |
| --- | --- | --- |
| `ticket-guard.sh` | Edit/Write/MultiEdit | `src/` 또는 `tests/` 하위의 `.js .ts .tsx .html .css .scss` 등 소스 파일 수정 시 활성 티켓이 없으면 차단 |
| `epic-id-guard.sh` | `mcp__ai-pm__create_task` | `epic_id`가 누락/null이면 차단 |

**제외 대상** (자유 수정 가능): 루트 설정 파일(`vite.config.js`, `package.json` 등), 모든 `.md` 문서, 이미지/JSON 자산, `docs/` 빌드 산출물, `.claude/` 내부.

**활성 티켓 헬퍼**:
```bash
bash .claude/hooks/set-ticket.sh SLS-X-Y          # 활성화 (정식 워크플로우)
bash .claude/hooks/set-ticket.sh SLS-X-Y --fast   # fast-track (플랜·리뷰 산출물 생략)
bash .claude/hooks/set-ticket.sh                  # 조회 (모드 함께 표시)
bash .claude/hooks/set-ticket.sh clear            # 해제
```

### fast-track — 언제 쓰고 언제 쓰지 않나

전역 훅 `plan-review-guard`(start_work)와 `codex-review-guard`(approve_review)가
`docs/00-discovery` · `01-plan` · `02-review` · `03-code-review` 산출물을 요구한다.
`--fast`는 **네 가지를 모두 건너뛴다.**

기준은 **"몇 줄이냐"가 아니라 "틀렸을 때 되돌릴 수 있느냐"**다.
문구는 다음 배포에서 고치면 그만이지만, 삭제 로직은 되돌려도 데이터가 안 돌아온다.

| ✅ fast-track | ❌ 정식 워크플로우 |
| --- | --- |
| 화면 문구·라벨·안내문 | 조건문·분기 변경 |
| 오타·주석·문서 | 삭제·저장 경로 |
| 버전 동기화·릴리스노트 | 데이터 모델·스토리지 키 |
| CSS 색상·여백 | 내보내기 산출물 형식 |

⚠️ **한 줄짜리라고 fast-track이 아니다.** SLS-1-217은 `SAMPLE_DATA_PATTERNS`에서 한 줄을
뺀 것이었지만, 플랜 리뷰가 "금요일 자동 클리어는 호출부가 없다"는 오판을 잡아내
위험도가 뒤집혔다(무해 → 12주간 무음 데이터 유실). SLS-1-216도 한 줄 추가였으나
플랜 리뷰가 `SyntaxError`가 될 코드를 걸렀다. **로직이 바뀌면 정식 워크플로우다.**

보안·DB 마이그레이션·결제·권한 경로는 `--fast`를 걸어도 `codex-review-guard`가
변경 파일을 재확인해 차단한다(우회 불가).

표준 워크플로우:
1. `mcp__ai-pm__create_task(epic_id="4d7bdd33-...", title="...")` → ticket_code 받음
2. `bash .claude/hooks/set-ticket.sh SLS-X-Y` (티켓 활성화)
3. `mcp__ai-pm__smart_workflow(task_id, 'start_work')`
4. 코드 수정 (Edit/Write 통과)
5. 빌드/테스트 → `submit_test`
6. 코드리뷰 → `approve_review`
7. `bash .claude/hooks/set-ticket.sh clear` (자동 done 후)

## Commands

```bash
npm start              # Electron 실행
npm run start:dev      # DevTools 포함
npm run dev            # Vite 웹 서버 (localhost:3000)
npm run dev:electron   # Electron + Vite 동시
npm run build          # build:css → sync-version → vite build → docs/
npm run package        # 현재 OS용 패키지
npm run make           # 설치 파일 (Win: exe, Mac: zip)
npm test               # Playwright E2E (docs/ 대상)
npm run test:unit      # vitest 유닛 테스트
npm run sync-version   # package.json → constants.js / index.html / manual 동기화
```

## Architecture

### Dual Environment (Electron + Web)

```javascript
const isElectron = window.electronAPI?.isElectron === true;
```

- **Electron**: `window.electronAPI` (IPC, 파일 I/O, 자동저장)
- **Web**: File System Access API 또는 다운로드 폴백
- 두 환경의 차이는 `src/shared/file-api.js`가 추상화

### Process Architecture

- **Main** (`src/index.js`): IPC 핸들러, electron-updater, 경로 보안, **CSP**
- **Preload** (`src/preload.js`): `contextBridge`로 `window.electronAPI` 노출

### Folder Structure

```text
src/
├── index.js, preload.js, index.html, main-entry.js
├── main-stats.js          # 메인 페이지 통계 패널 (ES 모듈, CSP 정책 준수)
├── shared/                # 공통 모듈 (~26개, window.* 전역 노출)
├── styles/                # Tailwind input
├── soil/                  # 토양 시료 페이지
├── compost/               # 가축분뇨 퇴비(퇴·액비 부숙도) 페이지
├── heuktoram/             # 흙토람 검정결과 가져오기 (토양 페이지에서 진입)
└── {settings,label-print,manual,release}/

docs/                      # GitHub Pages 배포용 (Vite 빌드 결과)
tests/{e2e,unit}/          # Playwright + vitest
.github/workflows/build.yml  # 태그 push 시 Windows installer 자동 빌드
```

### Sample Type Pattern (토양 / 퇴비 2종)

```text
src/soil/                     src/compost/
├── index.html                ├── index.html
├── soil-script.js            ├── compost-entry.js   # vite entry (frame-guard 최상단 import)
└── soil-style.css            ├── compost-script.js  # BaseSampleManager 상속
                              └── compost-style.css
```

스크립트 필수 상수:
```javascript
// soil                                  // compost
const SAMPLE_TYPE = '토양';              const SAMPLE_TYPE = 'compost';
const STORAGE_KEY = 'soilSampleLogs';    const STORAGE_KEY = 'compostSampleLogs';
const AUTO_SAVE_FILE = 'soil-autosave.json';  const AUTO_SAVE_FILE = 'compost-autosave.json';
```

**완료 필드 규약**: 두 종 모두 `isComplete`를 쓴다. base의 `migrateCompletedField`는 `completed`를
채우므로 soil은 자체 오버라이드로, compost는 **no-op 오버라이드**로 우회한다. 그대로 두면
`loadYearData`마다 무의미한 `completed:false`가 주입되어 Firestore 문서까지 오염된다.

초기화: `DOMContentLoaded` → FileAPI → Firebase/자동저장 병렬 init → UI.

### 본필지 / 하위필지 데이터 모델

토양 시료의 핵심 데이터 모델로, **메인 페이지 통계 패널과 토양 페이지의 완료 토글 그룹핑**이 모두 이 규칙을 따릅니다.

- **본필지**: `receptionNumber`가 `'503'` / `'F503'`(성토)
- **하위필지**: `'503-1'`, `'F503-2'` (하이픈 + 인덱스)
- 그룹 판별: `receptionNumber.replace(/^F/, '').split('-')[0]` → `baseNumber`
- 같은 `baseNumber` + 같은 `F` 접두사 = 동일 그룹 (완료 토글이 함께 동작)
- **F 접두사는 성토 시료**를 의미하며 일반 시료와 별개 그룹

#### 접수번호를 언제 나누는가 (SLS-1-265, 사용자 확정 2026-08-20)

| 상황 | 번호 | 뜻 |
| --- | --- | --- |
| 한 농업인이 시료를 여러 점 | `503`, `504`, `505` | **별개 시료** — 하위필지 아님 |
| 한 시료에 지번이 여러 개 | `503`, `503-1`, `503-2` | **하위 지번** (`parcels[].subLots`) |
| 한 지번에 작물이 여러 개 | `503`(주작물), `503-1`, `503-2` | 추가 작물 (레코드 분할) |

**뒤 두 규칙은 같은 `-N` 자리를 쓴다.** 한 필지에 둘 다 있으면 **하나의 연속 번호**로
잇는다 — 작물을 먼저 세고 하위 지번이 그 뒤를 잇는다.

```
본지번 작물 2개 + 하위 지번 2개
  503    본지번 주작물     ← 레코드
  503-1  본지번 추가작물   ← 레코드
  503-2  하위 지번 ①      ← 주작물 레코드의 subLots
  503-3  하위 지번 ②
```

- 번호 계산은 **`SoilLogRecord.subLotDisplayNumber` 하나**를 목록·접수대장 내보내기·
  흙토람이 공유한다. 접수번호는 성적서와 흙토람 업로드로 나가는 **대외 식별자**라
  화면마다 다르면 안 된다. 세 곳에서 각각 계산하던 것을 모은 것이다.
- 밀어 주는 양은 레코드의 `cropSplitCount`(그 필지가 작물 몇 개로 나뉘었나)다.
  **없거나 이상한 값이면 1로 본다** → 이 티켓 이전 레코드는 동작이 그대로다.
- 하위 지번은 **주작물 레코드에만** 붙인다. 형제에도 붙이면 같은 지번이 두 번 나간다.

> ⚠️ **예전에는 작물이 2개 이상이면 하위 지번을 통째로 버렸다**
> (`subLots: isSplit ? [] : …`). 경고도 없고 등록은 성공으로 보였다.
> 하위 지번은 흙토람 업로드 파일에도 행으로 나가므로 그 지번이 흙토람에도
> 안 올라갔다.
>
> **실제 유실 건은 없었다** — 2026-08-20 사용자 확인: "한 지번에 작물 2개 이상
> 넣으면서 하위 지번도 넣어서 접수한 건이 없다." 즉 이 결함은 **발현되기 전에**
> 잡혔다. 과거 대장을 뒤져 복구할 것은 없다.

### Shared Modules (src/shared/)

| 모듈                       | 역할                                           |
| -------------------------- | ---------------------------------------------- |
| `BaseSampleManager.js`     | 시료 타입 공통 CRUD 베이스 클래스              |
| `firestore-db.js`          | Firestore CRUD (compat SDK)                    |
| `storage-manager.js`       | 듀얼 스토리지: localStorage + Firestore 싱크   |
| `excel-import-manager.js`  | 엑셀 가져오기 공통 모듈                        |
| `file-api.js`              | Electron/Web 파일 시스템 추상화                |
| `constants.js`             | 전역 상수 (`APP_VERSION` 포함, sync-version 대상) |
| `sanitize.js`              | XSS 방지, HTML/JSON 새니타이징                 |
| `path-security.js`         | 경로 검증, traversal 공격 방지                 |

### Data Storage

```text
localStorage (Primary, 오프라인 우선)
├── soilSampleLogs_{year}       → 연도별 토양 시료 데이터 (JSON 배열)
├── compostSampleLogs_{year}    → 연도별 퇴비 시료 데이터
├── compostTestResults_{year}   → 연도별 퇴비 검정결과
├── soilItemsPerPage            → 페이지 설정
└── firebase_config             → Firebase 설정

Firestore (Optional Sync)
├── soilSamples_{year}          → 연도별 컬렉션
├── compostSamples_{year}
└── compostTestResults_{year}

JSON File (Auto-save, Electron only)
├── auto-save-soil-{year}.json
└── auto-save-compost-{year}.json
```

### ⚠️ 시료 종 추가 시 갱신해야 하는 레지스트리 6곳

여기서 **하나라도 빠지면 조용한 데이터 유실 또는 컴플라이언스 오보**가 된다. 전부 실제로 사고가
났던 지점이다 (SLS-1-192, SLS-1-195).

| # | 파일 | 누락 시 결과 |
| --- | --- | --- |
| 1 | `src/index.js` `ALLOWED_TYPES` | 자동저장 경로 검증 실패 → 자동저장이 조용히 안 됨 |
| 2 | `src/shared/firestore-db.js` `COLLECTION_MAP` | 폴백으로 다른 컬렉션명 생성 → 통합본과 갈라짐, 사후 수정에 마이그레이션 필요 |
| 3 | `src/shared/main-init.js` `SAMPLE_TYPES` | "전체 동기화"가 건너뜀 (사용자는 동기화됐다고 인식) |
| 4 | `src/settings/settings-script.js` `SAMPLE_TYPES` | 백업·내보내기에서 제외 → 사용자가 백업했다고 믿고 PC 교체 시 유실. **연도별 삭제(purgeYearData)도 이 목록을 쓴다** — 빠지면 "삭제 완료" 안내 후 개인정보가 잔존 |
| 5 | `src/shared/cache-manager.js` `SAMPLE_DATA_PATTERNS` | **반대로 넣으면 안 된다.** 정식 지원 종을 넣으면 금요일 자동 캐시 클리어가 사용자 데이터를 삭제 |
| 6 | `vite.config.js` `rollupOptions.input` | 페이지가 빌드 산출물에 포함되지 않음 |

부속 데이터(검정결과 등)는 `settings-script.js`의 `extraKeys`에 등록한다 — 백업과 연도별 삭제
양쪽에서 함께 처리된다.

## Critical Constraints

### CSP — 인라인 스크립트 금지

`src/index.js`의 CSP는 `'unsafe-inline'`을 **허용하지 않습니다**. 메인 프로젝트가 모든 인라인 스크립트를 ES 모듈로 전환한 정책 그대로 상속.

- ✅ `<script type="module" src="./foo.js"></script>` 외부 모듈
- ❌ `<script>...</script>` 인라인 블록 (Electron에서 차단됨)

새 페이지에 동적 로직을 넣을 때는 반드시 별도 `.js` 파일로 분리. (예: `src/main-stats.js`가 메인 페이지 통계 패널을 처리)

### vite copyManualAssets 플러그인

`vite.config.js`의 인라인 플러그인이 `closeBundle` 훅에서 `src/manual/{images,screenshots}/`를 `docs/manual/`로 재귀 복사합니다. vite의 일반 entry로는 정적 자산이 누락되므로 이 플러그인 없이는 설명서 이미지가 빌드 산출물에 포함되지 않습니다.

새 정적 자산 폴더를 추가하려면 `copyDirRecursive` 호출을 plugin에 추가해야 합니다.

### Firebase 설정

> ⚠️ `firebase-auth.json`은 빈 값 placeholder. 설정 페이지에서 직접 정보 입력하거나 파일 수동 편집. 메인 프로젝트와 **반드시 다른 Firebase 프로젝트** 사용 (데이터 격리).

## 버전 & 릴리스

### 버전 동기화 3곳

`npm run sync-version` 실행 시 `package.json`의 version을 다음 3곳에 자동 반영:
- `src/shared/constants.js` (APP_VERSION)
- `src/index.html` (#appVersion 텍스트)
- `src/manual/index.html` (version-badge + footer)

### 릴리스 워크플로우

```bash
# package.json version 수정 → release/index.html에 새 버전 항목 추가
git tag -a v1.0.X -m "..."
git push origin main
git push origin v1.0.X
# GitHub Actions가 자동으로 Windows installer + Release 생성
```

`src/release/index.html`에 새 버전 항목을 **반드시** 먼저 추가해야 사용자에게 변경 내역이 노출됩니다.

#### 팝업으로 알릴 항목 지정 (SLS-1-218)

새 버전 첫 실행 시 뜨는 "새로워진 내용" 팝업은 **`data-popup` 표시가 붙은 것만** 보여줍니다.
릴리스 노트 페이지는 따로 들어가야 보이므로, 중요한 수정을 사용자가 그냥 지나치지 않게
하는 창구입니다.

> ⚠️ **2026-07-30 정정**: 이 문단의 초안은 근거로 "자동 업데이트가 무음으로 동작하지
> 않는다"를 들었으나 **사실이 아닙니다** — 사용자 확인 결과 자동 업데이트는 되고 있습니다.
> 당시 조사에서 `setup.exe` 다운로드 수를 "수동 설치"로 오해했는데, `latest.yml`의 `path`가
> `setup.exe`이므로 그 숫자가 곧 **업데이터가 받아간 것**이었습니다. `nupkg`가 0인 것도
> electron-updater가 그 파일을 쓰지 않기 때문입니다.
> 릴리스 노트(`release/index.html`)에 과거 "자동 업데이트 정상화" 항목이 있었는데도
> 확인하지 않았습니다. **Windows 실기 검증 없이 단정한 오류입니다.**

```html
<div class="version-entry" data-popup>   <!-- 이 버전의 모든 항목 -->
<li data-popup>…</li>                    <!-- 이 항목만 -->
```

| 상태 | 결과 |
| --- | --- |
| `version-entry`에 표시 | 그 버전의 모든 `li` |
| `li`에만 표시 | 표시된 `li`만 |
| 표시 없음 | **팝업에 나오지 않음** |

**모든 릴리스에 붙이지 마십시오.** 데이터 유실·입력 차단처럼 사용자가 반드시 알아야 하는
것만 지정합니다. 매번 뜨면 사용자가 읽지 않고 닫는 습관이 생겨 정작 중요할 때 놓칩니다.

여러 버전을 한 번에 올린 사용자에게는 **마지막으로 본 버전 이후 구간의 표시된 항목이
모두** 최신순으로 표시됩니다.

### 두 가지 팝업 — 무엇을 언제 쓰나

| | 수정사항 팝업 (SLS-1-218) | 공지 팝업 (SLS-1-219) |
| --- | --- | --- |
| 내용 출처 | 앱 내장 릴리스 노트 | Firestore `feedbackNotices` |
| 발행 방법 | `data-popup` + **새 버전 배포** | 관리자 페이지에서 즉시 |
| 웹에서 | **동작** | 미동작 (Electron 전용) |
| 네트워크 | 불필요 | 필요 |
| 뜨는 시점 | 새 버전 첫 실행 | 새 공지가 올라온 뒤 첫 실행 |

**배포와 함께 알릴 것은 릴리스 노트, 급한 것은 공지**입니다.
둘이 동시에 뜨면 겹치므로 `window.whatsNewPopup.whenClosed()`로 순차 처리됩니다
(수정사항 → 공지 순).

#### 공지 발행 절차 (관리자)

1. 앱에서 문의/건의 → 관리자 로그인 (또는 `src/feedback-admin/` 직접)
2. **공지 작성**에 제목·내용 입력
3. 팝업으로 알려야 하면 **`앱 실행 시 팝업으로 알림`** 체크 (기본 꺼짐)
4. **`표시 종료일`** 지정 — 비우면 계속 뜹니다
5. 등록 → 사용자가 앱을 다시 켤 때 뜹니다

`popup` 필드가 없는 기존 공지는 팝업에 나오지 않습니다(`=== true` 엄격 비교).
이미 발행된 공지가 갑자기 튀어나오지 않게 한 것입니다.

⚠️ **모든 공지에 팝업을 켜지 마십시오.** 매번 뜨면 읽지 않고 닫는 습관이 생겨
정작 중요할 때 놓칩니다.

빌드 시 `scripts/extract-whatsnew.js`가 `src/shared/whatsnew-data.js`를 생성합니다
(커밋 대상). `package.json` 버전 항목이 릴리스 노트에 없으면 **빌드가 실패**해,
위의 "반드시 먼저 추가" 규칙이 기계적으로 강제됩니다.

### GitHub Actions 설정

`.github/workflows/build.yml`:
- **Permissions**: `contents: write` 필수 (Release 생성 권한)
- **Env**: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` (Node 20 deprecation 대응)
- **Runner**: windows-latest, Node 22

**Secrets 필요**:
- `ALLOWED_GATEWAY` — 게이트웨이 IP (빈 값이면 웹 접근 제한 없음)
- `VWORLD_API_KEY` — VWORLD 지번 지오코딩 API 키

### GitHub Pages

- Source: `main` 브랜치 / `/docs` 폴더
- URL: https://bluesky78060.github.io/sample-log-soil/
- 활성화 명령: `gh api -X POST repos/bluesky78060/sample-log-soil/pages -f "source[branch]=main" -f "source[path]=/docs"`

## 알려진 함정

### 큰 push 시 HTTP 400

`docs/` 빌드 산출물 + 이미지 등으로 첫 push가 ~10MB 이상이면 HTTP 400 발생.

```bash
git -c http.postBuffer=524288000 push origin main
```

### CI 빌드 전 network-config

빌드 전 `network-config.example.js` → `network-config.js` 복사 필요.
GitHub Actions에서는 워크플로우의 "Create network-config with secrets" 스텝이 자동 생성.

### 메인 프로젝트와의 관계

- `src/shared/`는 메인 프로젝트와 동일 코드 기반에서 시작했으나 이후 독립 진화
- 메인 프로젝트의 변경사항을 자동 동기화하지 않음 — 필요 시 수동 cherry-pick
- 암호화 시스템(`encryption-manager.js`, `crypto-utils.js`)은 메인에 없으며 본 프로젝트에도 없음. `sample-log-electron-test`에만 존재

### 자동 진행 원칙

사용자 요청 시 **중간 확인 없이 전 단계 자동 완료**:
1. 티켓 발행 → start_work → 구현 → 빌드 → submit_test → 코드리뷰 → approve_review 연속 실행
2. CHANGES_REQUESTED 시만 수정 후 재진행

### 문의게시판 알림 자격증명 클라이언트 동봉 (수용된 리스크, SLS-1-170)

`feedback-auth.json`의 `notify` 블록(Telegram 봇 토큰, EmailJS 키)은 `forge.config.js`의
`extraResource`로 **Electron 설치본에 그대로 동봉**된다(`src/feedback/feedback-notify.js`가
런타임에 읽어 Telegram/EmailJS REST API를 직접 호출). asar/resources는 난독화가 아니라 단순
아카이브라, 전국에 배포되는 설치 파일을 받은 사람은 누구나 자격증명을 추출할 수 있다.

- **영향 범위**: 봇 토큰 탈취 시 해당 봇으로 메시지 전송/삭제, EmailJS 키 탈취 시 스팸 발송·쿼터
  소진 정도. **시료 데이터는 영향 없음**(문의게시판은 별도 Firebase 프로젝트로 격리, `firestore.rules`가
  서버측으로 쓰기 스키마·소유자를 강제함 — 이 자격증명과는 무관한 방어선).
- **정석 해법**: 알림 발송을 Firebase Cloud Functions(Firestore `feedbackInquiries` onCreate 트리거)
  등 서버측으로 이전해 클라이언트에 시크릿을 두지 않는 것. 2026-07-02 보안 분석에서 이 방안이
  제시됐으나, 배포·운영 부담(Blaze 요금제 활성화, `firebase deploy` 등은 Firebase 콘솔/CLI 접근 권한이
  있는 사람이 별도로 수행해야 함) 대비 실이익이 낮다고 판단해 **의도적으로 보류**했다(SLS-1-170).
- **완화책(현재 적용됨)**: 알림용 Telegram 봇/EmailJS 계정은 반드시 **전용·최소 권한**으로 발급한다
  (다른 용도로 겸용하지 않는 별도 봇, 발신 전용 EmailJS 서비스). 자격증명이 유출되어도 피해가 해당
  알림 채널 하나로 국한되도록 하는 것이 핵심.
- **재검토 시점**: 문의게시판 알림 채널이 늘어나거나(예: Slack/카카오 등 추가), 자격증명이 실제로
  악용된 정황이 있으면 서버 이전을 재검토한다.
