# 릴리스 절차 (CLAUDE.md 에서 분리, SLS-1-294)

> 릴리스할 때 읽는다. 원문은 CLAUDE.md 「버전 & 릴리스」 절이었다. 본문은 옮기기만 했고 내용을 고치지 않았다.

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

#### 설명서 이미지 갱신 — 릴리스 전 수동 실행 (SLS-1-267)

화면이 바뀐 릴리스라면 태그를 붙이기 전에 설명서 캡처를 다시 찍습니다.

```bash
npm run build          # 캡처는 docs/ 빌드 산출물을 대상으로 찍는다
npm run capture:manual # src/manual/images/ 13개 갱신
```

**`npm test`는 캡처를 돌리지 않습니다.** 매 실행마다 png 13개를 다시 써서 작업트리가
무관한 변경으로 오염되고, `git add -A`로 의도치 않게 커밋되기 때문입니다
(`playwright.config.js`의 `testIgnore` → `playwright.manual.config.js`로 분리).

> ⚠️ **기본 실행에서 뺀 대가는 "아무도 안 돌린다"입니다.** 그래서 캡처 스펙의 조건부
> 클릭을 단언으로 바꿨습니다 — 셀렉터가 깨지면 **돌리는 순간 실패**합니다. 예전에는
> 통과한 채 접수 화면을 "목록" 이미지로 저장해 그대로 배포됐습니다.

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
- `ALLOWED_GATEWAY` — 게이트웨이 IP. **빈 값이면 웹에서 접근 거부**(Firebase 없이 로컬 모드) — `network-access.js`의 `checkAccess()`
- `VWORLD_API_KEY` — VWORLD 지번 지오코딩 API 키

### GitHub Pages

- Source: `main` 브랜치 / `/docs` 폴더
- URL: https://bluesky78060.github.io/sample-log-soil/
- 활성화 명령: `gh api -X POST repos/bluesky78060/sample-log-soil/pages -f "source[branch]=main" -f "source[path]=/docs"`

