# CLAUDE.md

Claude Code 가이드 문서.

## Project Overview

토양 시료 접수 대장 (Soil Sample Log) - 봉화군 농업기술센터 **토양 분석 전용** 시료 접수 시스템. **Electron 데스크톱 앱 + 웹 앱** 듀얼 환경.

> 본 프로젝트는 `sample-log-electron`(5종 시료 통합본)에서 토양 부분만 분리한 단독 프로젝트입니다. v1.0.0(2026-05-08) 기준 신규 출발.

## Commands

```bash
npm start              # Electron 실행
npm run start:dev      # DevTools 포함
npm run dev            # Vite 웹 서버 (localhost:3000)
npm run dev:electron   # Electron + Vite 동시
npm run build          # Tailwind + sync-version + Vite → docs/
npm run package        # 현재 OS용 패키지
npm run make           # 설치 파일 (Win: exe, Mac: zip)
npm test               # Playwright E2E (docs/ 대상)
```

## Architecture

### Dual Environment (Electron + Web)

- **Electron**: `window.electronAPI` (IPC, 파일 시스템)
- **Web**: File System Access API 또는 다운로드 폴백

```javascript
const isElectron = window.electronAPI?.isElectron === true;
```

### Process Architecture

- **Main** (`src/index.js`): IPC 핸들러, 자동 업데이터, 경로 보안, CSP
- **Preload** (`src/preload.js`): `contextBridge`로 `window.electronAPI` 노출

IPC 채널 전체 목록은 `src/preload.js` 참조.

### Folder Structure

```text
src/
├── index.js, preload.js, index.html, main-entry.js
├── shared/               # 공통 모듈 (~26개, window.* 전역 노출)
├── styles/               # Tailwind input, 테마
├── soil/                 # 토양 시료 페이지
├── heuktoram/            # 흙토람 검정결과 가져오기
└── {settings,label-print,manual,release}/

docs/                     # GitHub Pages 배포용 (Vite 빌드 결과)
tests/e2e/                # Playwright (docs/ 대상)
```

### Sample Type (Soil only)

```text
src/soil/
├── index.html
├── soil-script.js    # 비즈니스 로직
└── soil-style.css
```

필수 상수:
```javascript
const SAMPLE_TYPE = '토양';
const STORAGE_KEY = 'soilSampleLogs';
const AUTO_SAVE_FILE = 'soil-autosave.json';
```

초기화: `DOMContentLoaded` → FileAPI → Firebase/자동저장 병렬 init → UI.

### Shared Modules (src/shared/)

| 모듈                       | 역할                                           |
| -------------------------- | ---------------------------------------------- |
| `BaseSampleManager.js`     | 시료 타입 공통 CRUD 베이스 클래스              |
| `firestore-db.js`          | Firestore CRUD (compat SDK)                    |
| `storage-manager.js`       | 듀얼 스토리지: localStorage + Firestore 싱크   |
| `excel-import-manager.js`  | 엑셀 가져오기 공통 모듈                        |
| `file-api.js`              | Electron/Web 파일 시스템 추상화                |
| `constants.js`             | 전역 상수 (`APP_VERSION` 포함)                 |
| `sanitize.js`              | XSS 방지, HTML/JSON 새니타이징                 |
| `path-security.js`         | 경로 검증, traversal 공격 방지                 |

### Data Storage Strategy

```text
localStorage (Primary)
├── soilSampleLogs_{year}  → 연도별 토양 시료 데이터
├── soilItemsPerPage       → 페이지 설정
└── firebase_config        → Firebase 설정

Firestore (Optional Sync)
└── soilSamples_{year}     → 연도별 컬렉션

JSON File (Auto-save)
└── auto-save-soil-{year}.json
```

- 오프라인 우선: localStorage는 항상 동작, Firestore는 온라인 시 싱크
- Firestore IndexedDB 캐시로 오프라인 쓰기 지원

### Firebase 설정

> ⚠️ `firebase-auth.json`은 빈 값으로 초기화되어 있습니다. 설정 페이지에서 직접 Firebase 프로젝트 정보를 입력하거나, 파일을 수동 편집하세요. 메인 프로젝트(`sample-log-electron`)와는 **다른 Firebase 프로젝트**를 사용해야 데이터가 분리됩니다.

## Development Notes

### Build & 버전

- 빌드 파이프라인: `build:css` (Tailwind) → `sync-version` → `vite build` → `docs/`
- 버전 관리 3곳: `package.json` (소스) / `src/shared/constants.js` (자동 동기화) / `src/index.html` (수동, 폴백용)
- `npm run sync-version`으로 constants.js 자동 반영

### 릴리스 (GitHub Actions)

```bash
git tag v1.0.1 && git push origin v1.0.1
```

Windows(windows-latest) + Node 22에서 `npm run make` → GitHub Release 자동 생성. 태그 시 **`src/release/index.html`에 새 버전 항목 추가 필수**.

GitHub Actions Secrets 설정 필요:
- `ALLOWED_GATEWAY` — 게이트웨이 IP
- `VWORLD_API_KEY` — VWORLD 지번 지오코딩 API 키

### Build Configuration

- **Electron Forge** + Squirrel(Win) / Zip(Mac) / Deb·RPM(Linux)
- **Vite** (`src` → `docs/`), **Tailwind v3** (`src/styles/input.css` → `src/shared/tailwind-output.css`)
- **Firebase SDK**: Compat 모드 (`firebase: ^12.7.0`)
- **Security Fuses**: ASAR 무결성, nodeOptions/inspection 비활성화
- **CI 주의**: 빌드 전 `network-config.example.js` → `network-config.js` 복사 필요 (또는 Secrets로 자동 생성)

### 메인 프로젝트와의 관계

- 본 프로젝트는 `sample-log-electron`에서 **토양 부분만 분리**된 독립 저장소입니다.
- `src/shared/`는 메인 프로젝트와 동일한 코드 기반에서 시작했으나, 이후 독립 진화합니다.
- 메인 프로젝트의 변경사항을 자동 동기화하지 않습니다. 필요 시 수동으로 cherry-pick.
