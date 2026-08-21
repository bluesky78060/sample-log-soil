// @ts-check
// SLS-1-275: 열이 **줄어드는** 전환에서 고정 열 좌표가 이전 값에 고정되던 것
//
// 사용자가 직접 신고했다 — "목록에서 공익직불제를 확인했다가 농가의뢰로 가니
// 차수 부분에 에러가 난다." 접수번호 다음에 62px 빈 칸이 생기고 `구분`이 사라졌다.
//
// 원인은 `offsetLeft`가 그 요소의 **sticky 변위를 포함**한다는 것이다.
// 직전 모드의 큰 `left`가 아직 걸려 있으면 요소가 밀린 상태이고, 그 밀린 자리를
// 다시 읽어 같은 값을 다시 쓴다 → 새로 고치기 전까지 안 풀린다.
//
// 🚨 **왕복을 봐야 한다.** 열이 늘어나는 쪽(농가의뢰→공익직불제)은 직전 값이 더
//    작아 변위가 안 생겨 멀쩡하다. SLS-1-264의 시험이 편도만 봐서 이걸 놓쳤다.
//
// 🚨 **화면 좌표만 보면 안 된다.** 기존 검증식은 `offsetLeft - base`를 규칙과
//    비교하는데, 이 결함에서는 **둘 다 같은 잘못된 값**이라 그대로 통과한다.
//    그래서 여기서는 **생성된 규칙 문자열이 처음과 같은지**를 본다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const PAGES = [
    { name: '토양', path: '/soil/', manager: 'soilManager', key: 'soilSampleLogs' },
    { name: '퇴비', path: '/compost/', manager: 'compostManager', key: 'compostSampleLogs' },
];

const rows = () => [{
    id: 'a', receptionNumber: '1', name: '홍길동', farmName: '봉화농장',
    landClass1: '농가의뢰', subCategory: '논', purpose: '일반재배', date: '2026-08-20',
    parcels: [{ id: 'p', lotAddress: '봉화읍 내성리 100번지 일원', subLots: [], crops: [] }],
}, {
    id: 'b', receptionNumber: '2', name: '김철수', farmName: '내성농장',
    landClass1: '공익직불제', subCategory: '논', purpose: '일반재배', date: '2026-08-20',
    parcels: [{ id: 'q', lotAddress: '봉화읍 내성리 101번지', subLots: [], crops: [] }],
}];

async function open(page, cfg) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto(cfg.path);
    expect(res && res.status(), `docs${cfg.path} 없음 — \`npm run build\` 먼저`).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction((m) => typeof window[m] !== 'undefined', cfg.manager);
    await page.evaluate(({ m, k, data }) => {
        localStorage.setItem(`${k}_${window[m].selectedYear}`, JSON.stringify(data));
    }, { m: cfg.manager, k: cfg.key, data: rows() });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction((m) => typeof window[m] !== 'undefined', cfg.manager);
    await page.evaluate((m) => window[m].switchView('list'), cfg.manager);
    await page.waitForFunction(() => (document.querySelector('#listView .table-wrapper')?.clientWidth || 0) > 0);
    await settle(page);
}

/** 레이아웃이 멈추고 고정 좌표 재계산이 끝날 때까지. (SLS-1-264의 대기와 같은 조건) */
async function settle(page) {
    await page.waitForFunction(() => {
        const head = document.querySelector('#listView table')?.tHead?.rows[0];
        if (!head) return false;
        const sig = [...head.cells].map((th) => `${th.offsetLeft}:${th.offsetWidth}`).join(',');
        const prev = window.__rtSig;
        window.__rtSig = sig;
        return prev === sig;
    });
    await page.waitForFunction(() => {
        const table = document.querySelector('#listView table');
        if (!table || !table.tHead) return false;
        let base = null;
        for (const th of table.tHead.rows[0].cells) {
            if (!th.classList.contains('sticky-col')) continue;
            if (th.offsetWidth === 0) continue;
            if (getComputedStyle(th).right !== 'auto') continue;
            if (base === null) base = th.offsetLeft;
            if (Math.abs((th.offsetLeft - base) - parseFloat(getComputedStyle(th).left)) > 1) return false;
        }
        return base !== null;
    });
}

/** 이 표에 대해 생성된 고정 좌표 규칙 문자열. */
const rulesOf = (page) => page.evaluate(() => {
    const table = document.querySelector('#listView table');
    return document.querySelector(`style[data-sticky-for="${table.id}"]`)?.textContent || '';
});

/** 머리글과 첫 본문 행의 computed left가 열마다 일치하는지 (codex 플랜 리뷰 지적). */
const headBodyMismatch = (page) => page.evaluate(() => {
    const table = document.querySelector('#listView table');
    const head = table.tHead.rows[0];
    const body = table.tBodies[0]?.querySelector('tr:not(.farm-separator)');
    if (!body) throw new Error('본문 행이 없다');
    const wrong = [];
    [...head.cells].forEach((th, i) => {
        if (!th.classList.contains('sticky-col') || th.offsetWidth === 0) return;
        const td = body.children[i];
        if (!td) return;
        const a = getComputedStyle(th).left;
        const b = getComputedStyle(td).left;
        if (a !== b) wrong.push(`${th.textContent.trim() || '체크박스'}: 머리글 ${a} / 본문 ${b}`);
    });
    return wrong;
});

/** 오른쪽 고정(관리) 열 상태 — 왼쪽 규칙에 섞이면 안 된다 (codex 플랜 리뷰 지적). */
const actionColumn = (page) => page.evaluate(() => {
    const table = document.querySelector('#listView table');
    const th = table.tHead.rows[0].querySelector('.col-action');
    const css = document.querySelector(`style[data-sticky-for="${table.id}"]`)?.textContent || '';
    const s = getComputedStyle(th);
    return { hasLeftRule: css.includes('.col-action{left:'), position: s.position, right: s.right };
});

/**
 * 전환을 왕복시키고 규칙이 처음으로 **정확히** 돌아오는지 본다.
 * @param {(v:boolean)=>Promise<void>} toggle 전환을 켜고 끄는 동작
 */
async function expectRoundTrip(page, toggle, label) {
    const before = await rulesOf(page);
    expect(before, `${label}: 고정 좌표 규칙이 아예 없다 — 자동 계산이 안 돌았다`).not.toBe('');

    await toggle(true);
    await settle(page);
    const during = await rulesOf(page);
    expect(during, `${label}: 전환했는데 열 구성이 그대로다 — 시험이 성립 안 됨`).not.toBe(before);

    await toggle(false);
    await settle(page);
    expect(await rulesOf(page), `${label}: 돌아온 뒤 좌표가 처음과 다르다 — 이전 값에 고정됐다`)
        .toBe(before);

    // 관측자가 스스로 다시 예약하며 값을 흔들지 않는지 (codex SUGGESTION)
    await page.waitForTimeout(400);
    expect(await rulesOf(page), `${label}: 잠시 뒤 좌표가 또 달라졌다 — 재계산이 수렴하지 않는다`)
        .toBe(before);

    expect(await headBodyMismatch(page), `${label}: 머리글과 본문의 고정 좌표가 다르다`).toEqual([]);
}

const clickFullView = (page) => page.click('#viewToggleBtn, #toggleColumnsBtn');

for (const cfg of PAGES) {
    test(`${cfg.name} 목록: 전체 보기를 켰다 끄면 좌표가 제자리로 (SLS-1-275)`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await open(page, cfg);
        await expectRoundTrip(page, () => clickFullView(page), `${cfg.name}/전체 보기`);
    });
}

test('토양 목록: 공익직불제를 봤다가 농가의뢰로 돌아와도 좌표가 제자리로 (SLS-1-275)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PAGES[0]);

    const setTab = (value) => page.evaluate((v) => {
        const el = document.getElementById('landClass1Tab');
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);

    await expectRoundTrip(
        page,
        (on) => setTab(on ? '공익직불제' : '농가의뢰'),
        '토양/공익직불제 왕복');

    // 사용자가 실제로 본 증상 — 접수번호와 다음 고정 열 사이에 틈이 없어야 한다
    const gap = await page.evaluate(() => {
        const head = document.querySelector('#listView table').tHead.rows[0];
        const cells = [...head.cells].filter((th) => th.classList.contains('sticky-col')
            && th.offsetWidth > 0 && getComputedStyle(th).right === 'auto');
        const num = cells.findIndex((th) => th.classList.contains('col-num'));
        const a = cells[num].getBoundingClientRect();
        const b = cells[num + 1].getBoundingClientRect();
        return Math.round(b.left - a.right);
    });
    expect(Math.abs(gap), '접수번호 다음에 빈 칸이 생겼다').toBeLessThanOrEqual(1);
});

// 관리 열 고정을 푸는 지점이 페이지마다 다르다 (토양 1024px · 퇴비 1200px).
// 퇴비도 같은 모듈을 쓰므로 둘 다 본다 (codex 코드 리뷰 MINOR).
const NARROW = { 토양: 900, 퇴비: 1100 };

for (const cfg of PAGES) {
test(`${cfg.name} 목록: 좁은 화면을 오가도 관리 열이 왼쪽 고정으로 섞이지 않는다 (SLS-1-275)`, async ({ page }) => {
    // codex 플랜 리뷰 MINOR: 좁은 화면에서 관리 열은 `position: static`이 된다.
    // 넓은 화면으로 돌아왔을 때 왼쪽 좌표 규칙이 남아 있으면 오른쪽 고정이 깨진다.
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, cfg);
    const wide = await actionColumn(page);
    expect(wide.position, '넓은 화면에서 관리 열이 고정이 아니다 — 시험 전제가 깨졌다').toBe('sticky');

    await page.setViewportSize({ width: NARROW[cfg.name], height: 900 });
    // 🚨 좁은 화면에서 **재계산이 일어나도록 직접 부른다.** 창 폭이 줄어도 표 폭은
    //    그대로일 수 있어 ResizeObserver가 안 불릴 수 있다 — 그러면 이 시험이
    //    결함을 놓친다(변이 검증에서 실제로 통과해 버렸다). 사용자 화면에서는
    //    목록을 다시 그리거나 표 폭이 바뀌면 어차피 이 경로를 지난다.
    await settle(page);
    await page.evaluate(() => window.applyStickyColumns(document.querySelector('#listView table')));
    const narrow = await actionColumn(page);
    expect(narrow.position, '좁은 화면에서 관리 열 고정이 풀리지 않았다 — 시험 전제가 깨졌다')
        .toBe('static');
    expect(narrow.hasLeftRule, '고정이 풀린 관리 열에 왼쪽 좌표 규칙이 생겼다').toBe(false);

    await page.setViewportSize({ width: 1440, height: 900 });
    await settle(page);

    const back = await actionColumn(page);
    expect(back.hasLeftRule, '관리 열에 왼쪽 좌표 규칙이 남았다').toBe(false);
    expect(back.position, '관리 열의 오른쪽 고정이 풀렸다').toBe('sticky');
    expect(back.right, '관리 열이 오른쪽 끝에 붙지 않는다').toBe(wide.right);
});
}
