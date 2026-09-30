# 구조 참고 — 폴더·시료 종 패턴·공통 모듈·저장소 (CLAUDE.md 에서 분리, SLS-1-294)

> 코드에서 직접 볼 수 있는 구조를 정리한 참고다. 원문은 CLAUDE.md 「Architecture」 절이었다.

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

