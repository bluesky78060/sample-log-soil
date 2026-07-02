// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * 네비게이션 테스트
 * 메인 페이지와 각 시료 페이지 간 이동 테스트
 */
test.describe('네비게이션', () => {
    test('메인 페이지 로드', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/시료 접수 대장/);
    });

    test('토양 페이지 이동', async ({ page }) => {
        await page.goto('/soil/');
        await expect(page).toHaveTitle(/토양/);
    });
});
