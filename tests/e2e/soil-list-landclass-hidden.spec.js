// @ts-check
// SLS-1-261: 목록에서 경지구분 열 숨김 (전체 보기에서는 표시)
//
// 경지구분은 **왼쪽 고정 열**이라, 숨기면 뒤 열(성명)의 left 좌표를 같이
// 당겨 줘야 한다. 안 그러면 성명이 원래 자리에 그대로 남아 그 앞에 빈 틈이
// 생긴다 — 콘솔에 아무것도 안 찍히고, 값도 멀쩡하고, 스크롤도 되는
// **눈으로만 보이는** 고장이다.
//
// 그래서 **성명이 경지구분의 left를 물려받았는지**를 본다.
// 이것이 이 변경의 전부이자 전제다 — 경지구분이 빠진 자리를 성명이 채운다.
//
// ⚠️ 화면 좌표(getBoundingClientRect)로는 재지 않는다. 실제로 재 봤더니
//    이 표의 렌더링 좌표가 CSS의 left 값과 일치하지 않고, 게다가
//    **기본 보기와 전체 보기에서 배율이 다르다**(같은 left:365가 기본에서
//    293px, 전체 보기에서 366px로 찍힌다). 원인은 이 티켓 범위 밖이고
//    건드리지 않았다. 좌표로 두 상태를 비교하면 **틀린 결론**이 나온다.
//    그래서 계산된 CSS 값을 직접 비교한다 — 배율과 무관하다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

/** 목록이 가로로 넘치는 폭 */
const VIEWPORT = { width: 1000, height: 900 };

const row = (i, landClass1) => ({
    id: `id${i}`,
    receptionNumber: String(i + 1),
    name: `홍길동${i}`,
    landClass1,
    subCategory: '논',
    purpose: '일반',
    date: '2026-08-20',
    parcels: [{ id: `p${i}`, lotAddress: '봉화읍 내성리 100번지 일원', subLots: [], crops: [] }],
});

async function open(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    await page.evaluate((data) => {
        localStorage.setItem(`soilSampleLogs_${window.soilManager.selectedYear}`, JSON.stringify(data));
    }, [row(0, '농가의뢰'), row(1, '농가의뢰'), row(2, '공익직불제'), row(3, '공익직불제')]);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => (window.soilManager?.sampleLogs || []).length === 4);
    await page.evaluate(() => window.soilManager.switchView('list'));
    await page.waitForFunction(() => (document.querySelector('#listView .table-wrapper')?.clientWidth || 0) > 0);
}

/** 경지구분 탭 이동 — select가 화면에 안 보여 selectOption()은 막힌다 */
async function setTab(page, value) {
    await page.evaluate((v) => {
        const el = document.getElementById('landClass1Tab');
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await page.waitForFunction(() => !!document.querySelector('#listView table tbody tr'));
}

const toggleFullView = (page) => page.click('#viewToggleBtn');

/** 공익직불제 전용 규칙이 실제로 걸린 상태인지 */
const gongikOn = (page) => page.evaluate(
    () => document.querySelector('#listView table').classList.contains('gongik-on'));

const visibility = (page) => page.evaluate(() => {
    const th = document.querySelector('#listView th.col-landclass1');
    const td = document.querySelector('#listView tbody td.col-landclass1');
    if (!th || !td) throw new Error('경지구분 열 자체가 없다 — 숨김이 아니라 삭제됐다');
    return { th: getComputedStyle(th).display !== 'none', td: getComputedStyle(td).display !== 'none' };
});

/**
 * 그 열에 걸린 **계산된 `left`** 값. 숨겨진 열도 값은 그대로 남아 있어
 * 읽을 수 있다 — 그래서 "성명이 경지구분 자리를 받았는지"를 직접 비교할 수 있다.
 */
const stickyLeftOf = (page, cls) => page.evaluate((selector) => {
    const cell = document.querySelector(`#listView tbody td.${selector}`);
    if (!cell) throw new Error(`${selector} 칸이 없다`);
    const cs = getComputedStyle(cell);
    if (cs.position !== 'sticky') throw new Error(`${selector}이 고정 열이 아니다 (${cs.position})`);
    return cs.left;
}, cls);

test.describe('토양 목록 경지구분 열 숨김', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize(VIEWPORT);
        await open(page);
    });

    test('기본 화면에서는 안 보이고, 전체 보기에서는 보인다', async ({ page }) => {
        expect(await visibility(page), '기본 화면인데 경지구분이 보인다')
            .toEqual({ th: false, td: false });

        await toggleFullView(page);
        expect(await visibility(page), '전체 보기인데 경지구분이 안 보인다')
            .toEqual({ th: true, td: true });

        await toggleFullView(page);
        expect(await visibility(page), '기본 보기로 돌아왔는데 경지구분이 남아 있다')
            .toEqual({ th: false, td: false });
    });

    // left를 안 당기면 성명이 원래 자리에 남아 그 앞에 경지구분 폭만큼 빈 틈이 생긴다.
    // 일반/공익직불제는 고정 열 구성이 달라(차수 삽입·목적 숨김) 기준 좌표도 다르다.
    for (const tab of [
        { name: '농가의뢰', gongik: false },
        { name: '공익직불제', gongik: true },
    ]) {
        test(`${tab.name} 탭: 성명이 경지구분의 자리를 물려받는다`, async ({ page }) => {
            await setTab(page, tab.name);

            // 공익직불제는 좌표가 따로다(차수 삽입·목적 숨김). 이 클래스가 안 붙으면
            // 아래 단언이 **일반 규칙을 재면서 통과해** 공익직불제를 시험한 게 아니게 된다.
            expect(await gongikOn(page), tab.gongik
                ? `${tab.name} 탭인데 gongik-on이 안 붙었다 — 일반 규칙을 재고 있다`
                : `${tab.name} 탭인데 gongik-on이 붙었다`).toBe(tab.gongik);

            const landclass = await stickyLeftOf(page, 'col-landclass1');
            const name = await stickyLeftOf(page, 'col-name');
            expect(name, `${tab.name}: 경지구분을 숨겼는데 성명이 그 자리(${landclass})로 `
                + `안 오고 ${name}에 남았다 — 성명 앞에 빈 틈이 생긴다`).toBe(landclass);

            // 전체 보기에서는 경지구분이 돌아오므로 성명은 그 **뒤**여야 한다.
            // 이 단언이 없으면 둘을 늘 같게 만들어 놔도 위가 통과해 버린다.
            await toggleFullView(page);
            const landclassFull = await stickyLeftOf(page, 'col-landclass1');
            const nameFull = await stickyLeftOf(page, 'col-name');
            expect(landclassFull, `${tab.name}: 전체 보기인데 경지구분 자리가 바뀌었다`).toBe(landclass);
            expect(parseFloat(nameFull), `${tab.name}: 전체 보기인데 성명이 경지구분(${landclassFull})을 `
                + `덮는 자리(${nameFull})에 있다`).toBeGreaterThan(parseFloat(landclassFull));
        });
    }
});
