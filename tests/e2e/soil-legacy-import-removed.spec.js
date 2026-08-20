// @ts-nocheck
const { test, expect } = require('@playwright/test');

/**
 * 토양 레거시 ExcelImportManager 경로 제거 검증 (SLS-1-224)
 *
 * ⚠️ 이 스펙은 **"안 보인다"가 아니라 "없다"**를 본다.
 *
 * 제거 전 구 모달은 `hidden`이라 화면에 나오지 않았다. 그래서 "화면에 없다"류 단언은
 * 제거 전후 **모두 통과**해 아무것도 감시하지 못한다(SLS-1-224 플랜 리뷰 지적 3).
 * DOM count와 전역 부재로 판정한다.
 *
 * 순수 삭제 티켓이라 통상적인 변이 검증이 성립하지 않는다. 대신 이 스펙을 **삭제 전에
 * 돌려 FAIL을 확인**했다 — 삭제 전 FAIL / 삭제 후 PASS면 이 테스트는 제거를 실제로
 * 감시한다.
 *
 * compost 쪽 생존은 `compost-import-smoke.spec.js`가 본다. 둘이 짝이다.
 */

test.describe('토양 레거시 가져오기 경로 제거 (SLS-1-224)', () => {
    test('레거시 DOM과 전역이 soil에 남아 있지 않다', async ({ page }) => {
        await page.goto('/soil/');
        await page.waitForLoadState('networkidle');

        // 마크업 제거 — hidden이 아니라 아예 없어야 한다
        await expect(page.locator('#excelImportModal')).toHaveCount(0);
        await expect(page.locator('#excelImportInput')).toHaveCount(0);

        // soil 번들에 공용 모듈이 실려 있지 않다.
        // ⚠️ 번들 크기 감소만으로는 부족하다 — 트리셰이킹·압축으로 크기는 다른
        //    이유로도 변한다. 런타임 전역 부재가 직접 증거다.
        expect(await page.evaluate(() => typeof window.ExcelImportManager)).toBe('undefined');
    });

    test('대체 경로(새 importer)는 그대로 동작한다', async ({ page }) => {
        await page.goto('/soil/');
        await page.waitForLoadState('networkidle');

        // 실제 가져오기 버튼은 SoilResultImporter가 바인딩한다
        const btn = page.locator('#soilImportBtn');
        await expect(btn).toBeVisible();
        await btn.click();

        // 새 importer는 자체 모달을 동적 생성한다 (sri- 접두)
        await expect(page.locator('#sriTitle')).toBeVisible();
    });
});
