// @ts-check
// SLS-1-252: 관리자 화면 탭
//
// 🚨 이 스펙이 지키는 것 중 값비싼 것 둘:
//    ① 지연 조회 — 통계를 로그인마다 부르면 안 보는 사람도 GitHub 한도(IP당 60회/시간)를 쓴다
//    ② 기존 id 보존 — admin-script.js와 다른 스펙들이 id로 요소를 잡는다
//
// ⚠️ 로그인은 Firebase가 필요해 E2E로 못 한다. #adminSection을 직접 노출한다.
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const API = '**/api.github.com/repos/**';

/** 관리자 화면을 로그인 직후 상태로 만든다 (탭은 마크업 초기값 그대로) */
async function openAdmin(page, onApi) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const calls = { api: 0 };
    await page.route(API, (r) => {
        calls.api += 1;
        return (onApi || ((rt) => rt.fulfill({
            status: 200, contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
            body: '[]',
        })))(r);
    });
    const res = await page.goto('/feedback-admin/');
    expect(res && res.status(), 'docs/feedback-admin/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.__adminTabs, { timeout: 15000 });
    await page.evaluate(() => {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('adminSection').style.display = 'block';
    });
    return calls;
}

const selected = (page) => page.evaluate(() =>
    [...document.querySelectorAll('.board-tab')]
        .filter((b) => b.getAttribute('aria-selected') === 'true')
        .map((b) => b.dataset.tab));

const PANELS = ['panelNoticeAdmin', 'panelInquiryAdmin', 'panelStatsAdmin'];

test.describe('관리자 화면 탭 (SLS-1-252)', () => {
    test('기본 탭은 문의 — 문의 패널만 보인다', async ({ page }) => {
        await openAdmin(page);
        expect(await selected(page), '기본 탭이 문의가 아니다').toEqual(['inquiry']);
        await expect(page.locator('#panelInquiryAdmin')).toBeVisible();
        await expect(page.locator('#panelNoticeAdmin')).toBeHidden();
        await expect(page.locator('#panelStatsAdmin')).toBeHidden();
    });

    // 🚨 마크업만으로 초기 상태가 맞아야 한다 — JS가 죽어도 세 패널이 다 보이면 안 된다
    test('스크립트를 끄면 초기 상태가 마크업대로다', async ({ page }) => {
        await page.route('**/*.js', (r) => r.abort());
        await page.goto('/feedback-admin/');
        await page.waitForLoadState('domcontentloaded');
        const hidden = await page.evaluate((ids) =>
            ids.map((id) => document.getElementById(id)?.hidden), PANELS);
        expect(hidden, 'JS 없이 패널 상태가 깨진다').toEqual([true, false, true]);
    });

    test('탭을 누르면 그 패널만 보인다', async ({ page }) => {
        await openAdmin(page);
        for (const [tab, panel] of [
            ['notice', 'panelNoticeAdmin'],
            ['stats', 'panelStatsAdmin'],
            ['inquiry', 'panelInquiryAdmin'],
        ]) {
            await page.locator(`.board-tab[data-tab="${tab}"]`).click();
            expect(await selected(page), `${tab}: aria-selected가 하나가 아니거나 틀렸다`).toEqual([tab]);
            await expect(page.locator(`#${panel}`), `${tab}: 패널이 안 보인다`).toBeVisible();
            for (const other of PANELS.filter((p) => p !== panel)) {
                await expect(page.locator(`#${other}`), `${tab}: ${other}가 함께 보인다`).toBeHidden();
            }
        }
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 지연 조회 — 안 보는 화면 때문에 GitHub 한도를 쓰지 않는다
    // ══════════════════════════════════════════════════════════════
    test('현황 탭을 열기 전에는 GitHub을 부르지 않는다', async ({ page }) => {
        const calls = await openAdmin(page);
        await page.locator('.board-tab[data-tab="notice"]').click();
        await page.waitForTimeout(500);
        expect(calls.api, '현황을 안 열었는데 조회했다 — 한도를 낭비한다').toBe(0);
    });

    // 🚨 위 테스트는 **로그인 경로를 타지 않는다** (코드리뷰 MAJOR).
    //    onLogin에 loadReleaseStats()를 다시 넣어도 통과해버린다.
    //    로그인 직후 불러오는 것들을 loadAdminData()로 빼서, 그 경로를 실제로 실행한다.
    test('로그인 직후 로드는 GitHub을 부르지 않는다', async ({ page }) => {
        const calls = await openAdmin(page);
        await page.evaluate(() => window.__adminTabs.loadAdminData().catch(() => {}));
        await page.waitForTimeout(700);
        expect(calls.api, '로그인 직후 조회했다 — 현황을 안 봐도 한도를 쓴다').toBe(0);
    });

    // 🚨 로그아웃 중 요청이 떠 있으면 재로그인 후 '불러오는 중…'에 멈출 수 있었다
    test('로그아웃 직후 재로그인해도 현황이 멈추지 않는다', async ({ page }) => {
        let release;
        const gate = new Promise((r) => { release = r; });
        const calls = await openAdmin(page, async (r) => {
            await gate;   // 첫 요청을 붙잡아 둔다
            return r.fulfill({
                status: 200, contentType: 'application/json',
                headers: { 'access-control-allow-origin': '*' },
                body: JSON.stringify([{
                    tag_name: 'v1.0.0', published_at: '2026-05-01T00:00:00Z', prerelease: false,
                    assets: [{ name: 'soil-sample-log-setup.exe', download_count: 7 }],
                }]),
            });
        });

        await page.locator('.board-tab[data-tab="stats"]').click();   // 요청 시작(붙잡힘)
        await expect.poll(() => calls.api, { timeout: 5000 }).toBe(1);

        // 로그아웃 상당 — 캐시·세대·in-flight 정리
        await page.evaluate(() => window.__adminStats.clearReleaseStatsCache());
        release();                                                     // 옛 요청이 뒤늦게 끝난다
        await page.waitForTimeout(300);

        // 재로그인 후 다시 현황을 연다 — 새 요청이 나가고 화면이 채워져야 한다
        await page.evaluate(() => window.__adminStats.loadReleaseStats({ force: true }));
        await expect(page.locator('#releaseStats .fig').first(),
            "'불러오는 중…'에 멈췄다 — in-flight 슬롯이 안 비워졌다").toBeVisible({ timeout: 5000 });
    });

    test('현황 탭을 열면 그때 조회한다', async ({ page }) => {
        const calls = await openAdmin(page);
        await page.locator('.board-tab[data-tab="stats"]').click();
        await expect.poll(() => calls.api, { timeout: 5000 }).toBe(1);
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 첫 열람 가드가 실제로 있는가.
    //
    //    처음엔 window.__adminStats.loadReleaseStats를 monkey-patch해 호출 횟수를 세려 했는데
    //    **가로채지지 않았다** — activateAdminTab은 모듈 내부 함수를 직접 부른다.
    //
    //    그렇다고 네트워크 횟수만 세면 60초 캐시 때문에 가드를 지워도 1회다.
    //    그래서 **캐시를 비운 뒤** 다시 연다. 가드가 있으면 조회하지 않고,
    //    없으면 캐시가 없으니 실제로 한 번 더 나간다. 이 차이로 구분한다.
    // ══════════════════════════════════════════════════════════════
    test('현황 탭을 다시 열어도 또 조회하지 않는다', async ({ page }) => {
        const calls = await openAdmin(page);
        await page.locator('.board-tab[data-tab="stats"]').click();
        await expect.poll(() => calls.api, { timeout: 5000 }).toBe(1);

        // 캐시만 비운다 — 첫 열람 표식(_statsTabOpened)은 그대로 남는다
        await page.evaluate(() => window.__adminStats.clearReleaseStatsCache());

        await page.locator('.board-tab[data-tab="inquiry"]').click();
        await page.locator('.board-tab[data-tab="stats"]').click();
        await page.waitForTimeout(700);
        expect(calls.api, '캐시가 없는데 다시 조회했다 — 첫 열람 가드가 없다').toBe(1);
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 기존 id 보존 — 스크립트와 다른 스펙들이 이 id로 요소를 잡는다
    // ══════════════════════════════════════════════════════════════
    test('기존 id가 올바른 패널 안에 살아 있다', async ({ page }) => {
        await openAdmin(page);
        const where = await page.evaluate(() => {
            const map = {
                noticeForm: 'panelNoticeAdmin', noticeTitle: 'panelNoticeAdmin',
                noticeBody: 'panelNoticeAdmin', noticePopup: 'panelNoticeAdmin',
                noticeUntil: 'panelNoticeAdmin', noticeList: 'panelNoticeAdmin',
                noticeFormTitle: 'panelNoticeAdmin', noticeSubmitBtn: 'panelNoticeAdmin',
                inquiryList: 'panelInquiryAdmin',
                releaseStats: 'panelStatsAdmin',
            };
            const out = {};
            for (const [id, panel] of Object.entries(map)) {
                const el = document.getElementById(id);
                out[id] = !el ? '(없음)' : (el.closest(`#${panel}`) ? 'ok' : '(다른 패널)');
            }
            // 뱃지는 탭 안으로 옮겼다 — 패널이 아니라 탭 버튼 안에 있어야 한다
            const badge = document.getElementById('inquiryCount');
            out.inquiryCount = !badge ? '(없음)'
                : (badge.closest('.board-tab[data-tab="inquiry"]') ? 'ok' : '(탭 밖)');
            return out;
        });
        for (const [id, state] of Object.entries(where)) {
            expect(state, `${id}: ${state}`).toBe('ok');
        }
    });

    // 숨은 패널의 입력란이 Tab 이동 대상이 되면 안 보이는 곳으로 포커스가 간다
    test('숨은 패널의 컨트롤은 포커스 대상이 아니다', async ({ page }) => {
        await openAdmin(page);
        const focusable = await page.evaluate(() => {
            const el = document.getElementById('noticeTitle');   // 숨은 공지 패널 안
            el.focus();
            return document.activeElement === el;
        });
        expect(focusable, '숨은 패널의 입력란에 포커스가 들어갔다').toBe(false);
    });
});
