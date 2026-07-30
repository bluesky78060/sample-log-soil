// @ts-check
// SLS-1-218: 새로워진 내용 팝업 — 실제 화면에서 동작하는가
//
// 유닛(tests/unit/whatsnew.test.js)은 jsdom에 최소 마크업을 세워 함수 단위로 본다.
// 실제 index.html의 모달·CSS(.sync-modal.show)·번들 배선이 맞물려 **눈에 보이는지**는
// 별개다. SLS-1-216에서 같은 간극을 겪었다.
//
// ⚠️ docs/ 빌드 산출물을 대상으로 돈다 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const OLD = '1.10.9';   // 팝업 대상이 되도록 충분히 낡은 버전

test.describe('새로워진 내용 팝업 (SLS-1-218)', () => {
    test('첫 방문에는 뜨지 않고 기준점만 기록한다', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForFunction(() => !!window.WHATS_NEW, { timeout: 10000 });

        await expect(page.locator('#whatsnewModal'), '첫 설치인데 팝업이 떴다').toBeHidden();
        // 바뀐 게 없으니 안 띄우지만, 다음 업데이트를 감지하려면 기준점은 있어야 한다
        expect(await page.evaluate(() => localStorage.getItem('lastSeenVersion'))).toBeTruthy();
    });

    test('낡은 버전이 기록돼 있으면 뜨고, 확인하면 다시 뜨지 않는다', async ({ page }) => {
        await page.goto('/');
        await page.evaluate((v) => {
            localStorage.clear();
            localStorage.setItem('lastSeenVersion', v);
        }, OLD);
        await page.reload();

        const modal = page.locator('#whatsnewModal');
        await expect(modal).toBeVisible();

        // 내용이 실제로 채워졌는가 — 빈 모달이 뜨는 것이 더 나쁘다
        const body = page.locator('#whatsnewBody');
        await expect(body.locator('.whatsnew-entry').first()).toBeVisible();
        await expect(body.locator('.whatsnew-items li').first()).not.toBeEmpty();

        // 태그가 문자로 노출되지 않았는가 (textContent 렌더링 확인)
        const text = await body.innerText();
        expect(text, '태그가 글자로 보인다').not.toMatch(/<\/?(strong|code)>/);

        await page.locator('#whatsnewOk').click();
        await expect(modal).toBeHidden();

        const seen = await page.evaluate(() => localStorage.getItem('lastSeenVersion'));
        expect(seen, '확인을 눌렀는데 기록이 갱신되지 않았다').not.toBe(OLD);

        await page.reload();
        await expect(modal, '기록했는데 또 떴다').toBeHidden();
    });

    test('× 버튼으로도 닫히고 기록된다', async ({ page }) => {
        await page.goto('/');
        await page.evaluate((v) => {
            localStorage.clear();
            localStorage.setItem('lastSeenVersion', v);
        }, OLD);
        await page.reload();

        const modal = page.locator('#whatsnewModal');
        await expect(modal).toBeVisible();
        await modal.locator('.whatsnew-close').click();
        await expect(modal).toBeHidden();
        expect(await page.evaluate(() => localStorage.getItem('lastSeenVersion'))).not.toBe(OLD);
    });

    test('같은 버전을 이미 봤으면 뜨지 않는다', async ({ page }) => {
        await page.goto('/');
        const current = await page.evaluate(() => window.WHATS_NEW?.generatedFor);
        expect(current, 'WHATS_NEW가 번들에 없다 — npm run build 확인').toBeTruthy();

        await page.evaluate((v) => {
            localStorage.clear();
            localStorage.setItem('lastSeenVersion', v);
        }, current);
        await page.reload();
        await expect(page.locator('#whatsnewModal')).toBeHidden();
    });
});
