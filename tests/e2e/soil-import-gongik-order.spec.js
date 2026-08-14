// @ts-check
// SLS-1-242: 공익직불제 차수를 가져와 **저장까지** 되는가
//
// ⚠️ 유닛은 buildRecord/computePreview까지만 본다. 저장은 매니저의 addImportedRecord가
//    하는데 거기서 `src.gongikOrder || '1'`로 다시 읽으므로, 필드 이름이 어긋나면
//    미리보기에는 2차로 보이고 **저장은 1차**가 된다. 그 배선을 여기서 본다.
//
// ⚠️ 메모리 배열이 아니라 **새로고침 후 localStorage**를 읽는다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const HEADER = '성명\t연락처\t지번주소\t작물\t면적\t구분\t차수';

async function open(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.goto('/soil/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    await page.evaluate(() => localStorage.clear());
}

/**
 * @param {{gongik?: boolean}} [opts] 창의 경지구분 1차를 공익직불제로 둘지.
 *   ⚠️ 차수 오류는 **공익직불제 행에서만** 막는다(SLS-1-242 코드리뷰 MAJOR).
 *      그래서 오류 검증은 1차를 공익직불제로 골라야 재현된다.
 */
async function paste(page, rows, opts = {}) {
    await page.click('#soilImportBtn');
    const modal = page.locator('#soilImporterModal');
    await expect(modal).toBeVisible();
    await modal.locator('input[name="sriMode"][value="paste"]').check();
    if (opts.gongik) {
        await modal.locator('[data-el="bulkLandClass"]').selectOption('공익직불제');
    }
    await modal.locator('[data-el="textarea"]').fill([HEADER, ...rows].join('\n'));
    await modal.locator('[data-act="automap"]').click();
    await expect.poll(() => page.locator('.sri-pv-table tbody tr').count(), { timeout: 10000 })
        .toBeGreaterThan(0);
    return modal;
}

async function readPersisted(page) {
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    return page.evaluate(() => {
        const year = window.soilManager.selectedYear;
        const raw = localStorage.getItem(`soilSampleLogs_${year}`);
        return (raw ? JSON.parse(raw) : []).map((l) => ({
            name: l.name ?? '', gongikOrder: l.gongikOrder ?? '',
        }));
    });
}

test.describe('공익직불제 차수 가져오기 (SLS-1-242)', () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 이 스펙의 핵심 — 미리보기가 아니라 **저장된 값**이 2차인가
    // ══════════════════════════════════════════════════════════════
    test('차수 2인 행이 2차로 저장된다', async ({ page }) => {
        await open(page);
        const modal = await paste(page, [
            '홍길동\t010-1111-1111\t봉화읍 내성리 1\t벼\t100\t논\t2',
            '김철수\t010-2222-2222\t봉화읍 내성리 2\t벼\t200\t논\t1차',
        ], { gongik: true });
        await modal.locator('[data-act="import"]').click();
        await expect(modal).toBeHidden();

        const persisted = await readPersisted(page);
        const hong = persisted.find((r) => r.name === '홍길동');
        const kim = persisted.find((r) => r.name === '김철수');

        expect(hong?.gongikOrder, "차수 2가 저장되지 않았다 — 배선이 끊겼다").toBe('2');
        expect(kim?.gongikOrder, "'1차' 표기가 '1'로 저장되지 않았다").toBe('1');
    });

    // 🚨 조용히 1차로 바꾸면 공익직불제 제출 서류의 차수가 틀린 채 나간다
    test('알 수 없는 차수는 오류로 막히고 저장되지 않는다', async ({ page }) => {
        await open(page);
        const modal = await paste(page, [
            '홍길동\t010-1111-1111\t봉화읍 내성리 1\t벼\t100\t논\t3차',
        ], { gongik: true });

        const body = await modal.locator('.sri-pv-table tbody').innerText();
        expect(body, "'3차'가 오류로 표시되지 않았다").toMatch(/차수|알 수 없/);
        await expect(
            modal.locator('[data-act="import"]'),
            '오류뿐인데 가져오기가 활성화됐다'
        ).toBeDisabled();
    });

    // 🚨 코드리뷰 MAJOR — 일반 시료 파일에 우연히 '차수' 열이 있어도
    //    무관한 행의 가져오기를 막으면 안 된다.
    test('공익직불제가 아니면 알 수 없는 차수여도 막히지 않는다', async ({ page }) => {
        await open(page);
        const modal = await paste(page, [
            '홍길동\t010-1111-1111\t봉화읍 내성리 1\t벼\t100\t논\t3차',
        ]);   // gongik 지정 없음 → 기본값(농가의뢰)
        await expect(
            modal.locator('[data-act="import"]'),
            '무관한 행인데 가져오기가 막혔다'
        ).toBeEnabled();
    });

    // 🚨 차수 열이 없던 기존 사용자가 영향을 받으면 안 된다
    test('차수 열이 없으면 기존과 같이 1차로 저장된다', async ({ page }) => {
        await open(page);
        await page.click('#soilImportBtn');
        const modal = page.locator('#soilImporterModal');
        await modal.locator('input[name="sriMode"][value="paste"]').check();
        await modal.locator('[data-el="textarea"]').fill([
            '성명\t연락처\t지번주소\t작물\t면적\t구분',
            '홍길동\t010-1111-1111\t봉화읍 내성리 1\t벼\t100\t논',
        ].join('\n'));
        await modal.locator('[data-act="automap"]').click();
        await expect.poll(() => page.locator('.sri-pv-table tbody tr').count(), { timeout: 10000 })
            .toBeGreaterThan(0);
        await modal.locator('[data-act="import"]').click();
        await expect(modal).toBeHidden();

        const [rec] = await readPersisted(page);
        expect(rec?.gongikOrder, '차수 열이 없는데 기본값이 아니다').toBe('1');
    });
});
