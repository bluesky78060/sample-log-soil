// @ts-check
// SLS-1-227: 엑셀 가져오기 우편번호 자동조회 + 실패 행 붉은색 표시
//
// ⚠️ addInitScript로 window.JusoService를 미리 심으면 **덮어써진다.**
//    soil-entry.js:17이 juso-service.js를 import하고, 그 모듈이 로드 시점에
//    window.JusoService를 할당한다(juso-service.js:120). 반드시 **로드 후**
//    page.evaluate()로 객체 자체를 교체해야 한다. (codex 계획 리뷰 CRITICAL)
//
//    window.XLSX와 달리 JusoService는 일반 객체라 객체 교체 방식이면 된다.
//    XLSX는 frozen module namespace라 속성 대입이 조용히 무시됐었다.
//
// ⚠️ 클래스만 확인하면 CSS가 빠져도 통과한다 → getComputedStyle로 **실제 색**을 본다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const ROAD_OK = '경상북도 봉화군 봉화읍 내성리 100';
const ROAD_BAD = '경상북도 봉화군 어딘가 999';

/** 붙여넣기 입력용 TSV (접수번호 / 성명 / 농가주소) */
const TSV = [
    ['접수번호', '성명', '농가주소'],
    ['501', '이제식', ROAD_OK],
    ['502', '홍길동', ROAD_BAD],
].map((r) => r.join('\t')).join('\n');

/**
 * 가져오기 모달을 열고 붙여넣기 데이터까지 넣는다.
 * JusoService 스텁은 **여기서, 로드가 끝난 뒤에** 심는다.
 */
async function openImporterWithStub(page, { total = null } = {}) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);

    await page.waitForFunction(() => !!window.SoilResultImporter && !!window.SoilAddressLookup, { timeout: 15000 });

    // ── 로드 후 교체 (addInitScript로는 불가) ─────────────────────────────
    await page.evaluate(([okRoad, forcedTotal]) => {
        window.electronAPI = Object.assign({}, window.electronAPI, { jusoSearch: () => {} });
        window.__jusoCalls = [];
        window.JusoService = {
            search: async (keyword) => {
                window.__jusoCalls.push(keyword);
                const norm = String(keyword).replace(/\s+/g, ' ').trim();
                if (norm === okRoad) {
                    const items = [{ roadAddr: okRoad, zipNo: '36628', jibunAddr: '' }];
                    return { ok: true, items, total: forcedTotal ?? items.length };
                }
                return { ok: true, items: [], total: 0 };
            },
        };
    }, [ROAD_OK, total]);

    await page.evaluate(() => window.SoilResultImporter.open());
    const modal = page.locator('.sri-overlay');
    await expect(modal).toBeVisible();

    // 붙여넣기 모드로 전환 후 데이터 입력
    // ⚠️ 라벨 클릭이 아니라 라디오를 직접 체크한다 — 배선이 change 이벤트에 걸려 있다(:1049).
    await page.locator('.sri-overlay input[name="sriMode"][value="paste"]').check();
    await page.locator('.sri-overlay textarea').fill(TSV);
    // ⚠️ 붙여넣기 모드는 자동 매핑이 저절로 돌지 않는다 — 파일 업로드 경로에서만 호출된다(:1306).
    //    실제 사용자도 이 버튼을 누른다.
    await page.locator('.sri-overlay [data-act="automap"]').click();
    await page.waitForFunction(
        () => document.querySelectorAll('.sri-pv-table tbody tr').length >= 2,
        { timeout: 10000 }
    );
    return modal;
}

/** 자동 매핑이 붙었는지 확인하고 조회를 실행한다 */
async function runLookup(page) {
    const btn = page.locator('.sri-overlay [data-act="lookupAddr"]');
    await expect(btn, '조회 버튼이 안 보인다 — 농가주소 자동 매핑이 실패했을 수 있다').toBeVisible();
    await expect(btn).toBeEnabled();
    await btn.click();
    // 조회가 끝나 버튼이 다시 살아날 때까지
    await expect(btn).toBeEnabled({ timeout: 15000 });
}

test.describe('우편번호 자동조회 (SLS-1-227)', () => {
    test('성공한 행은 우편번호가 채워지고, 실패한 행은 붉게 표시된다', async ({ page }) => {
        await openImporterWithStub(page);
        await runLookup(page);

        const rows = page.locator('.sri-pv-table tbody tr');
        const okRow = rows.filter({ hasText: '이제식' }).first();
        const badRow = rows.filter({ hasText: '홍길동' }).first();

        await expect(okRow, '조회 성공인데 우편번호가 안 채워졌다').toContainText('36628');

        // ── 붉은색: 클래스 + 실제 렌더 색 ────────────────────────────────
        const badCell = badRow.locator('td.col-road');
        await expect(badCell, '실패 행에 is-addr-fail이 안 붙었다').toHaveClass(/is-addr-fail/);

        const color = await badCell.evaluate((el) => getComputedStyle(el).color);
        expect(color, `붉은색이 아니다 (CSS 누락?): ${color}`).toMatch(/rgba?\(\s*220,\s*38,\s*38|rgba?\(\s*248,\s*113,\s*113/);

        // 성공 행은 붉지 않아야 한다 — 이게 없으면 "전부 붉게"도 통과한다
        await expect(okRow.locator('td.col-road'), '성공 행까지 붉게 칠했다').not.toHaveClass(/is-addr-fail/);

        // 사유가 마우스오버로 보인다
        await expect(badCell).toHaveAttribute('title', /결과가 없습니다/);
    });

    test('붉은 행도 가져오기가 된다 — 경고이지 차단이 아니다', async ({ page }) => {
        await openImporterWithStub(page);
        await runLookup(page);

        const importBtn = page.locator('.sri-overlay [data-act="import"]');
        await expect(importBtn, '조회 실패가 가져오기를 막았다').toBeEnabled();
        await expect(importBtn).toContainText('2건');

        const note = page.locator('.sri-overlay [data-el="footerNote"]');
        await expect(note, '그대로 가져와도 된다는 안내가 없다').toContainText('그대로 가져와도 됩니다');
    });

    test('채운 우편번호가 저장까지 도달한다', async ({ page }) => {
        await openImporterWithStub(page);
        await runLookup(page);
        await page.locator('.sri-overlay [data-act="import"]').click();

        await page.waitForFunction(() => {
            const k = `soilSampleLogs_${new Date().getFullYear()}`;
            return (JSON.parse(localStorage.getItem(k) || '[]')).length >= 2;
        }, { timeout: 15000 });

        const saved = await page.evaluate(() => {
            const k = `soilSampleLogs_${new Date().getFullYear()}`;
            return JSON.parse(localStorage.getItem(k) || '[]');
        });
        const ok = saved.find((s) => s.name === '이제식');
        // 🚨 미리보기에만 보이고 저장은 안 되는 상태를 잡는다 (_commit은 it.rec만 복사한다)
        expect(ok?.addressPostcode, '화면에는 보였는데 저장이 안 됐다').toBe('36628');
        expect(ok?.address).toBe(`(36628) ${ROAD_OK}`);

        const bad = saved.find((s) => s.name === '홍길동');
        expect(bad?.addressPostcode, '조회 실패인데 우편번호가 들어갔다').toBe('');
        expect(bad?.addressRoad, '조회 실패라도 적어 준 주소는 남아야 한다').toBe(ROAD_BAD);
    });

    // 🚨 items 1건이어도 total이 크면 확정하면 안 된다 (codex 계획 리뷰 CRITICAL)
    test('후보가 더 있으면(total>items) 채우지 않고 붉게 남긴다', async ({ page }) => {
        await openImporterWithStub(page, { total: 5 });
        await runLookup(page);

        const okRow = page.locator('.sri-pv-table tbody tr').filter({ hasText: '이제식' }).first();
        await expect(okRow.locator('td.col-road'), 'total을 무시하고 확정했다').toHaveClass(/is-addr-fail/);
        await expect(okRow, '확신 없이 우편번호를 채웠다').not.toContainText('36628');
    });

    test('같은 주소는 한 번만 조회한다', async ({ page }) => {
        await openImporterWithStub(page);
        await runLookup(page);
        const calls = await page.evaluate(() => window.__jusoCalls);
        // 서로 다른 주소 2건 → 2회. 재조회가 있으면 늘어난다.
        expect(calls.length, `중복 조회가 있었다: ${JSON.stringify(calls)}`).toBe(2);
    });
});
