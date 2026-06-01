# 컴맹 친화 이미지 설명서 보강 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 컴퓨터에 익숙하지 않은 사용자도 화면을 보고 따라 하기만 하면 토양 시료 접수 대장 앱을 끝까지 쓸 수 있도록, 데모 데이터가 채워진 단계별 주석 스크린샷과 절차형 인앱 HTML 설명서를 만든다.

**Architecture:** Playwright로 웹 빌드(`docs/`)를 띄워 ① `localStorage`에 가공 더미 데이터를 주입하고 ② 대상 요소 위에 번호·화살표·강조박스 오버레이를 DOM으로 그린 뒤 ③ PNG로 캡처한다. 산출된 주석 스크린샷을 `src/manual/index.html`의 "1단계→2단계→3단계" 절차형 마크업에 삽입하고 `docs/`로 동기화한다.

**Tech Stack:** Playwright(@playwright/test), Node.js, 정적 HTML/CSS, http-server, Vite 빌드

**관련 문서:** 설계 문서 `docs/superpowers/specs/2026-06-01-illustrated-manual-design.md`

---

## 사전 준비 (AI PM 티켓)

이 프로젝트는 모든 코드 변경에 AI PM 티켓이 필수다. 구현 시작 전:

- [ ] **티켓 발행 및 작업 시작**

```
mcp__ai-pm__create_task(
  epic_id="4d7bdd33-38c5-4c17-9cfc-c3c37b664549",   # SLS General
  title="컴맹 친화 이미지 설명서 보강 (데모데이터 시딩 + 주석 캡처 + 절차형 HTML)"
)
mcp__ai-pm__smart_workflow(task_id, 'start_work')
```

---

## File Structure

| 파일 | 책임 | 신규/수정 |
|------|------|-----------|
| `tests/e2e/helpers/seed-demo-data.js` | 캡처 전 localStorage에 가공 더미 토양 시료 주입 | 신규 |
| `tests/e2e/helpers/annotate.js` | 대상 요소 위에 번호·화살표·강조박스 오버레이 주입/제거 | 신규 |
| `tests/e2e/manual-capture.spec.js` | 섹션별 시나리오로 주석 스크린샷 캡처 | 신규 (기존 `screenshots.spec.js` 대체) |
| `tests/e2e/screenshots.spec.js` | 낡은 비-soil 경로 캡처 | 삭제 |
| `src/manual/index.html` | 절차형 설명서 + 단계/팁/주의 컴포넌트 | 수정 |
| `src/manual/images/step-*.png` | 신규 주석 스크린샷 | 생성(캡처 산출물) |
| `docs/manual/**` | GitHub Pages 배포본 | 동기화 |

---

## Task 1: 데모 데이터 시더 헬퍼

화면을 "채워진 실사용 상태"로 만들기 위해 캡처 전 localStorage에 가공 더미 데이터를 주입한다.

**Files:**
- Create: `tests/e2e/helpers/seed-demo-data.js`

- [ ] **Step 1: 실제 저장 레코드 필드 확인**

저장 시 실제로 쓰는 필드명을 확인한다. soil 저장 로직을 읽어 레코드 객체의 키(접수번호/날짜/농가명/담당자/필지 배열 등)를 메모한다.

Run: `grep -nE "collectFormData|saveData|sampleLogs|push\\(|JSON.stringify" /Users/leechanhee/sample-log-soil/src/soil/soil-script.js | head -30`
또한: `sed -n '700,770p' /Users/leechanhee/sample-log-soil/src/soil/soil-script.js` 로 parcel 객체 구조 확인

확인된 사실: 저장 키는 `soilSampleLogs_{year}`, 레코드는 `id` 보유, 필지는 `parcels` 배열(각 `{ id, crops: [], ... }`).

- [ ] **Step 2: 시더 모듈 작성**

`page.addInitScript`로 페이지 로드 전에 localStorage를 채운다. 필드명은 Step 1에서 확인한 실제 키에 맞춘다. (아래는 확인된 구조 기준 초안 — 실제 필드와 다르면 키만 교체)

```js
// tests/e2e/helpers/seed-demo-data.js
// @ts-check

const YEAR = 2026;
const STORAGE_KEY = 'soilSampleLogs';

// 명백한 가공 데이터 (실제 개인정보 금지)
const DEMO_RECORDS = [
  {
    id: 'demo-0001',
    receptionNumber: '2026-0001',
    receptionMethod: '방문',
    date: '2026-03-04',
    farmerName: '김봉화',
    managerName: '이담당',
    phone: '010-0000-0001',
    parcels: [
      { id: 'p-1', address: '경상북도 봉화군 봉화읍 내성리 100', crops: ['벼'] }
    ],
    sampleCount: 1,
    completed: true,
  },
  {
    id: 'demo-0002',
    receptionNumber: '2026-0002',
    receptionMethod: '우편',
    date: '2026-03-06',
    farmerName: '박영주',
    managerName: '이담당',
    phone: '010-0000-0002',
    parcels: [
      { id: 'p-2', address: '경상북도 봉화군 물야면 오록리 25', crops: ['사과'] },
      { id: 'p-3', address: '경상북도 봉화군 물야면 오록리 26', crops: ['고추'] }
    ],
    sampleCount: 2,
    completed: false,
  },
  {
    id: 'demo-0003',
    receptionNumber: '2026-0003',
    receptionMethod: '방문',
    date: '2026-03-11',
    farmerName: '최상주',
    managerName: '정주임',
    phone: '010-0000-0003',
    parcels: [
      { id: 'p-4', address: '경상북도 봉화군 춘양면 의양리 7', crops: ['배추'] }
    ],
    sampleCount: 1,
    completed: false,
  },
];

/**
 * 캡처 전 localStorage에 더미 토양 시료를 주입한다.
 * goto 이전에 호출해야 한다 (addInitScript는 다음 네비게이션부터 적용).
 * @param {import('@playwright/test').Page} page
 */
async function seedSoilDemoData(page) {
  await page.addInitScript(
    ({ key, year, records }) => {
      try {
        localStorage.setItem(`${key}_${year}`, JSON.stringify(records));
      } catch (e) {
        // 캡처 중단 방지: 실패해도 무시
        console.warn('seedSoilDemoData 실패:', e);
      }
    },
    { key: STORAGE_KEY, year: YEAR, records: DEMO_RECORDS }
  );
}

module.exports = { seedSoilDemoData, DEMO_RECORDS, YEAR };
```

- [ ] **Step 3: 임시 검증 테스트로 주입 확인**

`tests/e2e/manual-capture.spec.js`가 아직 없으므로 임시 검증을 한 번 돌린다. 아래를 임시 파일 `tests/e2e/_seed-check.spec.js`로 만들어 실행.

```js
// tests/e2e/_seed-check.spec.js
const { test, expect } = require('@playwright/test');
const { seedSoilDemoData } = require('./helpers/seed-demo-data');

test('seed 주입 확인', async ({ page }) => {
  await seedSoilDemoData(page);
  await page.goto('/soil/');
  await page.waitForLoadState('networkidle');
  const raw = await page.evaluate(() => localStorage.getItem('soilSampleLogs_2026'));
  expect(raw).toContain('김봉화');
});
```

Run: `cd /Users/leechanhee/sample-log-soil && npx playwright test tests/e2e/_seed-check.spec.js --project=chromium`
Expected: PASS (1 passed). 실패 시 STORAGE_KEY/연도/필드명을 Step 1 확인값으로 교정.

- [ ] **Step 4: 임시 검증 파일 삭제 후 커밋**

```bash
cd /Users/leechanhee/sample-log-soil
rm tests/e2e/_seed-check.spec.js
git add tests/e2e/helpers/seed-demo-data.js
git commit -m "feat(manual): 캡처용 데모 데이터 시더 추가"
```

---

## Task 2: 주석 오버레이 헬퍼

스크린샷에 "여기를 누르세요" 시각 표시(번호 원·화살표·강조 테두리)를 코드로 굽는다.

**Files:**
- Create: `tests/e2e/helpers/annotate.js`

- [ ] **Step 1: 오버레이 헬퍼 작성**

```js
// tests/e2e/helpers/annotate.js
// @ts-check

/**
 * 대상 요소들 위에 번호 배지/강조 테두리를 그린다.
 * @param {import('@playwright/test').Page} page
 * @param {Array<{selector:string, number:number, label?:string, box?:boolean}>} steps
 */
async function annotate(page, steps) {
  await page.evaluate((steps) => {
    const layer = document.createElement('div');
    layer.setAttribute('data-annotation-layer', 'true');
    Object.assign(layer.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none',
    });
    document.body.appendChild(layer);

    for (const s of steps) {
      const el = document.querySelector(s.selector);
      if (!el) { console.warn('annotate: selector 미발견 →', s.selector); continue; }
      const r = el.getBoundingClientRect();

      if (s.box !== false) {
        const box = document.createElement('div');
        Object.assign(box.style, {
          position: 'fixed', left: `${r.left - 4}px`, top: `${r.top - 4}px`,
          width: `${r.width + 8}px`, height: `${r.height + 8}px`,
          border: '3px solid #ef4444', borderRadius: '8px',
          boxShadow: '0 0 0 3px rgba(239,68,68,0.25)', boxSizing: 'border-box',
        });
        layer.appendChild(box);
      }

      const badge = document.createElement('div');
      badge.textContent = String(s.number);
      Object.assign(badge.style, {
        position: 'fixed', left: `${r.left - 16}px`, top: `${r.top - 16}px`,
        width: '30px', height: '30px', borderRadius: '50%',
        background: '#ef4444', color: '#fff', fontWeight: '700',
        fontFamily: 'sans-serif', fontSize: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      });
      layer.appendChild(badge);

      if (s.label) {
        const tag = document.createElement('div');
        tag.textContent = s.label;
        Object.assign(tag.style, {
          position: 'fixed', left: `${r.left}px`, top: `${r.top + r.height + 6}px`,
          background: '#1e293b', color: '#fff', padding: '4px 10px',
          borderRadius: '6px', fontFamily: 'sans-serif', fontSize: '13px',
          maxWidth: '320px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        });
        layer.appendChild(tag);
      }
    }
  }, steps);
}

/** 주석 레이어 제거 (연속 캡처용) */
async function clearAnnotations(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-annotation-layer]').forEach((n) => n.remove());
  });
}

module.exports = { annotate, clearAnnotations };
```

- [ ] **Step 2: 임시 스모크 테스트로 오버레이 확인**

```js
// tests/e2e/_annotate-check.spec.js
const { test, expect } = require('@playwright/test');
const { annotate, clearAnnotations } = require('./helpers/annotate');

test('annotate 동작 확인', async ({ page }) => {
  await page.goto('/soil/');
  await page.waitForLoadState('networkidle');
  await annotate(page, [{ selector: 'body', number: 1, label: '테스트', box: false }]);
  const count = await page.evaluate(
    () => document.querySelectorAll('[data-annotation-layer]').length);
  expect(count).toBe(1);
  await clearAnnotations(page);
  const after = await page.evaluate(
    () => document.querySelectorAll('[data-annotation-layer]').length);
  expect(after).toBe(0);
});
```

Run: `cd /Users/leechanhee/sample-log-soil && npx playwright test tests/e2e/_annotate-check.spec.js --project=chromium`
Expected: PASS (1 passed)

- [ ] **Step 3: 임시 파일 삭제 후 커밋**

```bash
cd /Users/leechanhee/sample-log-soil
rm tests/e2e/_annotate-check.spec.js
git add tests/e2e/helpers/annotate.js
git commit -m "feat(manual): 스크린샷 주석 오버레이 헬퍼 추가"
```

---

## Task 3: 캡처 spec — 1·2 섹션(시작하기·시료 접수) 파일럿

전체를 한 번에 만들지 않고 먼저 2개 섹션으로 파이프라인 전체(시딩→상호작용→주석→캡처)를 검증한다.

**Files:**
- Create: `tests/e2e/manual-capture.spec.js`

- [ ] **Step 1: 캡처 spec 골격 + 섹션 1·2 작성**

뷰포트 1280×800 고정. 출력은 소스 기준 `src/manual/images/`.

```js
// tests/e2e/manual-capture.spec.js
// @ts-check
const { test } = require('@playwright/test');
const path = require('path');
const { seedSoilDemoData } = require('./helpers/seed-demo-data');
const { annotate, clearAnnotations } = require('./helpers/annotate');

const OUT = path.join(__dirname, '../../src/manual/images');

test.use({ viewport: { width: 1280, height: 800 } });

test.describe('설명서 캡처', () => {
  test.beforeEach(async ({ page }) => {
    await seedSoilDemoData(page);
  });

  test('섹션1: 메인 화면', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(OUT, 'step-01-main.png') });
  });

  test('섹션2-a: 접수 입력 화면 + 핵심 필드 번호 안내', async ({ page }) => {
    await page.goto('/soil/');
    await page.waitForLoadState('networkidle');
    await annotate(page, [
      { selector: '#receptionNumber', number: 1, label: '접수번호' },
      { selector: '#date', number: 2, label: '접수일자' },
      { selector: '.reception-method-btn', number: 3, label: '접수방법 선택' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-02-register-fields.png') });
    await clearAnnotations(page);
  });

  test('섹션2-b: 등록 버튼 위치 안내', async ({ page }) => {
    await page.goto('/soil/');
    await page.waitForLoadState('networkidle');
    await annotate(page, [
      { selector: '#navSubmitBtn', number: 1, label: '여기를 누르면 접수 등록' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-03-submit.png') });
    await clearAnnotations(page);
  });
});
```

- [ ] **Step 2: 캡처 실행 및 산출물 확인**

Run: `cd /Users/leechanhee/sample-log-soil && npx playwright test tests/e2e/manual-capture.spec.js --project=chromium`
Expected: 3 passed

Run: `ls -la src/manual/images/step-0*.png`
Expected: `step-01-main.png`, `step-02-register-fields.png`, `step-03-submit.png` 3개 존재

- [ ] **Step 3: 캡처 이미지 육안 점검**

각 PNG를 열어 확인: (1) 더미 데이터가 화면에 보이는지(메인) (2) 번호 배지·강조박스가 대상 위에 정확히 얹혔는지 (3) selector 미발견 경고가 없는지. 어긋나면 selector 교정 후 재실행.

- [ ] **Step 4: 커밋**

```bash
cd /Users/leechanhee/sample-log-soil
git add tests/e2e/manual-capture.spec.js src/manual/images/step-01-main.png src/manual/images/step-02-register-fields.png src/manual/images/step-03-submit.png
git commit -m "feat(manual): 캡처 파이프라인 + 섹션1·2 스크린샷"
```

---

## Task 4: 캡처 spec — 나머지 섹션 + 낡은 spec 제거

파일럿이 검증되었으니 목록·필터·흙토람·데이터관리·통계·라벨·동기화·설정 시나리오를 추가한다.

**Files:**
- Modify: `tests/e2e/manual-capture.spec.js`
- Delete: `tests/e2e/screenshots.spec.js`

- [ ] **Step 1: 섹션 3~8 test 블록 추가**

각 시나리오는 독립 `test()`로 실패를 격리한다. 실제 selector는 해당 화면 HTML에서 확인 후 채운다. 확인 명령:

```
grep -nE 'id="|data-view|class="util-btn"|heuktoramBtn|exportBtn' src/soil/index.html
grep -nE 'id="|class=' src/label-print/index.html src/settings/index.html
```

추가할 블록(요지 — selector는 위 확인값으로 채움):

```js
  test('섹션3: 접수 목록', async ({ page }) => {
    await page.goto('/soil/');
    await page.waitForLoadState('networkidle');
    await page.click('[data-view="list"]');
    await page.waitForTimeout(400);
    await annotate(page, [
      { selector: '[data-view="list"]', number: 1, label: '목록 보기 탭' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-04-list.png') });
    await clearAnnotations(page);
  });

  test('섹션4: 흙토람 결과 가져오기', async ({ page }) => {
    await page.goto('/soil/');
    await page.waitForLoadState('networkidle');
    await annotate(page, [
      { selector: '#heuktoramBtn', number: 1, label: '흙토람 결과 입력/내보내기' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-05-heuktoram.png') });
    await clearAnnotations(page);
  });

  test('섹션5: 데이터 관리(엑셀/서식)', async ({ page }) => {
    await page.goto('/soil/');
    await page.waitForLoadState('networkidle');
    await annotate(page, [
      { selector: '#exportBtn', number: 1, label: '엑셀 내보내기' },
      { selector: '#downloadTemplateNavBtn', number: 2, label: '엑셀 서식 다운로드' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-06-data-mgmt.png') });
    await clearAnnotations(page);
  });

  test('섹션6: 라벨 인쇄', async ({ page }) => {
    await page.goto('/label-print/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(OUT, 'step-07-label.png') });
  });

  test('섹션8: 설정', async ({ page }) => {
    await page.goto('/settings/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(OUT, 'step-08-settings.png') });
  });
```

> 섹션7(클라우드 동기화)은 웹 캡처로 Firebase 흐름 재현이 어려우므로 기존 `screenshots/07~12` Firebase 이미지를 재사용한다(신규 캡처 없음).

- [ ] **Step 2: 낡은 비-soil 캡처 spec 삭제**

`tests/e2e/screenshots.spec.js`는 존재하지 않는 `/pesticide/`, `/water/` 등을 캡처하므로 제거한다.

```bash
cd /Users/leechanhee/sample-log-soil && rm tests/e2e/screenshots.spec.js
```

- [ ] **Step 3: 전체 캡처 실행 및 확인**

Run: `cd /Users/leechanhee/sample-log-soil && npx playwright test tests/e2e/manual-capture.spec.js --project=chromium`
Expected: 모든 test passed

Run: `ls src/manual/images/step-*.png`
Expected: step-01 ~ step-08 모두 존재

- [ ] **Step 4: 육안 점검 후 커밋**

각 신규 PNG 확인(데모 데이터 노출·주석 위치). 이상 없으면:

```bash
cd /Users/leechanhee/sample-log-soil
git add tests/e2e/manual-capture.spec.js src/manual/images/step-*.png
git rm tests/e2e/screenshots.spec.js
git commit -m "feat(manual): 섹션3~8 캡처 추가 + 낡은 비-soil spec 제거"
```

---

## Task 5: 설명서 HTML — 재사용 컴포넌트 CSS 추가

절차형 마크업에 쓸 `.step-list`, `.tip-box`, `.warning-box`, `.term-box` 스타일을 기존 `<style>`에 추가한다. 다크모드 변수와 충돌하지 않게 기존 색 토큰을 따른다.

**Files:**
- Modify: `src/manual/index.html` (`<style>` 블록 끝)

- [ ] **Step 1: 컴포넌트 CSS 추가**

기존 `<style>` 안, 닫는 `</style>` 직전에 삽입:

```css
/* === 컴맹 친화 절차형 컴포넌트 === */
.step-list { counter-reset: step; margin: 20px 0; padding: 0; list-style: none; }
.step-list > li {
  position: relative; padding: 16px 16px 16px 56px; margin-bottom: 16px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
}
.step-list > li::before {
  counter-increment: step; content: counter(step);
  position: absolute; left: 14px; top: 16px;
  width: 30px; height: 30px; border-radius: 50%;
  background: #22c55e; color: #fff; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.step-list img { width: 100%; border-radius: 10px; margin-top: 10px; border: 1px solid #e2e8f0; }
.tip-box, .warning-box, .term-box {
  padding: 14px 16px; border-radius: 12px; margin: 16px 0; font-size: 0.97rem;
}
.tip-box { background: #f0fdf4; border-left: 4px solid #22c55e; }
.warning-box { background: #fef2f2; border-left: 4px solid #ef4444; }
.term-box { background: #f0f9ff; border-left: 4px solid #3b82f6; }
.tip-box::before { content: '💡 팁  '; font-weight: 700; }
.warning-box::before { content: '⚠️ 주의  '; font-weight: 700; }
.term-box::before { content: '📖 용어  '; font-weight: 700; }
/* 다크모드 */
body.dark-mode .step-list > li { background: #1e293b; border-color: #334155; }
body.dark-mode .tip-box { background: rgba(34,197,94,0.12); }
body.dark-mode .warning-box { background: rgba(239,68,68,0.12); }
body.dark-mode .term-box { background: rgba(59,130,246,0.12); }
```

> Step 1-a: 다크모드 셀렉터 확인 — `grep -nE "dark-mode|data-theme|\\.dark" src/manual/index.html | head`. 실제 다크모드 토글 클래스가 `body.dark-mode`가 아니면 위 셀렉터를 실제값으로 교체.

- [ ] **Step 2: 브라우저 확인**

`src/manual/index.html`을 브라우저로 열어 기존 레이아웃이 깨지지 않았는지 확인(컴포넌트는 아직 미사용이라 시각 변화 없음, CSS 문법 오류만 점검).

Run: `cd /Users/leechanhee/sample-log-soil && npx http-server src -p 9999 -c-1 &` 후 `http://localhost:9999/manual/` 접속, 콘솔 오류 없음 확인. 확인 후 서버 종료.

- [ ] **Step 3: 커밋**

```bash
cd /Users/leechanhee/sample-log-soil
git add src/manual/index.html
git commit -m "feat(manual): 절차형 step/tip/warning/term 컴포넌트 CSS"
```

---

## Task 6: 설명서 HTML — 섹션 절차형 재구성

각 섹션을 "1단계→2단계→3단계" `.step-list`로 재서술하고 신규 주석 스크린샷을 삽입한다. 컴맹 어투("마우스로 ~를 클릭하세요")를 사용한다.

**Files:**
- Modify: `src/manual/index.html` (각 섹션 본문)

- [ ] **Step 1: 섹션 1·2 재구성 (파일럿)**

섹션 2(토양 시료 접수, 현재 라인 ~574)의 기능 나열식 본문을 절차형으로 교체. 기존 `<img src="images/soil-register-new.png">`를 신규 캡처로 교체하고 단계 추가:

```html
<ol class="step-list">
  <li>화면 위쪽 <b>[접수]</b> 탭이 선택되어 있는지 확인합니다.
      <img src="images/step-02-register-fields.png" alt="접수 입력 화면 - 접수번호·접수일자·접수방법">
  </li>
  <li><b>①접수번호</b>, <b>②접수일자</b>, <b>③접수방법</b>을 차례로 입력·선택합니다.</li>
  <li>농가 정보(성명·연락처)와 필지 정보를 입력합니다.</li>
  <li>오른쪽 위 <b>[접수 등록]</b> 버튼을 누르면 저장됩니다.
      <img src="images/step-03-submit.png" alt="접수 등록 버튼 위치">
  </li>
</ol>
<div class="tip-box">필지가 여러 개면 [필지 추가] 버튼으로 줄을 늘릴 수 있습니다.</div>
<div class="warning-box">접수번호는 중복되면 안 됩니다. 같은 번호가 있으면 경고가 표시됩니다.</div>
```

섹션 1(시작하기)의 메인 이미지를 `images/step-01-main.png`로 교체.

- [ ] **Step 2: 섹션 1·2 브라우저 확인**

http-server로 `manual/` 열어 단계 번호·이미지·박스가 정상 렌더되고 다크모드도 깨지지 않는지 확인.

- [ ] **Step 3: 섹션 3~8 재구성**

같은 패턴으로 나머지 섹션을 절차형으로 교체하고 각 신규 스크린샷(step-04~08) 삽입. 섹션 7(클라우드)은 기존 Firebase 이미지 유지 + `<div class="term-box">` 용어 풀이 추가. 데스크톱 전용 항목엔 텍스트로 "(데스크톱 앱 전용)" 명시.

- [ ] **Step 4: 깨진 이미지 참조 검증**

HTML이 참조하는 모든 이미지 파일이 실제로 존재하는지 확인.

Run:
```bash
cd /Users/leechanhee/sample-log-soil
grep -oE 'src="images/[^"]+"' src/manual/index.html | sed 's/src="images\///;s/"//' | while read f; do
  [ -f "src/manual/images/$f" ] && echo "OK  $f" || echo "MISSING  $f"; done
```
Expected: 모두 `OK`, `MISSING` 0건

- [ ] **Step 5: 커밋**

```bash
cd /Users/leechanhee/sample-log-soil
git add src/manual/index.html
git commit -m "feat(manual): 전 섹션 절차형 재구성 + 주석 스크린샷 삽입"
```

---

## Task 7: docs/ 동기화 및 최종 검증

설명서를 배포본(`docs/manual/`)에 반영한다.

**Files:**
- Modify: `docs/manual/index.html`, `docs/manual/images/*`

- [ ] **Step 1: 동기화 방식 확인**

Run: `cd /Users/leechanhee/sample-log-soil && cat scripts/sync-docs.js | head -40`
sync-docs가 manual을 포함하면 그것을 쓰고, 아니면 `npm run build`(Vite가 src→docs) 사용.

- [ ] **Step 2: 빌드/동기화 실행**

Run: `cd /Users/leechanhee/sample-log-soil && npm run build`
Expected: 빌드 성공, `docs/manual/index.html`과 `docs/manual/images/step-*.png` 갱신

- [ ] **Step 3: docs 기준 이미지 참조 검증**

Run:
```bash
cd /Users/leechanhee/sample-log-soil
grep -oE 'src="images/[^"]+"' docs/manual/index.html | sed 's/src="images\///;s/"//' | while read f; do
  [ -f "docs/manual/images/$f" ] && echo "OK  $f" || echo "MISSING  $f"; done
```
Expected: 모두 `OK`

- [ ] **Step 4: 배포본 브라우저 확인**

Run: `cd /Users/leechanhee/sample-log-soil && npx http-server docs -p 8888 -c-1 &` 후 `http://localhost:8888/manual/` 접속.
확인: 모든 이미지 로드, 단계/팁/주의 박스 정상, 다크모드 토글 정상, 검색 정상. 확인 후 서버 종료.

- [ ] **Step 5: 커밋**

```bash
cd /Users/leechanhee/sample-log-soil
git add docs/manual src/manual
git commit -m "chore(manual): docs/ 설명서 동기화"
```

---

## Task 8: AI PM 빌드/테스트/리뷰 마감

- [ ] **Step 1: 빌드 + 캡처 테스트 결과 제출**

```
mcp__ai-pm__smart_workflow(task_id, 'submit_test', test_results=[
  { type: 'build', output: '<npm run build 실제 출력 10자 이상>' },
  { type: 'e2e',   output: '<playwright manual-capture 통과 출력>' }
])
```

- [ ] **Step 2: 코드 리뷰**

`code-reviewer`(opus) 또는 `/code-review`로 신규 헬퍼·spec·HTML 리뷰. 결과를 형식대로 정리:
`🔴 CRITICAL: N / 🟠 MAJOR: N / 🟡 MINOR: N / 🔵 SUGGESTION: N → 판정: ...`

- [ ] **Step 3: 승인 및 done**

CRITICAL·MAJOR 0건이면:
```
mcp__ai-pm__smart_workflow(task_id, 'approve_review', notes='<20자 이상 리뷰 요약>')
```
1건+이면 `request_changes` 후 수정·재진행(최대 3회).

---

## Self-Review (작성자 점검 결과)

- **Spec 커버리지**: 설계 문서 §5.1→Task1, §5.2→Task2, §5.3→Task3·4, §5.4→Task5·6, §6 동기화→Task7, §11 AI PM→사전준비·Task8. 모든 산출물 체크리스트 항목이 태스크에 매핑됨.
- **Placeholder 점검**: 코드 단계는 실제 코드 포함. 단, soil 레코드 필드명·일부 selector·다크모드 클래스는 "실제 값 확인 후 교체"를 명시적 Step으로 두어 추측 방지(가짜 placeholder 아님).
- **타입/이름 일관성**: `seedSoilDemoData`/`annotate`/`clearAnnotations`/`OUT`/`step-NN-*.png` 명칭이 Task 전반에서 일치.
- **리스크**: 웹 캡처로 데스크톱·Firebase 미재현 → Task4 Step1·Task6 Step3에서 기존 이미지 재사용·텍스트 보완으로 처리.
