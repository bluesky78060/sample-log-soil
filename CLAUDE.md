# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

토양 시료 접수 대장 (Soil Sample Log) — **토양 분석 전용** 시료 접수/관리 시스템 (전국 농업기술센터·분석기관 배포용). **Electron 데스크톱 + GitHub Pages 웹** 듀얼 환경.

> 본 저장소는 [`sample-log-electron`](https://github.com/bluesky78060/sample-log-electron)(5종 시료 통합본)에서 토양 부분만 분리한 독립 프로젝트입니다. v1.0.0 = 2026-05-08 신규 출발.

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
bash .claude/hooks/set-ticket.sh SLS-X-Y   # 활성화
bash .claude/hooks/set-ticket.sh             # 조회
bash .claude/hooks/set-ticket.sh clear       # 해제
```

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
├── soil/                  # 토양 시료 페이지 (단일 시료 타입)
├── heuktoram/             # 흙토람 검정결과 가져오기 (토양 페이지에서 진입)
└── {settings,label-print,manual,release}/

docs/                      # GitHub Pages 배포용 (Vite 빌드 결과)
tests/{e2e,unit}/          # Playwright + vitest
.github/workflows/build.yml  # 태그 push 시 Windows installer 자동 빌드
```

### Sample Type (Soil only) Pattern

```text
src/soil/
├── index.html
├── soil-script.js    # 비즈니스 로직 (BaseSampleManager 상속)
└── soil-style.css
```

스크립트 필수 상수:
```javascript
const SAMPLE_TYPE = '토양';
const STORAGE_KEY = 'soilSampleLogs';
const AUTO_SAVE_FILE = 'soil-autosave.json';
```

초기화: `DOMContentLoaded` → FileAPI → Firebase/자동저장 병렬 init → UI.

### 본필지 / 하위필지 데이터 모델

토양 시료의 핵심 데이터 모델로, **메인 페이지 통계 패널과 토양 페이지의 완료 토글 그룹핑**이 모두 이 규칙을 따릅니다.

- **본필지**: `receptionNumber`가 `'503'` / `'F503'`(성토)
- **하위필지**: `'503-1'`, `'F503-2'` (하이픈 + 인덱스)
- 그룹 판별: `receptionNumber.replace(/^F/, '').split('-')[0]` → `baseNumber`
- 같은 `baseNumber` + 같은 `F` 접두사 = 동일 그룹 (완료 토글이 함께 동작)
- **F 접두사는 성토 시료**를 의미하며 일반 시료와 별개 그룹

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
├── soilSampleLogs_{year}  → 연도별 토양 시료 데이터 (JSON 배열)
├── soilItemsPerPage       → 페이지 설정
└── firebase_config        → Firebase 설정

Firestore (Optional Sync)
└── soilSamples_{year}     → 연도별 컬렉션

JSON File (Auto-save, Electron only)
└── auto-save-soil-{year}.json
```

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
