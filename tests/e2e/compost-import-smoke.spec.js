// @ts-nocheck
const { test, expect } = require('@playwright/test');

/**
 * 퇴비 엑셀 가져오기 — 공용 모듈 생존 스모크 (SLS-1-224)
 *
 * soil에서 레거시 `ExcelImportManager` 경로를 제거할 때, **compost는 이 경로가 현역**이다
 * (`compost/index.html`의 가져오기 label은 `util-btn`으로 화면에 보인다 — soil처럼
 * `hidden`이 아니다).
 *
 * 그런데 그것을 지키는 테스트가 하나도 없었다 — soil의 import를 끊었을 때 compost가
 * 무사한지 증명할 수단이 없는 채로 삭제할 뻔했다(SLS-1-224 플랜 리뷰 지적 5).
 *
 * 이 스펙은 "compost에서 공용 모듈이 살아 있다"만 본다. 가져오기 동작 전체를 검증하는
 * 것은 별 범위다.
 */

test.describe('퇴비 엑셀 가져오기 공용 모듈 생존 (SLS-1-224)', () => {
    test('compost 페이지에 ExcelImportManager와 레거시 진입점이 남아 있다', async ({ page }) => {
        await page.goto('/compost/');
        await page.waitForLoadState('networkidle');

        // 공용 모듈이 번들에 실려 전역으로 노출된다 (excel-import-manager.js 맨 끝)
        expect(await page.evaluate(() => typeof window.ExcelImportManager)).toBe('function');

        // 진입점 마크업이 살아 있다
        await expect(page.locator('#excelImportInput')).toHaveCount(1);
        await expect(page.locator('#excelImportModal')).toHaveCount(1);

        // soil과 달리 label이 숨겨져 있지 않다 — compost는 이 경로가 현역이다
        await expect(page.locator('label[for="excelImportInput"]')).toBeVisible();
    });
});
