// @ts-check
// SLS-1-219: 게시판 공지 팝업 — 실제 브라우저에서 DOM·CSS가 맞물리는가
//
// 실제 Firestore를 쓰지 않는다(외부 의존 + 관리자 계정 필요).
//
// ⚠️ addInitScript로 window.feedbackFirebase를 미리 심는 방식은 통하지 않는다.
//    feedback-firebase.js:138과 feedback-store.js 말미가 로드 시 그 전역을 **덮어쓴다.**
//    그래서 모듈이 다 로드된 뒤 스텁을 얹고 run()을 직접 부른다.
//    자동 시작 배선(void run())은 유닛 테스트가 덮고, 여기서는 **실제 DOM·CSS 렌더링**을 본다.
//
// ⚠️ "숨김"만 단언하는 케이스는 팝업이 통째로 깨져도 통과한다(공허한 통과).
//    그래서 모든 케이스에서 window.__noticePopup 존재를 먼저 확인한다.
//
// ⚠️ docs/ 빌드 산출물을 대상으로 돈다 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const NOTICE = {
    id: 'e2e-1',
    title: '흙토람 양식 변경 안내',
    body: '7월 31일부터 41열 양식으로 바뀝니다.\n기존 양식은 접수되지 않습니다.',
    createdAt: '2026-07-30T00:00:00Z',
    popup: true,
};

/** 모듈 로드 후 스텁을 얹고 run()을 부른다 */
async function runWithNotices(page, notices) {
    return page.evaluate(async (list) => {
        window.electronAPI = { ...(window.electronAPI || {}), isElectron: true };
        window.feedbackFirebase = { initialize: () => Promise.resolve(true) };
        window.createFeedbackStore = () => ({ listNotices: () => Promise.resolve(list) });
        window.whatsNewPopup = { whenClosed: () => Promise.resolve() };
        await window.__noticePopup.run();
    }, notices);
}

async function openApp(page) {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // 모듈이 실제로 로드됐는지 확인 — 이걸 안 보면 "안 뜬다" 단언이 공허해진다
    await page.waitForFunction(() => !!window.__noticePopup, { timeout: 10000 });
}

test.describe('게시판 공지 팝업 (SLS-1-219)', () => {
    test('웹 환경에서는 자동으로 뜨지 않는다', async ({ page }) => {
        await openApp(page);
        await page.waitForTimeout(800);
        await expect(page.locator('#noticeModal'), '웹인데 공지 팝업이 떴다').toBeHidden();
    });

    test('공지가 있으면 뜨고 개행이 여러 줄로 보인다', async ({ page }) => {
        await openApp(page);
        await runWithNotices(page, [NOTICE]);

        const modal = page.locator('#noticeModal');
        await expect(modal).toBeVisible();
        await expect(modal.locator('.notice-title')).toHaveText(NOTICE.title);

        // 🚨 플랜 리뷰 MAJOR 1 — pre-wrap이 없으면 긴급 공지가 한 줄로 뭉개진다
        const bodyEl = modal.locator('.notice-popup-body');
        await expect(bodyEl).toContainText('41열 양식으로 바뀝니다');
        const { h, lh, ws } = await bodyEl.evaluate((el) => ({
            h: el.getBoundingClientRect().height,
            lh: parseFloat(getComputedStyle(el).lineHeight),
            ws: getComputedStyle(el).whiteSpace,
        }));
        expect(ws, 'white-space가 pre-wrap이 아니다').toBe('pre-wrap');
        expect(h, '본문이 한 줄로 뭉개졌다').toBeGreaterThan(lh * 1.5);
    });

    test('확인하면 닫히고 다시 뜨지 않는다', async ({ page }) => {
        await openApp(page);
        await runWithNotices(page, [NOTICE]);

        const modal = page.locator('#noticeModal');
        await expect(modal).toBeVisible();
        await page.locator('#noticeOk').click();
        await expect(modal).toBeHidden();

        const seen = await page.evaluate(() => localStorage.getItem('seenNoticeIds'));
        expect(seen, '확인했는데 기록되지 않았다').toContain('e2e-1');

        // 같은 공지로 다시 실행 → 이미 본 것이므로 안 뜬다
        await runWithNotices(page, [NOTICE]);
        await expect(modal, '이미 본 공지가 또 떴다').toBeHidden();
    });

    test('팝업 지정이 없거나 만료된 공지는 뜨지 않는다', async ({ page }) => {
        await openApp(page);

        await runWithNotices(page, [{ ...NOTICE, popup: undefined }]);
        await expect(page.locator('#noticeModal'), 'popup 미지정인데 떴다').toBeHidden();

        await runWithNotices(page, [{ ...NOTICE, until: '2020-01-01' }]);
        await expect(page.locator('#noticeModal'), '만료됐는데 떴다').toBeHidden();

        // 대조군 — 정상 공지는 실제로 뜬다(위 두 단언이 공허하지 않음을 증명)
        await runWithNotices(page, [NOTICE]);
        await expect(page.locator('#noticeModal'), '정상 공지가 안 떴다 — 앞 단언이 공허하다').toBeVisible();
    });

    test('배경을 누르면 닫히고 카드 안을 누르면 유지된다', async ({ page }) => {
        await openApp(page);
        await runWithNotices(page, [NOTICE]);

        const modal = page.locator('#noticeModal');
        await expect(modal).toBeVisible();
        await modal.locator('.notice-popup-body').click();
        await expect(modal, '본문 클릭에 닫혔다 — 읽는 중에 사라진다').toBeVisible();
        await modal.click({ position: { x: 5, y: 5 } });
        await expect(modal, '배경 클릭이 무반응이다').toBeHidden();
    });
});
