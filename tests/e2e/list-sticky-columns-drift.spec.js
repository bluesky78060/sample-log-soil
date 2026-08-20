// @ts-check
// SLS-1-264: 고정 열이 가로 스크롤 시 따라 밀리던 것
//
// 사용자가 직접 신고했다 — "접수번호, 접수일자, 구분, 성명이 조금씩 밀린다."
// 실측: 토양 최대 45px(성명), 퇴비 최대 71px(농장명·대표자).
//
// 원인은 CSS의 `left`가 손으로 계산한 추정치라 실제 폭과 달랐던 것이다.
// 열이 제 자리보다 오른쪽에서 시작하고, 밀다가 지정 좌표에 닿으면 멈춘다.
//
// ⚠️ **기존 CSS 좌표를 폴백으로 남겨 두었다.** 그래서 "밀림이 없다"만 보면
//    나중에 누가 CSS 값을 손으로 맞춰 놓는 순간 자동 계산이 꺼져도 통과한다
//    (codex 플랜 리뷰 지적). **생성된 규칙이 실제로 존재하는지**도 함께 본다.
//
// ⚠️ 화면 전환 효과가 끝난 뒤에 재야 한다. SLS-1-263 이전에는 0.3초 동안
//    모든 요소가 0.844배로 찍혀 측정이 통째로 어긋났다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const PAGES = [
    { name: '토양', path: '/soil/', manager: 'soilManager', key: 'soilSampleLogs' },
    { name: '퇴비', path: '/compost/', manager: 'compostManager', key: 'compostSampleLogs' },
];

const rows = () => [{
    id: 'a', receptionNumber: '1', name: '홍길동', farmName: '봉화농장',
    landClass1: '농가의뢰', subCategory: '논', purpose: '일반', date: '2026-08-20',
    parcels: [{ id: 'p', lotAddress: '봉화읍 내성리 100번지 일원', subLots: [], crops: [] }],
}, {
    id: 'b', receptionNumber: '2', name: '김철수', farmName: '내성농장',
    landClass1: '공익직불제', subCategory: '논', purpose: '일반', date: '2026-08-20',
    parcels: [{ id: 'q', lotAddress: '봉화읍 내성리 101번지', subLots: [], crops: [] }],
}];

async function open(page, cfg) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto(cfg.path);
    expect(res && res.status(), `docs${cfg.path} 없음 — \`npm run build\` 먼저`).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction((m) => typeof window[m] !== 'undefined', cfg.manager);
    await page.evaluate(({ m, k, data }) => {
        localStorage.setItem(`${k}_${window[m].selectedYear}`, JSON.stringify(data));
    }, { m: cfg.manager, k: cfg.key, data: rows() });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction((m) => typeof window[m] !== 'undefined', cfg.manager);
    await page.evaluate((m) => window[m].switchView('list'), cfg.manager);
    await page.waitForFunction(() => (document.querySelector('#listView .table-wrapper')?.clientWidth || 0) > 0);
    // 화면 전환 효과(0.3s)가 끝나고 좌표가 반영될 때까지
    await waitForStableLayout(page);
    await waitForStickyApplied(page);
}

/**
 * 가로로 끝까지 민 뒤, 왼쪽 고정 열들이 표 영역 기준으로 얼마나 움직였는지.
 * 화면 좌표가 아니라 **표 영역 기준**이다 — 토양 페이지는 목록을 밀면 표 영역
 * 자체가 화면에서 이동한다(SLS-1-262에서 확인).
 */
const driftOfFrozenColumns = (page) => page.evaluate(async () => {
    const wrap = document.querySelector('#listView .table-wrapper');
    const tr = document.querySelector('#listView tbody tr');
    if (!wrap || !tr) throw new Error('목록이 없다');
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const cells = [...tr.children].filter((c) => {
        const s = getComputedStyle(c);
        // 왼쪽 고정만 — 오른쪽 고정(관리)은 누적과 무관하다
        return s.position === 'sticky' && s.left !== 'auto' && s.right === 'auto'
            && c.getBoundingClientRect().width > 0;
    });
    if (cells.length < 3) throw new Error(`왼쪽 고정 열이 ${cells.length}개뿐 — 측정이 성립 안 됨`);

    const heads = [...document.querySelectorAll('#listView thead th')];
    const label = (c) => (heads[[...tr.children].indexOf(c)]?.textContent || '').trim() || '체크박스';
    const rel = () => cells.map((c) => c.getBoundingClientRect().left - wrap.getBoundingClientRect().left);

    const max = wrap.scrollWidth - wrap.clientWidth;
    if (max < 120) throw new Error(`가로로 ${max}px밖에 안 넘쳐 측정이 성립 안 됨`);

    wrap.scrollLeft = 0; await frame();
    const before = rel();
    wrap.scrollLeft = max; await frame();
    const after = rel();

    return cells.map((c, i) => ({ label: label(c), drift: Math.round(after[i] - before[i]) }));
});

/**
 * 레이아웃이 멈출 때까지 기다린다.
 *
 * ⚠️ 탭 전환·전체 보기 토글 직후에는 열 폭이 아직 재배분 중이다. 그 상태에서
 *    재면 **없는 겹침이 있다고 나온다** — 실제로 그렇게 잘못 실패했다(전체 보기
 *    -44px 겹침으로 보고됐으나, 충분히 기다린 뒤 재면 겹침이 없다).
 *    고정 좌표가 맞았는지(waitForStickyApplied)와는 별개 조건이라 둘 다 본다.
 */
const waitForStableLayout = (page) => page.waitForFunction(() => {
    const head = document.querySelector('#listView table')?.tHead?.rows[0];
    if (!head) return false;
    const sig = [...head.cells].map((th) => `${th.offsetLeft}:${th.offsetWidth}`).join(',');
    const prev = window.__layoutSig;
    window.__layoutSig = sig;
    return prev === sig;
});

/**
 * 고정 좌표 재계산이 끝날 때까지 기다린다.
 *
 * ⚠️ 임의의 시간을 기다리지 않는다. 재계산은 rAF로 예약되므로 탭을 바꾸거나
 *    전체 보기를 켠 **직후에 재면 이전 좌표가 잡힌다.** 실제로 그래서
 *    공익직불제 탭 시험이 "틈이 남았다"고 잘못 실패했다 — 화면은 멀쩡했다.
 *    모든 고정 열의 left가 실제 자리와 일치할 때까지 기다린다.
 */
const waitForStickyApplied = (page) => page.waitForFunction(() => {
    const table = document.querySelector('#listView table');
    if (!table || !table.tHead) return false;
    let base = null;
    for (const th of table.tHead.rows[0].cells) {
        if (!th.classList.contains('sticky-col')) continue;
        if (th.offsetWidth === 0) continue;
        if (getComputedStyle(th).right !== 'auto') continue;
        if (base === null) base = th.offsetLeft;
        if (Math.abs((th.offsetLeft - base) - parseFloat(getComputedStyle(th).left)) > 1) return false;
    }
    return base !== null;
});

function expectNoDrift(list, where) {
    const bad = list.filter((c) => Math.abs(c.drift) > 1)
    expect(bad.map((c) => `${c.label} ${c.drift}px`), `${where}: 고정 열이 밀렸다`).toEqual([]);
}

for (const cfg of PAGES) {
    test.describe(`${cfg.name} 목록 고정 열 밀림 (SLS-1-264)`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: 1440, height: 900 });
            await open(page, cfg);
        });

        test('가로로 끝까지 밀어도 고정 열이 제자리에 있다', async ({ page }) => {
            expectNoDrift(await driftOfFrozenColumns(page), `${cfg.name}/기본`);
        });

        // 폴백 CSS가 살아 있으므로, 밀림만 보면 자동 계산이 꺼져도 통과할 수 있다.
        // 규칙이 실제로 만들어졌는지, 그리고 그 값이 잰 위치와 같은지 확인한다.
        test('좌표를 화면에서 재서 규칙으로 넣었다', async ({ page }) => {
            // codex 코드 리뷰 지적: "어떤 style이 비어 있지 않다"만 보면
            // **다른 표의 규칙만 있어도** 통과한다. 이 표의 것인지, 그리고
            // 왼쪽 고정 열 **전부**에 규칙이 있는지 확인한다.
            const { css, missing } = await page.evaluate(() => {
                const table = document.querySelector('#listView table');
                const el = document.querySelector(`style[data-sticky-for="${table.id}"]`);
                const text = el ? el.textContent : '';
                const want = [...table.tHead.rows[0].cells]
                    .filter((th) => th.classList.contains('sticky-col')
                        && th.offsetWidth > 0
                        && getComputedStyle(th).right === 'auto')
                    .map((th) => [...th.classList].find((c) => c.startsWith('col-')));
                return { css: text, missing: want.filter((c) => !text.includes(`.${c}{left:`)) };
            });
            expect(css, '이 표의 고정 좌표 규칙이 없다 — 자동 계산이 안 돌았다').not.toBe('');
            expect(missing, '규칙이 빠진 고정 열이 있다 — 그 열은 기존 CSS 폴백으로 우연히 맞은 것일 수 있다')
                .toEqual([]);

            const mismatch = await page.evaluate(() => {
                const table = document.querySelector('#listView table');
                const head = table.tHead.rows[0];
                let base = null;
                const wrong = [];
                for (const th of head.cells) {
                    if (!th.classList.contains('sticky-col')) continue;
                    if (th.offsetWidth === 0) continue;
                    if (getComputedStyle(th).right !== 'auto') continue;
                    if (base === null) base = th.offsetLeft;
                    const want = th.offsetLeft - base;
                    const got = parseInt(getComputedStyle(th).left, 10);
                    if (Math.abs(want - got) > 1) {
                        wrong.push(`${th.textContent.trim() || '체크박스'}: 규칙 ${got}px / 실제 자리 ${want}px`);
                    }
                }
                return wrong;
            });
            expect(mismatch, '규칙의 좌표가 실제 열 위치와 다르다').toEqual([]);
        });

        test('전체 보기로 열이 늘어도 밀리지 않는다', async ({ page }) => {
            await page.click('#viewToggleBtn, #toggleColumnsBtn');
            await waitForStableLayout(page);
            await waitForStickyApplied(page);
            expectNoDrift(await driftOfFrozenColumns(page), `${cfg.name}/전체 보기`);
        });
    });
}

test('토양 공익직불제 탭에서도 밀리지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PAGES[0]);
    await page.evaluate(() => {
        const el = document.getElementById('landClass1Tab');
        el.value = '공익직불제';
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(
        () => document.querySelector('#listView table')?.classList.contains('gongik-on'));
    await waitForStableLayout(page);
    await waitForStickyApplied(page);
    expectNoDrift(await driftOfFrozenColumns(page), '토양/공익직불제');
});
