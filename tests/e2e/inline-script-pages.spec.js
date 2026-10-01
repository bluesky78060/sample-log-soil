// @ts-check
// SLS-1-295: 설치본 CSP 에 막히던 두 페이지(릴리스 노트 · Firebase 설정 안내)의 버튼이 동작하는가
//
// ⚠️ 이 spec 은 E2E 의 http-server(CSP 헤더 없음)를 그대로 쓰지 않는다. 설치본은 메인 프로세스가
//    file:// 응답에 `script-src 'self' file:` 를 붙여 인라인 <script>·on*= 를 막는데, 웹판과 E2E 는
//    그 헤더가 없어 같은 결함이 보이지 않았다. 그래서 응답에 같은 헤더를 주입한다 — 그러면
//    인라인 코드가 남아 있는 한 이 spec 은 실패한다(수정 전 기준선).
//    Electron 자체는 아니다. 최종 증명은 패키징 앱 클릭(docs-internal/ai-pm/SLS-1-295/smoke/).
// ⚠️ docs/ 빌드 산출물을 대상으로 돈다 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const INSTALLED_CSP = "script-src 'self' file:";

/** @param {import('@playwright/test').Page} page */
async function installCsp(page) {
    await page.addInitScript(() => {
        // @ts-ignore — 문서 시작 전에 붙여 로드 중 위반도 잡는다
        window.__csp = [];
        document.addEventListener('securitypolicyviolation', (e) => {
            // @ts-ignore
            window.__csp.push(e.violatedDirective);
        });
    });
    await page.route('**/*', async (route) => {
        try {
            const response = await route.fetch();
            await route.fulfill({
                response,
                headers: { ...response.headers(), 'content-security-policy': INSTALLED_CSP },
            });
        } catch {
            // 테스트가 끝나 컨텍스트가 닫히는 중에 진행 중이던 요청이 던진다. 요청을 끊어 두면 페이지가
            // 살아 있는 동안의 실패는 로드가 깨져 단언이 잡는다
            await route.abort().catch(() => {});
        }
    });
}

/** @param {import('@playwright/test').Page} page */
const cspViolations = (page) => page.evaluate(() => /** @type {any} */ (window).__csp || []);

test.describe('Firebase 설정 안내 페이지 (SLS-1-295)', () => {
    test.beforeEach(async ({ page, context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await installCsp(page);
        await page.goto('/manual/firebase-setup.html');
        await page.waitForLoadState('load');
    });

    test('탭을 누르면 해당 탭 내용만 보인다', async ({ page }) => {
        await expect(page.locator('#tab-electron')).toHaveClass(/active/);
        await page.locator('.tab', { hasText: '웹 버전 사용자' }).click();
        await expect(page.locator('#tab-web')).toHaveClass(/active/);
        await expect(page.locator('#tab-electron')).not.toHaveClass(/active/);
        await expect(page.locator('.tab', { hasText: '웹 버전 사용자' })).toHaveClass(/active/);
        await expect(page.locator('.tab', { hasText: 'Electron 앱 사용자' })).not.toHaveClass(/active/);
        expect(await cspViolations(page)).toEqual([]);
    });

    test('FAQ 질문을 누르면 열리고 다시 누르면 닫힌다', async ({ page }) => {
        const item = page.locator('.faq-item').first();
        await expect(item).not.toHaveClass(/open/);
        await item.locator('.faq-question').click();
        await expect(item).toHaveClass(/open/);
        await item.locator('.faq-question').click();
        await expect(item).not.toHaveClass(/open/);
        expect(await cspViolations(page)).toEqual([]);
    });

    test('체크리스트를 모두 누르면 완료 메시지가 뜬다', async ({ page }) => {
        const items = page.locator('#section-checklist .checklist').first().locator('li');
        const total = await items.count();
        expect(total).toBeGreaterThan(1);
        const done = page.locator('#checklist-complete');
        await expect(done).toBeHidden();
        for (let i = 0; i < total; i++) await items.nth(i).click();
        await expect(items.first()).toHaveClass(/checked/);
        await expect(done).toBeVisible();
        await items.first().click();                       // 하나 풀면 다시 숨는다
        await expect(done).toBeHidden();
        expect(await cspViolations(page)).toEqual([]);
    });

    test('복사 버튼은 「복사됨!」으로 바뀌었다 돌아오고 클립보드에 내용이 들어간다', async ({ page }) => {
        const buttons = page.locator('.copy-btn');
        expect(await buttons.count()).toBe(3);

        await buttons.nth(0).scrollIntoViewIfNeeded();
        await buttons.nth(0).click();
        await expect(buttons.nth(0)).toHaveText('복사됨!');
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://console.firebase.google.com');

        await buttons.nth(1).scrollIntoViewIfNeeded();
        await buttons.nth(1).click();
        await expect(buttons.nth(1)).toHaveText('복사됨!');
        expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('"apiKey"');

        await buttons.nth(2).scrollIntoViewIfNeeded();
        await buttons.nth(2).click();
        await expect(buttons.nth(2)).toHaveText('복사됨!');
        expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('rules_version');

        await expect(buttons.nth(0)).toHaveText('복사', { timeout: 4000 });
        expect(await cspViolations(page)).toEqual([]);
    });
});

test.describe('릴리스 노트 페이지 (SLS-1-295)', () => {
    test.beforeEach(async ({ page }) => {
        await installCsp(page);
        await page.goto('/release/index.html');
        await page.evaluate(() => localStorage.removeItem('theme-preference'));
        await page.reload();
        await page.waitForLoadState('load');
    });

    test('다크 모드 토글이 동작하고 새로고침해도 유지된다', async ({ page }) => {
        const html = page.locator('html');
        const btn = page.locator('#themeToggleBtn');
        await expect(html).toHaveAttribute('data-theme', 'light');
        await btn.click();
        await expect(html).toHaveAttribute('data-theme', 'dark');
        await expect(btn).toHaveClass(/dark/);
        expect(await page.evaluate(() => localStorage.getItem('theme-preference'))).toBe('dark');

        await page.reload();
        await expect(html).toHaveAttribute('data-theme', 'dark');
        await expect(page.locator('#themeToggleBtn')).toHaveClass(/dark/);

        await page.locator('#themeToggleBtn').click();
        await expect(html).toHaveAttribute('data-theme', 'light');
        expect(await cspViolations(page)).toEqual([]);
    });
});
