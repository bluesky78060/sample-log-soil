// @ts-nocheck
const { test, expect } = require('@playwright/test');

/**
 * 토양 검색 배지 3종 (SLS-1-197 A-3)
 *
 * ⚠️ 이 스펙은 **리팩터 때문에 생겼다.** soil의 `updateSearchButtonState`는 base와
 *    본문이 같은 사본이었고, 거기에 배지 처리 두 개(`purposeFilter`·`landClass1Tab`)가
 *    덧붙어 있었다. base 훅(`getFilterKeys`)으로 정리하면서 확인해 보니
 *    **이 동작을 지키는 테스트가 하나도 없었다** — 필터 키를 빼도, 배지를 지워도
 *    445건이 전부 통과했다. 잘못 정리해도 아무도 몰랐을 것이다.
 *
 * 배지 3종
 *   #openSearchModalBtn  검색 조건이 하나라도 있으면 `has-filter` + "🔍 검색 중"
 *   #purposeFilter       용도 필터가 걸리면 `has-filter`
 *   #landClass1Tab       경지구분 1차가 걸리면 `has-filter`
 *
 * ⚠️ `landClass1`은 **검색 버튼 배지 계산에 들어가면 안 된다.** 기본값이 '농가의뢰'라
 *    항상 참이 되어 검색 버튼이 늘 "검색 중"으로 보인다. 필터가 아니라 탭이다.
 *
 * ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
 */

async function openSoil(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.soilManager, { timeout: 15000 });
}

/** 필터를 세팅하고 배지 갱신을 부른다 (배지 계산 자체가 검증 대상이다) */
const applyFilter = (page, patch) =>
    page.evaluate((p) => {
        Object.assign(window.soilManager.currentSearchFilter, p);
        window.soilManager.updateSearchButtonState();
    }, patch);

const searchBtn = (page) => page.locator('#openSearchModalBtn');

test.describe('토양 검색 배지 (SLS-1-197)', () => {
    test.beforeEach(async ({ page }) => {
        await openSoil(page);
    });

    test('기본 상태에서는 검색 버튼에 배지가 없다', async ({ page }) => {
        // landClass1 기본값('농가의뢰')이 배지 계산에 섞이면 여기서 걸린다
        await applyFilter(page, {});
        await expect(searchBtn(page)).not.toHaveClass(/has-filter/);
        await expect(searchBtn(page)).toContainText('검색');
        await expect(searchBtn(page)).not.toContainText('검색 중');
    });

    test('base 공통 필터(성명)로 검색 배지가 켜진다', async ({ page }) => {
        await applyFilter(page, { name: '홍길동' });
        await expect(searchBtn(page)).toHaveClass(/has-filter/);
        await expect(searchBtn(page)).toContainText('검색 중');
    });

    test('soil 고유 필터(용도·지번)도 검색 배지를 켠다', async ({ page }) => {
        // getFilterKeys()가 base 목록에 lot·purpose를 더하지 않으면 여기서 죽는다
        await applyFilter(page, { purpose: '유기' });
        await expect(searchBtn(page)).toHaveClass(/has-filter/);

        await applyFilter(page, { purpose: '', lot: '100-1' });
        await expect(searchBtn(page)).toHaveClass(/has-filter/);
    });

    test('용도 필터 배지가 따로 켜지고 꺼진다', async ({ page }) => {
        await applyFilter(page, { purpose: '유기' });
        await expect(page.locator('#purposeFilter')).toHaveClass(/has-filter/);

        await applyFilter(page, { purpose: '' });
        await expect(page.locator('#purposeFilter')).not.toHaveClass(/has-filter/);
    });

    test('화면에서 용도 필터를 고르면 배지가 실제로 켜진다 (UI 배선)', async ({ page }) => {
        // ⚠️ 위 테스트들은 currentSearchFilter를 직접 세팅한다 — 배지 **계산**은 덮지만
        //    select의 change 배선이 끊긴 회귀는 못 잡는다. 이 한 건은 화면에서 조작한다.
        await page.locator('[data-view="list"]').click();
        await expect(page.locator('#listView')).toBeVisible();

        await page.locator('#purposeFilter').selectOption('유기');
        await expect(page.locator('#purposeFilter')).toHaveClass(/has-filter/);
        await expect(searchBtn(page)).toHaveClass(/has-filter/);

        await page.locator('#purposeFilter').selectOption('');
        await expect(page.locator('#purposeFilter')).not.toHaveClass(/has-filter/);
        await expect(searchBtn(page)).not.toHaveClass(/has-filter/);
    });

    test('경지구분 1차 배지가 따로 켜지고 꺼진다', async ({ page }) => {
        await applyFilter(page, { landClass1: '농가의뢰' });
        await expect(page.locator('#landClass1Tab')).toHaveClass(/has-filter/);
        // 그런데 검색 버튼은 켜지면 안 된다 (탭이지 필터가 아니다)
        await expect(searchBtn(page)).not.toHaveClass(/has-filter/);

        await applyFilter(page, { landClass1: '' });
        await expect(page.locator('#landClass1Tab')).not.toHaveClass(/has-filter/);
    });
});
