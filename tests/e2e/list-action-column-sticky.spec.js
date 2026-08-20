// @ts-check
// SLS-1-260: 목록의 관리(수정·삭제) 열을 오른쪽 가장자리에 고정
//
// 이 스펙이 지키려는 것은 **고정이 실제로 붙어 있는가**다.
// `position: sticky`가 선언돼 있는지 확인하는 것만으로는 부족하다 —
// 배경이 투명하면 밑을 지나는 내용이 비쳐 보이고, `<td>`에 클래스가 안 붙으면
// 머리글만 고정되고 본문은 흘러간다. 실제로 토양은 tdAction에 className이
// 아예 없어서, 본문 칸을 겨냥한 CSS가 머리글에만 걸리는 상태였다.
//
// 그래서 **가로로 밀어 놓고 좌표를 잰다.** 고정돼 있으면 관리 열의 오른쪽
// 모서리는 제자리에 남고, 가운데 열은 밀린 만큼 왼쪽으로 간다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

/** 페이지별 고정 해제 기준 — 왼쪽 고정폭이 달라 기준도 다르다 */
const PAGES = [
    { name: '토양', path: '/soil/', manager: 'soilManager', key: 'soilSampleLogs', release: 1024 },
    { name: '퇴비', path: '/compost/', manager: 'compostManager', key: 'compostSampleLogs', release: 1200 },
];

const rows = (n) => Array.from({ length: n }, (_, i) => ({
    id: `id${i}`,
    receptionNumber: String(i + 1),
    name: `홍길동${i}`,
    farmName: `농장${i}`,
    landClass1: '농가의뢰',
    subCategory: '논',
    date: '2026-08-20',
    parcels: [{ id: `p${i}`, lotAddress: '봉화읍 내성리 100', subLots: [], crops: [] }],
}));

async function seed(page, cfg) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto(cfg.path);
    expect(res && res.status(), `docs${cfg.path} 없음 — \`npm run build\` 먼저`).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction((m) => typeof window[m] !== 'undefined', cfg.manager);
    await page.evaluate(({ m, k, data }) => {
        localStorage.setItem(`${k}_${window[m].selectedYear}`, JSON.stringify(data));
    }, { m: cfg.manager, k: cfg.key, data: rows(4) });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction((m) => (window[m]?.sampleLogs || []).length === 4, cfg.manager);

    // 목록 뷰로 전환한다. 기본은 접수 폼이라 #listView가 숨겨져 있고,
    // 숨겨진 요소는 폭이 0이라 좌표를 재는 이 시험이 통째로 무의미해진다.
    await page.evaluate((m) => window[m].switchView('list'), cfg.manager);
    await page.waitForFunction(() => {
        const w = document.querySelector('#listView .table-wrapper');
        return !!w && w.clientWidth > 0 && !!w.querySelector('tbody tr');
    });
}

/** 관리 열의 머리글/본문 칸을 열 위치(마지막 열)로 찾는다 */
const actionCells = (page) => page.evaluate(() => {
    const heads = [...document.querySelectorAll('#listView table thead th')];
    const idx = heads.findIndex((t) => t.textContent.trim() === '관리');
    if (idx < 0) throw new Error('관리 열 머리글을 못 찾음');
    const tr = document.querySelector('#listView table tbody tr');
    if (!tr) throw new Error('목록에 행이 없음');
    const td = tr.children[idx];
    if (!td) throw new Error(`본문 ${idx}번 칸이 없음`);
    const cs = getComputedStyle(td);
    return {
        idx,
        thPosition: getComputedStyle(heads[idx]).position,
        // 머리글은 `position: sticky`만으로는 아무것도 증명하지 못한다 —
        // thead의 모든 th가 세로 고정 때문에 이미 sticky다. 실제로 달라지는 건
        // **생김새**다: 고정 머리글은 흰 배경 + z-index 12, 보통 머리글은
        // 회색(#eef1f4) + 10. 관리만 회색이면 고정 블록에서 혼자 튄다.
        thLook: (() => {
            const c = getComputedStyle(heads[idx]);
            return { z: c.zIndex, bg: c.backgroundColor };
        })(),
        // 대조군 머리글: 왼쪽에 고정된 것(left가 잡혀 있고 right는 auto)
        frozenHeadLook: (() => {
            const isFrozen = (h) => {
                const c = getComputedStyle(h);
                return h !== heads[idx] && c.position === 'sticky'
                    && c.left !== 'auto' && c.right === 'auto';
            };
            // 이름 있는 열을 먼저 고른다 — 실패 메시지에 "고정 블록()"처럼
            // 빈 괄호가 찍히면(체크박스 열) 무엇과 비교했는지 알 수 없다.
            const ref = heads.find((h) => isFrozen(h) && h.textContent.trim())
                || heads.find(isFrozen);
            if (!ref) throw new Error('왼쪽 고정 머리글을 못 찾음 — 대조군 없음');
            const c = getComputedStyle(ref);
            return { z: c.zIndex, bg: c.backgroundColor, label: ref.textContent.trim() };
        })(),
        tdPosition: cs.position,
        tdBackground: cs.backgroundColor,
        tdRight: td.getBoundingClientRect().right,
        // 대조군: **고정되지 않고 화면에 보이는** 첫 칸.
        // - 자리 번호로 고르면 안 된다: 토양은 가운데쯤이 하필 왼쪽 고정 열(성명)이라
        //   밀리지 않아, 고정이 멀쩡한데도 "스크롤이 안 먹었다"고 잘못 실패한다.
        // - 폭 0인 칸도 걸러야 한다: 공익직불제 열(gongik-col)과 퇴비 col-hidden은
        //   display:none이라 좌표가 늘 0이고, 그러면 밀려도 0 그대로다.
        freeLeft: (() => {
            const free = [...tr.children].find((c) => c !== td
                && getComputedStyle(c).position !== 'sticky'
                && c.getBoundingClientRect().width > 0);
            if (!free) throw new Error('고정 안 된 보이는 칸이 없음 — 대조군을 못 세움');
            return free.getBoundingClientRect().left;
        })(),
    };
});

const scrollRight = (page, px) => page.evaluate((n) => {
    const w = document.querySelector('#listView .table-wrapper');
    if (!w) throw new Error('#listView .table-wrapper가 없음');
    if (w.scrollWidth <= w.clientWidth + 50) {
        throw new Error(`표가 가로로 넘치지 않아 시험 자체가 성립하지 않음 `
            + `(scrollWidth ${w.scrollWidth} / clientWidth ${w.clientWidth})`);
    }
    w.scrollLeft = n;
    return w.scrollLeft;
}, px);

for (const cfg of PAGES) {
    test.describe(`${cfg.name} 목록 관리 열 고정`, () => {
        test('넓은 화면: 가로로 밀어도 관리 열은 제자리에 남는다', async ({ page }) => {
            await page.setViewportSize({ width: 1400, height: 900 });
            await seed(page, cfg);

            const before = await actionCells(page);
            expect(before.tdPosition, '본문 칸이 고정돼 있지 않다').toBe('sticky');
            expect(before.thPosition, '머리글이 고정돼 있지 않다').toBe('sticky');

            // 관리 머리글이 다른 고정 머리글과 같은 생김새여야 한다
            expect(before.thLook, `관리 머리글이 고정 블록(${before.frozenHeadLook.label})과 다르게 보인다`)
                .toEqual({ z: before.frozenHeadLook.z, bg: before.frozenHeadLook.bg });

            // 배경이 투명하면 밑을 지나는 내용이 비쳐 보인다
            expect(before.tdBackground, '관리 칸 배경이 투명하다').not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

            const moved = await scrollRight(page, 400);
            expect(moved, '가로 스크롤이 실제로 일어나지 않음').toBeGreaterThan(100);

            const after = await actionCells(page);

            // 대조군: 가운데 열은 밀린 만큼 왼쪽으로 가야 한다.
            // 이게 없으면 "스크롤이 안 먹어서" 관리 열이 안 움직인 것도 통과한다.
            expect(after.freeLeft, '고정 안 된 열이 안 밀렸다 — 스크롤이 안 먹은 것')
                .toBeLessThan(before.freeLeft - 100);

            expect(Math.abs(after.tdRight - before.tdRight), '관리 열이 같이 밀려났다')
                .toBeLessThan(2);
        });

        // 고정된 칸은 배경을 반드시 칠해야 밑을 지나는 내용이 안 비친다.
        // 다크모드에서 흰 배경이 남으면 그 한 칸만 눈에 확 튄다.
        test('다크모드: 관리 칸 배경이 다른 고정 칸과 같다', async ({ page }) => {
            await page.setViewportSize({ width: 1400, height: 900 });
            await seed(page, cfg);
            await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

            const bg = await page.evaluate(() => {
                const heads = [...document.querySelectorAll('#listView table thead th')];
                const idx = heads.findIndex((t) => t.textContent.trim() === '관리');
                const cells = [...document.querySelector('#listView table tbody tr').children];
                const ref = cells.find((c, i) => i !== idx
                    && getComputedStyle(c).position === 'sticky'
                    && c.getBoundingClientRect().width > 0);
                if (!ref) throw new Error('비교할 왼쪽 고정 칸이 없음');
                return {
                    action: getComputedStyle(cells[idx]).backgroundColor,
                    frozen: getComputedStyle(ref).backgroundColor,
                };
            });
            expect(bg.action, '다크모드인데 관리 칸만 다른 배경').toBe(bg.frozen);
            expect(bg.action, '다크모드인데 관리 칸이 흰색').not.toBe('rgb(255, 255, 255)');
        });

        test(`좁은 화면(${cfg.release}px 이하): 고정이 풀린다`, async ({ page }) => {
            await page.setViewportSize({ width: cfg.release - 100, height: 900 });
            await seed(page, cfg);

            const cells = await actionCells(page);
            expect(cells.tdPosition, '좁은 화면인데 고정이 남아 있다').toBe('static');
        });
    });
}
