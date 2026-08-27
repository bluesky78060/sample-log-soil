// @ts-check
// SLS-1-278: 전체 보기를 켜고 꺼도 보던 열이 화면에서 같은 자리에 남는다
//
// 🚨 유닛이 못 보는 것을 본다
//    유닛은 좌표를 손으로 심는다. 실제로 어떤 열이 얼마나 밀리는지, 가로 스크롤이
//    실제로 그만큼 움직이는지는 렌더링해 봐야 안다.
//    실측(1280×800, 60건, 가로 250px 민 상태): 경지구분·우편번호가 중간에 나타나며
//    주소부터 발송일자까지 **전부 +151px** 밀렸다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const makeSoilLogs = (n) =>
    Array.from({ length: n }, (_, i) => ({
        id: 'id' + i,
        receptionNumber: String(501 + i),
        name: '홍길동',
        landClass1: '농가의뢰',
        subCategory: '논',
        date: '2026-08-12',
        isComplete: false,
        receptionMethod: '방문수령',
        address: '경상북도 상주시 외서면 가곡리 214-3',
        addressPostcode: '37190',
        phone: '010-1234-5678',
        note: '재검',
        parcels: [{
            id: 'p' + i,
            lotAddress: '외서면 가곡리 214-' + i,
            subLots: [],
            crops: [{ name: '사과', area: '900' }],
        }],
    }));

async function seedSoil(page, logs) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    await page.evaluate((rows) => {
        const year = window.soilManager.selectedYear;
        localStorage.setItem(`soilSampleLogs_${year}`, JSON.stringify(rows));
        localStorage.setItem('soilItemsPerPage', '100');
    }, logs);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
        (n) => (window.soilManager?.sampleLogs || []).length === n, logs.length);
    await page.evaluate(() => window.soilManager.switchView('list'));
    await page.waitForFunction(() => document.querySelectorAll('#logTableBody tr[data-id]').length > 0);
}

/**
 * 지금 화면에서 기준이 될 일반 열(가로로 고정되지 않은 첫 열)의 왼쪽 좌표.
 * 이름으로 찾는다 — 열이 나타나고 사라져도 같은 열을 따라갈 수 있어야 한다.
 */
const columnLeft = (page, label) => page.evaluate((text) => {
    const th = [...document.querySelectorAll('#logTable thead th')]
        .find((el) => el.textContent.trim() === text);
    return th ? Math.round(th.getBoundingClientRect().left) : null;
}, label);

const scrollState = (page) => page.evaluate(() => {
    const w = document.querySelector('.table-wrapper');
    return { left: Math.round(w.scrollLeft), max: Math.round(w.scrollWidth - w.clientWidth) };
});

const setScroll = (page, left) => page.evaluate((v) => {
    const w = document.querySelector('.table-wrapper');
    w.scrollLeft = v;
    return Math.round(w.scrollLeft);
}, left);

const toggle = async (page) => {
    await page.evaluate(() => document.getElementById('viewToggleBtn').click());
    await page.waitForTimeout(150);
};

test.describe('전체 보기 토글에서 보던 열 유지 — 토양 (SLS-1-278)', () => {
    test.beforeEach(async ({ page }) => {
        await seedSoil(page, makeSoilLogs(60));
    });

    test('가로로 민 상태에서 켜도 보던 열이 같은 자리에 남는다', async ({ page }) => {
        const before = await scrollState(page);
        expect(before.max, '표가 가로로 넘치지 않으면 이 시험은 의미가 없다').toBeGreaterThan(200);

        await setScroll(page, 250);
        const anchorBefore = await columnLeft(page, '주소');

        await toggle(page);

        const anchorAfter = await columnLeft(page, '주소');
        // 🚨 보정이 없으면 +151px 밀린다 (실측)
        expect(Math.abs(anchorAfter - anchorBefore)).toBeLessThanOrEqual(2);
    });

    test('다시 꺼도 같은 자리에 남는다', async ({ page }) => {
        await setScroll(page, 250);
        await toggle(page);                       // 켜기

        const anchorBefore = await columnLeft(page, '주소');
        await toggle(page);                       // 끄기
        const anchorAfter = await columnLeft(page, '주소');

        expect(Math.abs(anchorAfter - anchorBefore)).toBeLessThanOrEqual(2);
    });

    test('맨 왼쪽에서는 새로 나타난 열을 가리지 않는다', async ({ page }) => {
        // 🚨 이 시험이 설계를 한 번 바로잡았다. 처음에는 "언제나 보던 자리를 지킨다"로
        //    만들었는데, 맨 왼쪽에서 켜면 스크롤이 150px 밀려 **사용자가 보려던
        //    바로 그 열(경지구분·우편번호)이 화면 밖으로 나갔다.**
        //    '전체 보기'를 켜는 목적이 숨은 열을 보는 것이므로, 되돌릴 자리가 없는
        //    쪽에서는 되돌리지 않는다.
        await setScroll(page, 0);

        await toggle(page);

        const after = await scrollState(page);
        expect(after.left).toBe(0);

        // 새로 나타난 열이 실제로 화면 안에 있어야 한다
        const revealed = await page.evaluate(() => {
            const th = [...document.querySelectorAll('#logTable thead th')]
                .find((el) => el.classList.contains('col-zipcode'));
            if (!th || getComputedStyle(th).display === 'none') return null;
            const w = document.querySelector('.table-wrapper').getBoundingClientRect();
            const r = th.getBoundingClientRect();
            return { visible: r.left < w.right && r.right > w.left };
        });
        expect(revealed, '우편번호 열이 나타나지 않았다').not.toBeNull();
        expect(revealed.visible, '새로 나타난 열이 화면 밖으로 밀렸다').toBe(true);
    });

    test('살짝만 민 상태에서도 새로 나타난 열을 가리지 않는다', async ({ page }) => {
        // 🚨 `=== 0`만 예외로 두면 1px 민 상태에서도 150px 튄다 (codex 코드 리뷰 지적).
        //    경계는 새 열이 차지한 폭이다.
        await setScroll(page, 40);

        await toggle(page);

        const after = await scrollState(page);
        expect(after.left).toBe(40);          // 그대로다

        const revealed = await page.evaluate(() => {
            const th = [...document.querySelectorAll('#logTable thead th')]
                .find((el) => el.classList.contains('col-zipcode'));
            if (!th || getComputedStyle(th).display === 'none') return null;
            const w = document.querySelector('.table-wrapper').getBoundingClientRect();
            const r = th.getBoundingClientRect();
            return r.left < w.right && r.right > w.left;
        });
        expect(revealed, '새로 나타난 열이 화면 밖으로 밀렸다').toBe(true);
    });

    test('맨 오른쪽에서도 보던 열이 같은 자리에 남는다', async ({ page }) => {
        // 🚨 여기서 브라우저 클램프가 개입한다 (codex 플랜 리뷰 제안)
        const before = await scrollState(page);
        await setScroll(page, before.max);
        const anchorBefore = await columnLeft(page, '주소');

        await toggle(page);                       // 켜면 표가 넓어져 여유가 생긴다

        const anchorAfter = await columnLeft(page, '주소');
        expect(Math.abs(anchorAfter - anchorBefore)).toBeLessThanOrEqual(2);
    });

    test('고정 열은 원래 자리를 지킨다', async ({ page }) => {
        // 왼쪽 고정 열은 스크롤과 무관하다. 보정이 그 열을 흔들면 안 된다.
        await setScroll(page, 250);
        const numBefore = await columnLeft(page, '접수번호');

        await toggle(page);

        const numAfter = await columnLeft(page, '접수번호');
        expect(Math.abs(numAfter - numBefore)).toBeLessThanOrEqual(2);
    });
});

test.describe('전체 보기 토글에서 보던 열 유지 — 퇴비 (SLS-1-278)', () => {
    test('가로로 민 상태에서 켜도 보던 열이 같은 자리에 남는다', async ({ page }) => {
        page.on('dialog', (d) => d.dismiss().catch(() => {}));
        const res = await page.goto('/compost/');
        expect(res && res.status(), 'docs/compost/ 없음 — `npm run build` 먼저').toBeLessThan(400);
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => typeof window.compostManager !== 'undefined');

        const logs = Array.from({ length: 40 }, (_, i) => ({
            id: 'c' + i,
            receptionNumber: String(101 + i),
            name: '김철수',
            farmName: '푸른농장',
            date: '2026-08-12',
            sampleType: '퇴비',
            animalType: '우분',
            addressRoad: '경상북도 상주시 외서면 가곡리 214-3',
            phoneNumber: '01012345678',
        }));
        await page.evaluate((rows) => {
            const year = window.compostManager.selectedYear;
            localStorage.setItem(`compostSampleLogs_${year}`, JSON.stringify(rows));
        }, logs);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(
            (n) => (window.compostManager?.sampleLogs || []).length === n, logs.length);
        await page.evaluate(() => window.compostManager.switchView('list'));
        await page.waitForFunction(() => document.querySelectorAll('#logTableBody tr').length > 0);

        const state = await scrollState(page);
        test.skip(state.max < 100, '이 화면 폭에서는 표가 가로로 넘치지 않는다');

        // 🚨 맨 오른쪽까지 민다. 퇴비의 숨김 열은 275px를 차지하는데(실측),
        //    그보다 덜 밀어 둔 상태에서는 **일부러 보정하지 않는다** —
        //    사용자가 아직 새 열이 나타날 구간을 보고 있다는 뜻이기 때문이다.
        await setScroll(page, state.max);
        const anchorBefore = await page.evaluate(() => {
            const th = [...document.querySelectorAll('.data-table thead th')]
                .find((el) => getComputedStyle(el).left === 'auto' && getComputedStyle(el).right === 'auto'
                    && getComputedStyle(el).display !== 'none');
            return th ? { text: th.textContent.trim(), left: Math.round(th.getBoundingClientRect().left) } : null;
        });
        expect(anchorBefore, '기준이 될 일반 열이 없다').not.toBeNull();
        test.skip(state.max < 300, '숨김 열 폭(약 275px)보다 스크롤 여유가 작아 보정 대상이 아니다');

        await page.evaluate(() => document.getElementById('toggleColumnsBtn').click());
        await page.waitForTimeout(150);

        const anchorAfter = await page.evaluate((text) => {
            const th = [...document.querySelectorAll('.data-table thead th')]
                .find((el) => el.textContent.trim() === text);
            return th ? Math.round(th.getBoundingClientRect().left) : null;
        }, anchorBefore.text);

        expect(Math.abs(anchorAfter - anchorBefore.left)).toBeLessThanOrEqual(2);
    });
});
