# SLS-1-267 실행 계획 — 설명서 캡처 분리 + 조건부 통과 제거

## 0단계. 기준선 — 현재 캡처가 통과하는지 먼저 본다

단언을 추가하기 **전에** 지금 상태로 캡처가 도는지 확인한다. 이걸 건너뛰면
"내 단언 때문에 깨진 것"과 "원래 깨져 있던 것"을 구별할 수 없다.

```bash
npx playwright test tests/e2e/manual-capture.spec.js --reporter=line
git checkout -- src/manual/images/   # 확인 후 되돌린다
```

## 1단계. 조건부 통과 제거 (`manual-capture.spec.js`)

```diff
- const listBtn = page.locator('#navListBtn, [data-view="list"]').first();
- if (await listBtn.count()) await listBtn.click();
- await page.waitForTimeout(300);
+ // #navListBtn은 compost·soil 어디에도 없다 — 죽은 폴백이라 제거한다.
+ // 조건부 클릭이면 셀렉터가 깨져도 통과한 채 접수 화면을 '목록'으로 저장한다 (SLS-1-197 m-2).
+ const listBtn = page.locator('[data-view="list"]');
+ await expect(listBtn).toBeVisible();
+ await listBtn.click();
+ await expect(page.locator('#listView')).toBeVisible();   // 목록이 실제로 떴는가
+ await page.waitForTimeout(300);
```

⚠️ `expect`를 import해야 한다 — 현재 이 파일은 `test`만 가져온다.

⚠️ **`waitForTimeout(300)`은 남긴다.** 목록 렌더 애니메이션이 끝난 뒤를 찍어야 하는데,
`toBeVisible()`은 "DOM에 있고 보인다"까지만 보장한다. 고정 대기 제거는 이 티켓 범위 밖이다.

## 2단계. 캡처를 기본 실행에서 분리 (`playwright.config.js`)

```js
// 설명서 캡처는 매 실행마다 src/manual/images/의 13개 파일을 다시 쓴다.
// 기본 E2E에 섞이면 작업트리가 무관한 변경으로 오염되고, git add -A로 의도치 않게
// 커밋된다(바이너리라 diff가 크게 잡힌다). 설명서를 갱신할 때만 명시적으로 돌린다.
//   npm test              → 캡처 제외
//   npm run capture:manual → 캡처만
const CAPTURE_MANUAL = !!process.env.CAPTURE_MANUAL;
const MANUAL_SPEC = /manual-capture\.spec\.js/;

projects: CAPTURE_MANUAL
    ? [{ name: 'manual',   testMatch:  MANUAL_SPEC, use: { ...devices['Desktop Chrome'] } }]
    : [{ name: 'chromium', testIgnore: MANUAL_SPEC, use: { ...devices['Desktop Chrome'] } }],
```

## 3단계. 실행 경로 제공 (`package.json`)

```json
"capture:manual": "CAPTURE_MANUAL=1 npx playwright test"
```

⚠️ 빌드 산출물(`docs/`)을 대상으로 서빙하므로 **캡처 전에 `npm run build`가 선행**되어야
최신 화면이 찍힌다. 스크립트에 넣을지, 관례로 둘지는 구현 중 판단한다
(빌드를 항상 강제하면 캡처만 다시 찍고 싶을 때 느려진다).

## 4단계. 관례 기록 (`CLAUDE.md`)

"릴리스 전 `npm run capture:manual`로 설명서 이미지를 갱신한다"를 릴리스 워크플로우 절에
추가한다. **기본 실행에서 뺀 것의 대가는 "아무도 안 돌린다"이므로, 돌릴 시점을 명시해야
한다.**

## 검증 (통과 조건)

| 검증 | 기대 |
| --- | --- |
| 0단계 기준선 | 현재 캡처가 통과 (단언 추가 전) |
| `npx playwright test` | 캡처 제외, 통과. **이후 `git status`가 깨끗하다** |
| 감소분 확인 | 기본 E2E 건수 감소 = 캡처 테스트 수와 **정확히 일치** |
| `npm run capture:manual` | 캡처만 실행되고 이미지가 갱신된다 |
| **변이 검증** | `[data-view="list"]`를 없는 셀렉터로 바꾸면 캡처 테스트가 **실패**한다. 지금은 조건부라 통과한다 — 이 변이가 이 티켓의 핵심 증명이다 |
| 단위·lint | 회귀 0 |

## 하지 않을 것

- `waitForTimeout` → 조건 대기 전면 교체 (캡처 품질 판단이 필요, 별 티켓)
- 캡처 이미지 재촬영·품질 개선
- CI에 캡처 단계 추가 — 현재 CI(`build.yml`)는 Windows 설치본 빌드 전용이다.
  캡처를 CI에 넣으면 이미지가 CI에서 갱신되어 커밋 충돌이 난다. **관례로 둔다.**

## 롤백

`git revert` 한 번. 앱 코드는 건드리지 않는다.
