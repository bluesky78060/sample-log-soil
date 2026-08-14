// @ts-check
// SLS-1-244: 작물 검색 모달 크기 고정
//
// 🚨 증상: 검색어를 칠 때마다 결과 수가 달라지고, 목록이 그만큼만 높이를 차지해
//    **모달이 커졌다 작아졌다** 했다. 사용자가 "눈이 어지럽다"고 보고했다.
//
// ⚠️ 이 스펙이 지키는 것은 "스크롤이 되는가"가 아니라 **높이가 변하지 않는가**다.
//    스크롤은 원래도 됐다(overflow-y: auto). 바뀐 것은 max-height → height.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

async function openCropModal(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');

    await page.click('#cropSearchBtn');
    const modal = page.locator('#cropModal');
    await expect(modal).toBeVisible();
    await expect.poll(() => page.locator('#cropList li').count(), { timeout: 10000 })
        .toBeGreaterThan(5);
    return modal;
}

/**
 * ⚠️ boundingBox()를 쓰면 안 된다. 모달에 `animation: modalIn`(scale)이 걸려 있어
 *    측정 시점의 transform이 섞인다 — 300px가 285px로 읽히고, 호출마다 1px씩 흔들린다.
 *    clientHeight는 **레이아웃 값**이라 transform과 무관하다.
 */
const heightOf = (loc) => loc.evaluate((el) => el.clientHeight);
const rectOf = (loc) => loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { h: el.clientHeight, top: Math.round(r.top) };
});

test.describe('작물 검색 모달 크기 (SLS-1-244)', () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 이 티켓의 핵심 — 결과 수가 달라져도 크기가 그대로인가
    // ══════════════════════════════════════════════════════════════
    test('검색 결과 수가 달라져도 목록 높이가 변하지 않는다', async ({ page }) => {
        await openCropModal(page);
        const wrapper = page.locator('.crop-list-wrapper');
        const input = page.locator('#cropSearchInput');

        const initial = await heightOf(wrapper);
        const initialCount = await page.locator('#cropList li').count();
        expect(initial, '목록 높이를 못 읽었다').toBeGreaterThan(0);

        // 결과가 확 줄어드는 검색 — 여기서 모달이 쪼그라들었다
        await input.fill('벼');
        await expect.poll(() => page.locator('#cropList li').count(), { timeout: 5000 })
            .toBeLessThan(initialCount);
        expect(await heightOf(wrapper), '결과가 줄자 목록이 쪼그라들었다').toBe(initial);

        // 결과가 거의 없는 검색 — 가장 심하게 줄던 경우
        await input.fill('존재하지않는작물명xyz');
        await expect.poll(() => page.locator('#cropList li').count(), { timeout: 5000 })
            .toBeLessThanOrEqual(1);
        expect(await heightOf(wrapper), '결과가 없자 목록이 사라졌다').toBe(initial);

        // 다시 넓히면 원래대로
        await input.fill('');
        await expect.poll(() => page.locator('#cropList li').count(), { timeout: 5000 })
            .toBe(initialCount);
        expect(await heightOf(wrapper)).toBe(initial);
    });

    test('모달 전체 크기도 검색에 따라 변하지 않는다', async ({ page }) => {
        const modal = await openCropModal(page);
        const content = modal.locator('.modal-content');
        const input = page.locator('#cropSearchInput');

        // 애니메이션이 끝난 뒤 재야 위치 비교가 의미 있다
        await page.waitForTimeout(400);
        const before = await rectOf(content);
        await input.fill('감');
        await expect.poll(() => page.locator('#cropList li').count(), { timeout: 5000 })
            .toBeGreaterThan(0);
        const after = await rectOf(content);

        expect(after.h, '모달 높이가 검색에 따라 변했다').toBe(before.h);
        expect(after.top, '모달이 위아래로 움직였다').toBe(before.top);
    });

    // 고정했다고 스크롤이 막히면 많은 결과를 못 본다
    test('결과가 많으면 목록 안에서 스크롤된다', async ({ page }) => {
        await openCropModal(page);
        const wrapper = page.locator('.crop-list-wrapper');

        const { scrollHeight, clientHeight } = await wrapper.evaluate((el) => ({
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
        }));
        expect(scrollHeight, '목록이 넘치지 않아 스크롤을 검증할 수 없다')
            .toBeGreaterThan(clientHeight);

        await wrapper.evaluate((el) => { el.scrollTop = 120; });
        expect(await wrapper.evaluate((el) => el.scrollTop), '스크롤이 막혔다').toBeGreaterThan(0);
    });
});
