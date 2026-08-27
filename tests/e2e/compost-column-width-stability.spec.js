// @ts-check
// SLS-1-282: 퇴비 목록도 전체 보기에서 열 폭이 흔들리지 않는다
//
// 🚨 **퇴비 화면에서 직접 재야 한다** (codex 플랜 리뷰 지적).
//    기존 `list-column-width-stability.spec.js`는 토양의 `col-lot-address`만 본다.
//    "좁은 화면에서는 예전과 같다", "농장주소만 변한다"는 퇴비 표에서 재지 않으면
//    확정할 수 없다.
//
// 🚨 이 결함은 **아주 넓은 화면에서만** 나온다. 퇴비 표는 원래 넓어(2066px)
//    **2150px 이상**에서만 남는 폭이 생긴다. 토양은 1700px부터였다.
//    좁은 화면만 보는 시험은 이 축을 영원히 못 잡는다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

/** 남는 폭을 받는 열 */
const ABSORBER = '농장주소';
/**
 * 흡수 열이 아닌 주소 열. 250px에 머문다.
 *
 * ⚠️ 그 250px는 `max-width`가 **보장하는 상한이 아니다** — 표 셀의 `max-width`는
 *    열 폭 상한으로 작동하지 않는다(codex 코드 리뷰 지적). 농장주소가 남는 폭을
 *    **먼저 가져가기 때문에** 결과적으로 250px에 머무는 것이다. 흡수 열이 하나임을
 *    이 열로 확인한다.
 */
const FIXED = '주소';

const makeCompostLogs = (n) =>
    Array.from({ length: n }, (_, i) => ({
        id: 'c' + i,
        receptionNumber: String(101 + i),
        name: '김철수',
        farmName: '푸른농장',
        date: '2026-08-12',
        sampleType: '퇴비',
        animalType: '우분',
        addressRoad: '경상북도 상주시 외서면 가곡리 214-3',
        farmAddress: '경상북도 상주시 외서면 가곡리 214-3',
        phoneNumber: '01012345678',
        note: i % 3 === 0 ? '재검 요청' : '',
    }));

async function seedCompost(page, logs) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/compost/');
    expect(res && res.status(), 'docs/compost/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.compostManager !== 'undefined');
    await page.evaluate((rows) => {
        const year = window.compostManager.selectedYear;
        localStorage.setItem(`compostSampleLogs_${year}`, JSON.stringify(rows));
    }, logs);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
        (n) => (window.compostManager?.sampleLogs || []).length === n, logs.length);
    await page.evaluate(() => window.compostManager.switchView('list'));
    await page.waitForFunction(() => document.querySelectorAll('#logTableBody tr').length > 0);
}

/** 지금 보이는 머리글 칸들의 폭 */
const columnWidths = (page) => page.evaluate(() =>
    [...document.querySelectorAll('.data-table thead th')]
        .filter((th) => getComputedStyle(th).display !== 'none')
        .map((th) => ({
            name: th.textContent.trim() || '(선택)',
            width: Math.round(th.getBoundingClientRect().width),
        })));

const widthOf = (cols, name) => cols.find((c) => c.name === name)?.width;

/** 전체 보기를 토글하고 **표의 class가 실제로 바뀔 때까지** 기다린다 */
const toggleFullView = async (page) => {
    const was = await page.evaluate(() =>
        document.querySelector('.data-table').classList.contains('full-view'));
    await page.evaluate(() => document.getElementById('toggleColumnsBtn').click());
    // 시간이 아니라 상태를 기다린다 (codex 코드 리뷰 제안)
    await page.waitForFunction(
        (prev) => document.querySelector('.data-table').classList.contains('full-view') !== prev,
        was);
};

/** 전후를 견줘 폭이 바뀐 열만 추린다. 새로 나타난 열은 셈에서 뺀다. */
function changedColumns(before, after) {
    return after
        .map((a) => {
            const b = before.find((x) => x.name === a.name);
            return b && b.width !== a.width ? { name: a.name, delta: a.width - b.width } : null;
        })
        .filter(Boolean);
}

const tableOverflows = (page) => page.evaluate(() => {
    const w = document.querySelector('.table-wrapper');
    return document.querySelector('.data-table').offsetWidth > w.clientWidth;
});

test.describe('퇴비 목록 열 폭 안정 — 아주 넓은 화면 (SLS-1-282)', () => {
    test.use({ viewport: { width: 2200, height: 900 } });

    test('흡수 열 하나만 변하고 나머지는 그대로다', async ({ page }) => {
        await seedCompost(page, makeCompostLogs(40));
        expect(await tableOverflows(page), '이 폭에서는 표가 화면에 들어와야 한다').toBe(false);

        const before = await columnWidths(page);
        await toggleFullView(page);
        const after = await columnWidths(page);

        // 🚨 고치기 전에는 16개였다 (최대 −21px)
        expect(changedColumns(before, after).map((c) => c.name)).toEqual([ABSORBER]);
    });

    test('주소는 어느 폭에서도 250px에 머문다', async ({ page }) => {
        // 흡수 열이 하나임을 이 열로 확인한다. 남는 폭을 농장주소가 먼저 가져가므로
        // 주소는 자기 `width`인 250px에 머문다 (`max-width`가 막아 주는 것이 아니다).
        await seedCompost(page, makeCompostLogs(40));

        const before = await columnWidths(page);
        expect(widthOf(before, FIXED)).toBe(250);

        await toggleFullView(page);
        const after = await columnWidths(page);
        expect(widthOf(after, FIXED)).toBe(250);
    });

    test('농장주소가 남는 폭을 받아 250px보다 넓어진다', async ({ page }) => {
        await seedCompost(page, makeCompostLogs(40));
        const cols = await columnWidths(page);
        expect(widthOf(cols, ABSORBER)).toBeGreaterThan(250);
    });
});

test.describe('퇴비 목록 열 폭 — 표가 넘치는 화면에서는 예전 그대로 (SLS-1-282)', () => {
    test.use({ viewport: { width: 1800, height: 900 } });

    test('농장주소가 250px를 지킨다', async ({ page }) => {
        // 🚨 `min-width: 250px`를 남긴 이유다. 받을 남는 폭이 없으면 예전과 같아야 한다 —
        //    "표를 밀지 않는다"는 원래 설계 의도(고정 너비 두 줄 표시)가 지켜진다.
        await seedCompost(page, makeCompostLogs(40));
        expect(await tableOverflows(page), '이 폭에서는 표가 넘쳐야 한다').toBe(true);

        const cols = await columnWidths(page);
        expect(widthOf(cols, ABSORBER)).toBe(250);
        expect(widthOf(cols, FIXED)).toBe(250);
    });

    test('전체 보기를 켜도 아무 열도 바뀌지 않는다', async ({ page }) => {
        // 남는 폭이 없으니 분배할 것도 없다 — 고치기 전에도 0개였다
        await seedCompost(page, makeCompostLogs(40));

        const before = await columnWidths(page);
        await toggleFullView(page);
        const after = await columnWidths(page);

        expect(changedColumns(before, after)).toEqual([]);
    });
});

test.describe('퇴비 농장주소의 두 줄 표시 (SLS-1-282)', () => {
    test.use({ viewport: { width: 2200, height: 900 } });

    test('넓어져도 접힘 설정이 살아 있다', async ({ page }) => {
        // codex 플랜 리뷰 제안 — `max-width`만 걷어냈으므로 `td` 쪽 규칙은 그대로여야 한다
        await seedCompost(page, makeCompostLogs(40));

        const style = await page.evaluate(() => {
            const td = document.querySelector('#logTableBody td.col-farm-address');
            if (!td) return null;
            const cs = getComputedStyle(td);
            return { whiteSpace: cs.whiteSpace, wordBreak: cs.wordBreak };
        });

        expect(style, '농장주소 칸을 찾지 못했다').not.toBeNull();
        expect(style.whiteSpace).toBe('normal');
        expect(style.wordBreak).toBe('keep-all');
    });

    test('전체 보기를 왕복해도 고정 열이 제자리다', async ({ page }) => {
        // codex 재현 시나리오 — 흡수 열이 넓어지면 sticky 좌표 계산이 흔들릴 수 있다
        await seedCompost(page, makeCompostLogs(40));

        const stickyLeft = () => page.evaluate(() => {
            const th = document.querySelector('.data-table thead .col-name');
            return th ? Math.round(th.getBoundingClientRect().left) : null;
        });

        const before = await stickyLeft();
        await toggleFullView(page);
        await toggleFullView(page);
        // 고정 열 좌표는 rAF로 다시 잰다 — 한 프레임 지나가길 기다린다
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const after = await stickyLeft();

        expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
    });
});
