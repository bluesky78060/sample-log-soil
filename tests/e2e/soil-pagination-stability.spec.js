// @ts-check
// SLS-1-276: 페이지를 넘길 때 표가 흔들리지 않는다
//
// 🚨 이 스펙이 잡는 것은 **유닛이 못 보는 것**이다.
//    · `.table-wrapper`가 실제로 스크롤되는 요소인가 — jsdom은 레이아웃이 없어
//      "scrollTop에 0을 넣었다"까지만 볼 수 있고, 그 요소가 정말 스크롤 컨테이너인지는
//      모른다. 예전 코드가 `.table-container`를 찾아 **오류도 없이 아무 일도 안 했던**
//      것이 그래서 오래 남아 있었다.
//    · 채움 행이 실제로 높이를 만드는가 — 높이는 렌더링해 봐야 안다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const PER_PAGE = 20;
const TOTAL = 45;   // 20 / 20 / 5 → 마지막 페이지가 짧다

/**
 * 이름을 모두 같게 둔다. 농가 구분선은 성명이 바뀌는 자리에만 들어가는데,
 * 그 개수가 페이지마다 달라지면 높이 비교에 ±1행 잡음이 섞인다.
 * 채움 행이 높이를 지키는지만 정확히 보려는 것이다.
 */
const makeLogs = (n, sameName = true) =>
    Array.from({ length: n }, (_, i) => ({
        id: 'id' + i,
        receptionNumber: String(501 + i),
        name: sameName ? '홍길동' : ['홍길동', '김철수', '이영희'][i % 3],
        landClass1: '농가의뢰',
        subCategory: '논',
        date: '2026-08-' + String(10 + (i % 18)).padStart(2, '0'),
        isComplete: false,
        receptionMethod: '방문수령',
        address: '경상북도 상주시 외서면 가곡리 214-3',
        addressPostcode: '37190',
        parcels: [{
            id: 'p' + i,
            lotAddress: '외서면 가곡리 214-' + i,
            subLots: [],
            crops: [{ name: '사과', area: String(900 + i * 10) }],
        }],
    }));

async function seed(page, logs) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    await page.evaluate(({ rows, per }) => {
        const year = window.soilManager.selectedYear;
        localStorage.setItem(`soilSampleLogs_${year}`, JSON.stringify(rows));
        localStorage.setItem('soilItemsPerPage', String(per));
    }, { rows: logs, per: PER_PAGE });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
        (n) => (window.soilManager?.sampleLogs || []).length === n, logs.length);
    await page.evaluate(() => window.soilManager.switchView('list'));
    await page.waitForFunction(() => window.soilManager.totalPages > 1);
}

const wrapperBox = (page) => page.evaluate(() => {
    const w = document.querySelector('.table-wrapper');
    return { height: Math.round(w.getBoundingClientRect().height), scrollTop: Math.round(w.scrollTop) };
});

test.describe('목록 페이지 넘김 안정화 (SLS-1-276)', () => {
    test('아래쪽을 보다가 다음 페이지를 눌러도 표가 맨 위로 간다', async ({ page }) => {
        await seed(page, makeLogs(TOTAL));

        // 표 안쪽을 아래로 민다 — 실제 사용자가 목록을 훑는 동작
        await page.evaluate(() => { document.querySelector('.table-wrapper').scrollTop = 300; });
        const before = await wrapperBox(page);
        expect(before.scrollTop, '표가 스크롤되지 않으면 이 시험은 의미가 없다').toBeGreaterThan(0);

        await page.evaluate(() => window.soilManager.goToPage(2));
        await page.waitForFunction(() => window.soilManager.currentPage === 2);

        const after = await wrapperBox(page);
        // 🚨 예전에는 300이 그대로 남아 새 페이지의 한가운데부터 보였다
        expect(after.scrollTop).toBe(0);
    });

    test('마지막 페이지가 짧아도 표 높이가 그대로다', async ({ page }) => {
        await seed(page, makeLogs(TOTAL));

        const first = await wrapperBox(page);

        await page.evaluate(() => window.soilManager.goToPage(3));
        await page.waitForFunction(() => window.soilManager.currentPage === 3);
        const last = await wrapperBox(page);

        // 마지막 페이지는 5건뿐이다. 채움 행이 없으면 실측 −334px였다.
        expect(Math.abs(last.height - first.height)).toBeLessThanOrEqual(2);
    });

    test('채움 행은 선택·삭제 대상에 섞이지 않는다', async ({ page }) => {
        await seed(page, makeLogs(TOTAL));
        await page.evaluate(() => window.soilManager.goToPage(3));
        await page.waitForFunction(() => window.soilManager.currentPage === 3);

        const counts = await page.evaluate(() => {
            const body = document.getElementById('logTableBody');
            const fillers = [...body.querySelectorAll('tr.page-filler')];
            return {
                fillers: fillers.length,
                dataRows: body.querySelectorAll('tr[data-id]').length,
                checkboxes: body.querySelectorAll('.row-checkbox').length,
                fillerWithCheckbox: fillers.filter((tr) => tr.querySelector('.row-checkbox')).length,
                fillerWithDataId: fillers.filter((tr) => tr.dataset.id).length,
                ariaHidden: fillers.every((tr) => tr.getAttribute('aria-hidden') === 'true'),
            };
        });

        expect(counts.fillers).toBe(PER_PAGE - (TOTAL % PER_PAGE));
        expect(counts.dataRows).toBe(TOTAL % PER_PAGE);
        expect(counts.checkboxes).toBe(TOTAL % PER_PAGE);
        expect(counts.fillerWithCheckbox).toBe(0);
        expect(counts.fillerWithDataId).toBe(0);
        expect(counts.ariaHidden).toBe(true);
    });

    test('전체 선택이 채움 행을 집어 가지 않는다', async ({ page }) => {
        await seed(page, makeLogs(TOTAL));
        await page.evaluate(() => window.soilManager.goToPage(3));
        await page.waitForFunction(() => window.soilManager.currentPage === 3);

        await page.evaluate(() => {
            const all = document.getElementById('selectAll');
            all.checked = true;
            all.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const checked = await page.evaluate(() =>
            document.querySelectorAll('#logTableBody .row-checkbox:checked').length);
        expect(checked).toBe(TOTAL % PER_PAGE);
    });

    test('채움 행의 colSpan이 농가 구분선과 같다', async ({ page }) => {
        // 이름이 섞이면 구분선이 생긴다 — 두 행의 폭 계산이 갈라지지 않는지 본다
        await seed(page, makeLogs(TOTAL, false));
        await page.evaluate(() => window.soilManager.goToPage(3));
        await page.waitForFunction(() => window.soilManager.currentPage === 3);

        const spans = await page.evaluate(() => {
            const body = document.getElementById('logTableBody');
            const filler = body.querySelector('tr.page-filler td');
            const separator = body.querySelector('tr.farm-separator td');
            const visible = [...document.querySelectorAll('#logTable thead th')]
                .filter((th) => th.offsetWidth > 0).length;
            return { filler: filler?.colSpan, separator: separator?.colSpan, visible };
        });

        expect(spans.separator, '이름을 섞었는데 구분선이 없다').toBeGreaterThan(0);
        expect(spans.filler).toBe(spans.visible);
        expect(spans.filler).toBe(spans.separator);
    });
});
