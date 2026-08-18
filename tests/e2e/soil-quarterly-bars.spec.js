// @ts-check
// SLS-1-253: 분기별 완료율 막대가 항상 꽉 차 보이던 문제
//
// 🚨 sanitizeHTML이 인라인 `style`을 지운다(ALLOWED_ATTR에 없다).
//    폭이 사라진 .completion-fill은 부모를 100% 채워, **완료율 0%인 분기도 꽉 찬 막대**가 됐다.
//    실측으로 확인했다 — 완료율 100/50/0/0 인데 네 막대 모두 135px(부모와 동일).
//
// ⚠️ 그래서 이 스펙은 반드시 **렌더된 폭**을 잰다. 라벨·숫자만 보면 결함이 그대로 통과한다.
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

/** 분기별 완료율을 100% / 50% / 0% 로 만드는 데이터 */
const seed = (page) => page.evaluate(() => {
    const m = window.soilManager;
    const y = m.selectedYear;
    const rows = [];
    let n = 1;
    for (const [mm, total, done] of [['01', 4, 4], ['04', 4, 2], ['07', 4, 0]]) {
        for (let i = 0; i < total; i++) {
            rows.push({
                id: `q${n}`, receptionNumber: String(n++), name: '홍길동', date: `${y}-${mm}-05`,
                subCategory: '논', purpose: '일반재배', landClass1: '농가의뢰',
                receptionMethod: '방문', isComplete: i < done, parcels: [],
            });
        }
    }
    localStorage.setItem(`soilSampleLogs_${y}`, JSON.stringify(rows));
});

async function openStats(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.soilManager, { timeout: 15000 });
    await seed(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => (window.soilManager?.sampleLogs || []).length === 12);
    await page.evaluate(() => window.soilManager.openStatisticsModal());
    await expect.poll(() => page.locator('.completion-fill').count(), { timeout: 10000 })
        .toBeGreaterThan(0);
}

const fills = (page) => page.evaluate(() =>
    [...document.querySelectorAll('.completion-fill')].map((f) => ({
        w: f.getBoundingClientRect().width,
        parent: f.parentElement.getBoundingClientRect().width,
        text: f.closest('.quarterly-completion')?.querySelector('.completion-text')?.textContent ?? '',
    })));

test.describe('분기별 완료율 막대 (SLS-1-253)', () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 이 결함의 증상 그 자체 — 전부 꽉 찬 막대
    // ══════════════════════════════════════════════════════════════
    test('완료율이 다르면 막대 길이도 다르다', async ({ page }) => {
        await openStats(page);
        const f = await fills(page);
        expect(f.length, '분기 막대가 없다').toBeGreaterThan(2);
        const widths = f.map((x) => Math.round(x.w));
        expect(new Set(widths).size,
            `막대가 전부 같은 길이다 (${widths.join('/')}) — 완료율을 나타내지 못한다`)
            .toBeGreaterThan(1);
    });

    test('완료율 0%면 막대가 비어 있다', async ({ page }) => {
        await openStats(page);
        const zero = (await fills(page)).find((x) => x.text.includes('완료율 0%'));
        expect(zero, '완료율 0%인 분기가 없다 — 데이터 전제가 바뀌었다').toBeTruthy();
        expect(zero.w, '0%인데 막대가 채워져 있다').toBeLessThan(2);
    });

    test('완료율 100%면 막대가 꽉 찬다', async ({ page }) => {
        await openStats(page);
        const full = (await fills(page)).find((x) => x.text.includes('완료율 100%'));
        expect(full, '완료율 100%인 분기가 없다').toBeTruthy();
        expect(full.w / full.parent, '100%인데 안 채워졌다').toBeGreaterThan(0.95);
    });

    test('완료율 50%면 절반쯤 찬다', async ({ page }) => {
        await openStats(page);
        const half = (await fills(page)).find((x) => x.text.includes('완료율 50%'));
        expect(half, '완료율 50%인 분기가 없다').toBeTruthy();
        expect(half.w / half.parent, '50%인데 절반이 아니다').toBeCloseTo(0.5, 1);
    });
});
