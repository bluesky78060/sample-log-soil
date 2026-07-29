// @ts-check
// SLS-1-216: 동기화 버튼이 클라우드 미설정 상태에서 실제로 보이지 않는가
//
// 유닛 테스트(tests/unit/sync-ui-visibility.test.js)는 소스 문자열만 본다 —
// index.html에 style="display: none"이 있고 main-init.js가 cloud 분기에서 노출한다는
// 것까지다. 그 둘이 **실제 브라우저에서 합쳐져 의도대로 동작하는지**는 증명하지 않는다.
//
// 여기서는 빌드된 docs/를 실제로 띄워 getComputedStyle로 확인한다.
// ⚠️ docs/ 빌드 산출물을 대상으로 돈다 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

test.describe('동기화 버튼 노출 (SLS-1-216)', () => {
    test('클라우드 미설정 상태에서 버튼이 보이지 않는다', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        const btn = page.locator('#syncBtn');
        // 요소는 DOM에 남아 있어야 한다 — 제거가 아니라 숨김이다.
        // (main-init.js:83이 모듈 스코프에서 참조하고 :306이 리스너를 건다)
        await expect(btn).toHaveCount(1);
        await expect(btn, '클라우드 미설정인데 동기화 버튼이 보인다').toBeHidden();

        // storageManager 초기화가 끝난 뒤에도 여전히 숨김이어야 한다.
        // 노출은 mode === 'cloud'일 때만이며, 인증 정보가 없으면 그 분기에 못 간다.
        await page.waitForFunction(() => !!window.storageManager, { timeout: 5000 });
        await page.waitForTimeout(1000);
        await expect(btn, '초기화 후 버튼이 나타났다 — 노출 조건이 무너졌다').toBeHidden();
    });

    test('버튼이 열던 동기화 모달도 닫혀 있다', async ({ page }) => {
        await page.goto('/');
        // syncModal은 syncBtn 클릭으로만 열린다. 버튼이 숨겨지면 도달 불가다.
        await expect(page.locator('#syncModal')).toBeHidden();
    });
});
