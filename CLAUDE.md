# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

토양 시료 접수 대장 (Soil Sample Log) — **토양 + 가축분뇨 퇴비(퇴·액비 부숙도)** 시료 접수/관리 시스템 (전국 농업기술센터·분석기관 배포용). **Electron 데스크톱 + GitHub Pages 웹** 듀얼 환경.

> [`sample-log-electron`](https://github.com/bluesky78060/sample-log-electron)(5종 시료 통합본)에서 토양 부분만 분리한 독립 프로젝트(v1.0.0 = 2026-05-08). 퇴비는 2026-07-26에 다시 이식해 **지원 시료 종은 2종**이다.

## 작업별 안내 — 해당 작업을 할 때 먼저 읽는다

이 파일은 **항상 걸리는 규칙만** 담는다. 작업별 절차·참고는 `docs-internal/guides/`에 있다(`@` 가져오기가 아니라 경로 — 필요할 때만 읽는다).

| 하려는 작업 | 읽을 문서 |
| --- | --- |
| **릴리스**(버전 올리기·태그·릴리스 노트·팝업 지정·공지 발행) | `docs-internal/guides/release.md` |
| 접수번호·하위 지번·그룹 토글·내보내기·흙토람 번호 | `docs-internal/guides/reception-number.md` |
| 티켓 훅 표 · fast-track 판단 기준 · `docs/` 사본 절차 | `docs-internal/guides/ai-pm-workflow.md` |
| 폴더 구조 · 시료 종 패턴 · 공통 모듈 · 저장소 키 | `docs-internal/guides/architecture-reference.md` |
| 문의게시판 알림 자격증명 등 수용한 리스크 | `docs-internal/guides/decisions.md` |

## AI PM 작업 관리 (필수, Hook 강제)

모든 코드 변경은 **AI PM System MCP** 티켓 발행 후 진행. 전역 워크플로우는 `~/.claude/rules/ai-pm-ticket.md`.

- **프로젝트 ID**: `0a5f80f1-ede5-4b09-89b2-0001d6b89426` · **프로젝트 코드**: `SLS`
- **General 에픽 ID**: `4d7bdd33-38c5-4c17-9cfc-c3c37b664549`
- **API URL**: `https://ai-pm-system.onrender.com`

`create_task` 시 `epic_id` 누락 금지. `approve_review` notes는 CRITICAL/MAJOR/MINOR/SUGGESTION 카운트 + 판정 형식.
`.claude/settings.json`의 PreToolUse 훅(`ticket-guard.sh`, `epic-id-guard.sh`)이 활성 티켓 없는 `src/`·`tests/` 소스 수정과 `epic_id` 누락을 차단한다.

```bash
bash .claude/hooks/set-ticket.sh SLS-X-Y          # 활성화 (정식 워크플로우)
bash .claude/hooks/set-ticket.sh SLS-X-Y --fast   # fast-track (플랜·리뷰 산출물 생략)
bash .claude/hooks/set-ticket.sh                  # 조회
bash .claude/hooks/set-ticket.sh clear            # 해제 (done 뒤)
```

**fast-track 기준은 "몇 줄이냐"가 아니라 "틀렸을 때 되돌릴 수 있느냐"** — 화면 문구·오타·주석·문서·버전 동기화·릴리스 노트·CSS 색상은 fast-track,
조건문·분기·삭제·저장 경로·데이터 모델·스토리지 키·내보내기 산출물 형식은 정식 워크플로우. **한 줄짜리라고 fast-track이 아니다**(로직이 바뀌면 정식).
보안·DB 마이그레이션·결제·권한 경로는 `--fast`를 걸어도 `codex-review-guard`가 재확인해 차단한다. 상세: `docs-internal/guides/ai-pm-workflow.md`.

### ⚠️ 훅이 요구하는 `docs/`는 빌드가 지운다 — 산출물 정본은 `docs-internal/`

`docs/`는 vite `outDir`이고 `emptyOutDir: true`라 `npm run build`가 비운다. 훅이 찾는 `docs/00-discovery`·`01-plan`·`02-review`·`03-code-review` 산출물은
**정본을 `docs-internal/ai-pm/{티켓}/`에 두고 커밋**하며, `docs/` 사본(머리에 「정본은 docs-internal/ 에 있다」 한 줄)은 훅 통과용 일회용이다 — 게이트 직전에 만들고 승인 뒤 지운다. 커밋하지 않는다.

표준 순서: `create_task` → `set-ticket.sh` → `start_work` → 수정 → 빌드/테스트 → `submit_test` → 코드리뷰 → `approve_review` → `set-ticket.sh clear`.

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

- **Dual Environment**: `const isElectron = window.electronAPI?.isElectron === true;` — Electron은 `window.electronAPI`(IPC·파일 I/O·자동저장), 웹은 File System Access API 또는 다운로드 폴백. 차이는 `src/shared/file-api.js`가 추상화.
- **Main** (`src/index.js`): IPC 핸들러, electron-updater, 경로 보안, **CSP**. **Preload** (`src/preload.js`): `contextBridge`로 `window.electronAPI` 노출.
- **시료 종 2종**: `src/soil/`(`STORAGE_KEY='soilSampleLogs'`), `src/compost/`(`'compostSampleLogs'`, `BaseSampleManager` 상속). 완료 필드는 두 종 모두 `isComplete` — base의 `migrateCompletedField`는 `completed`를 채우므로 soil은 자체 오버라이드, compost는 **no-op 오버라이드**로 우회(그대로 두면 Firestore 문서까지 오염).
- **저장**: localStorage(연도별 `soilSampleLogs_{year}` 등, 1차), Firestore(선택 동기화), Electron 자동저장 JSON은 각각 별도 계층. 초기화: `DOMContentLoaded` → FileAPI → Firebase/자동저장 병렬 init → UI.
- **접수번호**: 본필지 `503`/`F503`(성토), 하위 `503-1`. 번호 계산은 **`SoilLogRecord.subLotDisplayNumber` 하나**를 목록·내보내기·흙토람이 공유한다(대외 식별자라 화면마다 다르면 안 됨). 상세: `docs-internal/guides/reception-number.md`.

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

## 버전 & 릴리스 — 핵심 규칙 (절차 전체는 `docs-internal/guides/release.md`)

- `npm run sync-version`이 `package.json` 버전을 `src/shared/constants.js`·`src/index.html`·`src/manual/index.html` 3곳에 반영한다.
- **`src/release/index.html`에 새 버전 항목을 먼저 추가**해야 한다 — 없으면 빌드가 실패한다(`scripts/extract-whatsnew.js`). 릴리스마다 `tests/unit/release-notes-privacy.test.js`의 배포 이력 개수도 함께 올린다.
- 릴리스 노트는 **커밋 제목이 아니라 diff를 보고** 쓴다.
- **`data-popup`은 모든 릴리스에 붙이지 않는다** — 데이터 유실·입력 차단처럼 사용자가 반드시 알아야 하는 것만. 매번 뜨면 읽지 않고 닫는 습관이 생긴다. 공지 팝업(Firestore `feedbackNotices`)도 마찬가지.
- 태그(`git tag -a v1.x.y` → `git push origin main` → `git push origin v1.x.y`) push 시 GitHub Actions가 Windows 설치본 + Release를 만든다(runner windows-latest, Node 22, 설치는 `npm ci`).
- 화면이 바뀐 릴리스는 태그 전에 `npm run build && npm run capture:manual`로 설명서 이미지를 다시 찍는다(`npm test`는 캡처를 돌리지 않는다).
- GitHub Pages: `main` 브랜치 `/docs` 폴더 — https://bluesky78060.github.io/sample-log-soil/

## 알려진 함정

- **`ALLOWED_GATEWAY`(Actions secret / `network-config.js`) 빈 값 = 웹에서 접근 거부**(Firebase 없이 로컬 모드, `network-access.js` `checkAccess()`) — 「제한 없음」이 아니다. `docs/`를 다시 빌드해 커밋할 때는 `window.NETWORK_CONFIG = { ALLOWED_GATEWAY: '' };`로 만들고, 예시 파일(`'0.0.0.0'`)을 복사해 빌드하지 않는다. 로컬 빌드 전 `network-config.js`가 없으면 예시에서 복사(gitignore 대상).
- **큰 push 시 HTTP 400**(첫 push ~10MB 이상): `git -c http.postBuffer=524288000 push origin main`.
- **graft 훅은 전역 `~/.claude/settings.json`에만** 둔다(SLS-1-288) — 프로젝트에 두면 `.claude/helpers/`가 커밋되지 않아 새 워크트리에서 없는 파일을 부른다. `docs/` 번들까지 색인되므로 질의는 `graft ask --in src/ "…"`.
- **메인 프로젝트(`sample-log-electron`)와 자동 동기화하지 않는다** — `src/shared/`는 독립 진화했고 필요하면 수동 cherry-pick. 암호화 시스템(`encryption-manager.js`, `crypto-utils.js`)은 메인 프로젝트와 본 프로젝트에는 없고 `sample-log-electron-test`에만 있다.
- **패키징 앱은 반드시 `--user-data-dir=<임시폴더>`로 실행**한다 — `~/Library/Application Support/토양 시료 접수 대장`에 실사용 데이터가 있다. E2E는 http/`docs/`만 돌아 메인 프로세스·`file://` 경로를 못 잡는다(실기 확인 필요).
- **문의게시판 알림 자격증명(Telegram·EmailJS)은 설치본에 동봉**된다 — 수용한 리스크(SLS-1-170), 전용·최소 권한 계정만 쓴다. 근거·재검토 시점: `docs-internal/guides/decisions.md`.

### 자동 진행 원칙

사용자 요청 시 **중간 확인 없이 전 단계 자동 완료**: 티켓 발행 → start_work → 구현 → 빌드 → submit_test → 코드리뷰 → approve_review 연속 실행. CHANGES_REQUESTED 시만 수정 후 재진행.
