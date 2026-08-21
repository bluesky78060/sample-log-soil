// @ts-nocheck
const { test, expect } = require('@playwright/test');

/**
 * 퇴비 검색 모달 UI 왕복 (SLS-1-197 C / 195 MINOR-4)
 *
 * ⚠️ 기존 `compost-form.spec.js`는 `page.evaluate`로 매니저 API를 직접 조작한다.
 *    매처는 그렇게도 검증되지만 **배선은 미커버**다 — `setupSearchModal()`의 클릭
 *    리스너가 통째로 빠져도 그 테스트는 통과한다.
 *
 *    여기서는 실제 ID를 클릭해 모달 열기 → 입력 → 적용 → 행 수까지 밟는다.
 *
 * ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
 */

const SEEDS = [
    { id: 's1', receptionNumber: '1', name: '홍길동', farmName: '봉화농장', sampleType: '가축분퇴비', isComplete: false },
    { id: 's2', receptionNumber: '2', name: '김영수', farmName: '영주농장', sampleType: '가축분퇴비', isComplete: false },
    { id: 's3', receptionNumber: '3', name: '박철수', farmName: '울진농장', sampleType: '액비', isComplete: false },
];

async function openListWithSeeds(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/compost/');
    expect(res && res.status(), 'docs/compost/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.compostManager, { timeout: 15000 });

    await page.evaluate((seeds) => {
        const y = window.compostManager.selectedYear;
        localStorage.setItem(`compostSampleLogs_${y}`, JSON.stringify(seeds));
    }, SEEDS);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.compostManager, { timeout: 15000 });

    await page.locator('[data-view="list"]').click();
    await expect(page.locator('#listView')).toBeVisible();
    await expect(page.locator('#logTableBody > tr')).toHaveCount(SEEDS.length);
}

const modal = (page) => page.locator('#listSearchModal');

test.describe('퇴비 검색 모달 왕복 (SLS-1-197)', () => {
    test('모달을 열어 성명으로 검색하면 목록이 실제로 줄어든다', async ({ page }) => {
        await openListWithSeeds(page);

        await page.locator('#openSearchModalBtn').click();
        await expect(modal(page)).not.toHaveClass(/hidden/);

        await page.locator('#searchNameInput').fill('김영수');
        await page.locator('#listSearchModal #applySearchBtn').click();

        // 적용하면 모달이 닫히고 행이 줄어든다 — 둘 다 봐야 배선이 증명된다
        await expect(modal(page)).toHaveClass(/hidden/);
        await expect(page.locator('#logTableBody > tr')).toHaveCount(1);
        await expect(page.locator('#logTableBody > tr').first()).toContainText('김영수');

        // 검색 중임을 버튼 배지가 알린다
        await expect(page.locator('#openSearchModalBtn')).toHaveClass(/has-filter/);
    });

    test('검색 조건을 비우면 전체가 돌아온다', async ({ page }) => {
        await openListWithSeeds(page);

        await page.locator('#openSearchModalBtn').click();
        await page.locator('#searchNameInput').fill('박철수');
        await page.locator('#listSearchModal #applySearchBtn').click();
        await expect(page.locator('#logTableBody > tr')).toHaveCount(1);

        await page.locator('#openSearchModalBtn').click();
        await expect(modal(page)).not.toHaveClass(/hidden/);
        await page.locator('#searchNameInput').fill('');
        await page.locator('#listSearchModal #applySearchBtn').click();

        await expect(page.locator('#logTableBody > tr')).toHaveCount(SEEDS.length);
        await expect(page.locator('#openSearchModalBtn')).not.toHaveClass(/has-filter/);
    });
});
