# SLS-1-267 코드 리뷰 — 설명서 캡처 분리 + 조건부 통과 제거

**일자**: 2026-08-21
**판정**: **APPROVED** — CRITICAL 0 / MAJOR 0 / MINOR 0 / 플랜 대비 변경 1건

## 🚨 이 리뷰의 한계 — 독립 레인 없음

**독립 코드리뷰 도구 두 가지가 모두 사용 불가였다.**

| 도구 | 상태 |
| --- | --- |
| `codex` | 사용량 한도 소진 (2026-09-10까지). 플랜 리뷰 도중 끊김 |
| `gemini` | `GOOGLE_CLOUD_PROJECT` 미설정 |

작업 중 사용자가 codex 새 계정을 추가했으나, **CLI 자격증명이 갱신되지 않아**
(`~/.codex/auth.json`이 2026-08-11자 그대로) 여전히 한도 소진 계정으로 동작했다.
`codex logout && codex login`이 필요하다고 안내했다.

**사용자 판단으로 독립 리뷰 없이 진행**(2026-08-21 확인).

> 평소의 3중 검증 중 둘째 레인(다른 계열 모델의 독립 시각)이 빠졌다. 품질 보증 수준이
> 평소보다 낮다는 것을 기록으로 남긴다. **완화책으로 변이 검증을 두 방향으로 걸었다** —
> 아래 「적대적 검증」 참조.

판단 근거: 앱 코드를 건드리지 않는 **테스트 인프라 변경**이고, 보안·DB·결제·권한
어디에도 해당하지 않으며, 롤백은 `git revert` 한 번이다.

## 변경

| 파일 | 내용 |
| --- | --- |
| `playwright.config.js` | `testIgnore`로 캡처 스펙을 기본 실행에서 제외 (+19) |
| `playwright.manual.config.js` | **신규** — 그 제외를 걷어내고 캡처만 실행 |
| `package.json` | `capture:manual` 스크립트 |
| `tests/e2e/manual-capture.spec.js` | 조건부 클릭 → 단언, `#listView` 가시성 확인, 죽은 셀렉터 제거 (+13/-3) |

## ⚠️ 플랜 대비 변경 1건 — Windows 호환성

플랜은 환경변수 방식이었다:

```json
"capture:manual": "CAPTURE_MANUAL=1 npx playwright test"
```

**`VAR=1 cmd` 형식은 POSIX 쉘 문법이라 Windows `cmd`에서 동작하지 않는다.**
이 저장소는 전국 기관에 **Windows 설치본**으로 배포되므로 개발·검증 환경도 Windows일 수
있다. 플랜 리뷰에서 스스로 짚었던 위험(⚠️ 1)이며, 확인 결과 실재해 방식을 바꿨다.

**별도 config 파일**(`playwright.manual.config.js`)로 대체했다:
- `cross-env` 같은 **의존성 추가 없이** 두 플랫폼에서 동일 동작
- `--config` 플래그는 플랫폼 중립

```js
const { testIgnore, ...rest } = base;   // 키 자체를 빼야 확실하다
module.exports = { ...rest, testMatch: /manual-capture\.spec\.js/ };
```

> spread 후 `testIgnore: undefined`를 할당하는 대신 **구조분해로 키를 제거**했다.
> `undefined` 할당은 키가 존재하는 상태로 남아 Playwright의 해석에 의존하게 된다.

## 조건부 통과 제거

```diff
- const listBtn = page.locator('#navListBtn, [data-view="list"]').first();
- if (await listBtn.count()) await listBtn.click();
+ const listBtn = page.locator('[data-view="list"]');
+ await expect(listBtn).toBeVisible();
+ await listBtn.click();
+ await expect(page.locator('#listView')).toBeVisible();   // 목록이 실제로 떴는가
```

확인한 사실:
- `#navListBtn`은 **compost·soil 어디에도 없다** — 폴백이 아니라 죽은 셀렉터
- 이 패턴은 이 파일에 **한 곳뿐**(`grep` 전수) — 하나 고치면 끝난다
- `#listView`는 목록 뷰의 올바른 셀렉터 (`compost/index.html:434`, `soil/index.html:326`)

`waitForTimeout(300)`은 **의도적으로 남겼다.** `toBeVisible()`은 "DOM에 있고 보인다"까지만
보장해 렌더 애니메이션 중간을 찍을 위험이 있다. 고정 대기 전면 교체는 캡처 품질 판단이
필요해 별 티켓으로 둔다.

## 적대적 검증 — 변이 2방향

독립 레인이 없는 것을 여기서 벌충했다.

| 변이 | 되돌린 것 | 결과 |
| --- | --- | --- |
| **A** | `[data-view="list"]` → 없는 셀렉터 | ✅ 캡처 **1건 FAIL** (14 passed). 이전 조건부 코드였다면 **통과한 채 틀린 이미지를 저장**했을 지점 |
| **B** | `playwright.config.js`의 `testIgnore` 제거 | ✅ 기본 실행에 잡힌 캡처 테스트 **0 → 15**. 복원하면 다시 0 |

변이 A가 이 티켓의 핵심 증명이다. **"초록불인데 산출물이 틀린"** 상태를 실제로
막게 되었음을 보인다.

## 플랜 리뷰 승인 조건 5가지 — 전부 충족

| # | 조건 | 결과 |
| --- | --- | --- |
| 1 | 변이 검증 두 방향 | ✅ A·B 모두 성공 |
| 2 | `capture:manual` 실제 실행 확인 | ✅ 15건 실행, 이미지 13개 갱신 |
| 3 | Windows 호환성 직접 확인 후 대안 채택 | ✅ 환경변수 → 별도 config |
| 4 | 기본 E2E 감소분 = 정확히 15 | ✅ **444 → 429** |
| 5 | `npx playwright test` 후 `git status` 깨끗 | ✅ 매뉴얼 이미지 무변경 |

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| 기본 E2E | ✅ **429 passed** (444 − 15, 캡처만 제외됨) |
| 캡처 전용 | ✅ **15 passed**, 이미지 13개 갱신 |
| 작업트리 | ✅ 기본 실행 후 `src/manual/images/` 무변경 |
| 단위 | ✅ 863 passed (56 files) |
| Lint | ✅ 오류 0 / 경고 6 (기존 기준선) |
| 변이 검증 | ✅ 2/2 |

## 남은 것

- **캡처가 썩지 않게 하는 관례**: 기본 실행에서 뺀 대가는 "아무도 안 돌린다"이다.
  릴리스 전 `npm run capture:manual`을 돌리는 관례를 CLAUDE.md에 적는다(4단계).
  변이 A 덕분에 **돌리는 순간 파손이 드러나므로** 위험은 크게 줄었다.
- **`waitForTimeout` → 조건 대기** (SLS-1-197의 나머지 절반) — 별 티켓
- **독립 리뷰 재실행**: codex CLI 로그인이 갱신되면 이 변경을 사후 리뷰에 넣을 수 있다.
  테스트 인프라라 위험이 낮아 지금 막지는 않았다.
