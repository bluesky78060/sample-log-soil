// @ts-check
// SLS-1-246: 관리자 폼 입력란의 여백이 Tailwind preflight에 덮이던 문제
//
// 🚨 이 결함은 **빌드 산출물에서만 드러난다.**
//    소스에서는 tailwind <link>가 인라인 <style>보다 앞에 있어 문제가 없어 보이는데,
//    vite가 빌드하면서 CSS <link>를 </head> 근처로 옮긴다. 그러면 preflight의
//        button,input,optgroup,select,textarea { margin:0; padding:0 }
//    이 같은 구체성이면서 나중에 와서 폼 스타일을 통째로 덮는다.
//    실제 배포본에서 글자가 테두리에 붙고 입력란 간격이 사라져 있었다.
//
// ⚠️ 그래서 이 스펙은 **docs/ 산출물**을 봐야 의미가 있다 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

/** 로그인 화면 뒤에 가려진 공지 폼을 드러낸다 (스타일만 확인한다) */
async function openAdminForm(page) {
    const res = await page.goto('/feedback-admin/');
    expect(res && res.status(), 'docs/feedback-admin/ 없음 — `npm run build` 먼저')
        .toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
        const login = document.getElementById('loginSection');
        if (login) login.style.display = 'none';
        let n = document.getElementById('noticeForm');
        while (n) {
            if (n.style && n.style.display === 'none') n.style.display = '';
            n = n.parentElement;
        }
        // ⚠️ SLS-1-252에서 공지 폼이 탭 패널 안으로 들어갔다. 기본 탭이 '문의'라
        //    공지 탭을 켜지 않으면 hidden이라 #noticeTitle이 보이지 않는다.
        //    (위 while은 style.display만 손대므로 hidden 속성은 풀리지 않는다)
        window.__adminTabs?.activateAdminTab('notice');
    });
    await expect(page.locator('#noticeTitle')).toBeVisible();
}

const paddingOf = (loc) => loc.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
        left: parseFloat(cs.paddingLeft),
        top: parseFloat(cs.paddingTop),
        marginBottom: parseFloat(cs.marginBottom),
    };
});

test.describe('관리자 폼 여백 (SLS-1-246)', () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 이 티켓의 증상 — 글자가 테두리에 붙어 있었다(좌우 여백 0)
    // ══════════════════════════════════════════════════════════════
    test('공지 입력란에 좌우 여백이 살아 있다', async ({ page }) => {
        await openAdminForm(page);

        for (const id of ['#noticeTitle', '#noticeBody', '#noticeUntil']) {
            const p = await paddingOf(page.locator(id));
            expect(p.left, `${id}: 좌우 여백이 없다 — Tailwind preflight에 덮였다`)
                .toBeGreaterThanOrEqual(12);
            expect(p.top, `${id}: 상하 여백이 없다`).toBeGreaterThanOrEqual(8);
        }
    });

    // 같은 preflight 규칙이 margin도 0으로 만든다 — 입력란이 서로 붙어 버린다
    test('입력란 사이 간격이 살아 있다', async ({ page }) => {
        await openAdminForm(page);
        const p = await paddingOf(page.locator('#noticeTitle'));
        expect(p.marginBottom, '입력란 간격이 없다 — margin:0에 덮였다')
            .toBeGreaterThanOrEqual(10);
    });

    // 🚨 구체성을 올리면서 체크박스까지 width:100%가 되면 화면이 망가진다
    test('팝업 체크박스는 폭이 늘어나지 않는다', async ({ page }) => {
        await openAdminForm(page);
        const box = page.locator('#noticePopup');
        const width = await box.evaluate((el) => el.getBoundingClientRect().width);
        expect(width, '체크박스가 입력란처럼 늘어났다').toBeLessThan(40);
    });

    // 로그인 폼도 같은 규칙을 쓴다 — 한쪽만 고치면 다른 쪽이 남는다
    test('로그인 폼에도 같은 여백이 적용된다', async ({ page }) => {
        const res = await page.goto('/feedback-admin/');
        expect(res && res.status()).toBeLessThan(400);
        await page.waitForLoadState('networkidle');
        const p = await paddingOf(page.locator('#adminEmail'));
        expect(p.left, '로그인 입력란은 여백이 없다').toBeGreaterThanOrEqual(12);
    });
});
