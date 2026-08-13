// @ts-check
// SLS-1-230: 헤더 행을 바꾸면 자동 매핑도 다시 잡힌다
//
// 🚨 _autoMap()은 파일 로드 때 **한 번만** 돌고, 그때 헤더 행은 항상 1이다.
//    시트나 헤더 행을 바꿔도 다시 돌지 않으면 열 인덱스는 그대로인데 그 열의
//    **의미가 달라져** 매핑이 엉뚱한 열을 가리킨다.
//    화면에는 매핑된 것처럼 보이므로 조용하다 — 헤더가 몇 행인지 지정해야 하는
//    서식(제목·안내문이 위에 있는 실제 업무 서식)에서 특히 위험하다.
//
// ⚠️ 유닛으로는 못 잡는다. computeAutoMapping은 순수 함수라 항상 옳게 동작하고,
//    끊긴 것은 **그 함수를 다시 부르는 배선**이다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

/**
 * 실제 업무 서식과 같은 모양: 1행 제목, 2행 안내, 3행 헤더, 4행부터 데이터.
 * 붙여넣기 모드는 항상 1행을 헤더로 보므로 파일 모드에서만 재현된다 →
 * 여기서는 헤더 행 지정이 있는 파일 경로를 흉내 내기 위해 XLSX로 만들어 넣는다.
 */
const SHEET = [
    ['토양 시료 접수 서식', '', '', ''],
    ['안내: 4행부터 입력하세요', '', '', ''],
    ['접수번호', '성명', '지번주소', '작물'],
    ['501', '홍길동', '봉화읍 내성리 100', '고추'],
];

async function openWithFile(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForFunction(() => !!window.SoilResultImporter && !!window.XLSX, { timeout: 15000 });

    await page.evaluate(() => window.SoilResultImporter.open());
    await expect(page.locator('.sri-overlay')).toBeVisible();

    // 브라우저 안에서 .xlsx를 만들어 파일 입력에 넣는다 (실제 파일 경로와 같은 배선)
    const buf = await page.evaluate((rows) => {
        const ws = window.XLSX.utils.aoa_to_sheet(rows);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, '접수');
        const out = window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        return Array.from(new Uint8Array(out));
    }, SHEET);

    await page.locator('.sri-overlay input[type="file"]').first().setInputFiles({
        name: 'sample.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from(buf),
    });
    await page.waitForFunction(
        () => !!document.querySelector('.sri-overlay [data-el="headerRow"]:not([disabled])'),
        { timeout: 15000 }
    );
}

/** 현재 매핑 상태를 { 필드키: 열인덱스 }로 읽는다 */
const mappingOf = (page) =>
    page.evaluate(() => window.SoilResultImporter._state.fieldMapping);

test.describe('헤더 행 변경 (SLS-1-230)', () => {
    test('헤더 행을 바꾸면 매핑이 새 헤더 기준으로 다시 잡힌다', async ({ page }) => {
        await openWithFile(page);

        // 로드 직후: 1행("토양 시료 접수 서식")이 헤더 → 쓸 만한 매핑이 나올 수 없다
        const before = await mappingOf(page);

        await page.locator('.sri-overlay [data-el="headerRow"]').fill('3');
        await expect
            .poll(async () => Object.keys(await mappingOf(page)).length, { timeout: 5000 })
            .toBeGreaterThan(2);

        const after = await mappingOf(page);
        expect(after, `헤더 행을 바꿔도 매핑이 그대로다 (before=${JSON.stringify(before)})`)
            .not.toEqual(before);

        // 새 헤더 기준으로 정확히 붙었는가 — 개수만 세면 엉뚱하게 붙어도 통과한다
        expect(after.receptionNumber, '접수번호가 0열에 안 붙었다').toBe(0);
        expect(after.name, '성명이 1열에 안 붙었다').toBe(1);
        expect(after.lotAddress, '지번주소가 2열에 안 붙었다').toBe(2);
        expect(after.cropsDisplay, '작물이 3열에 안 붙었다').toBe(3);
    });

    // 🚨 codex 코드리뷰 MAJOR — '헤더 없음'도 헤더를 바꾼다(실제 헤더 → '열 1, 열 2…').
    //    옛 매핑이 남으면 헤더 행이 데이터로 섞인 채 '성명'·'지번주소' 같은 글자가
    //    접수 자료로 저장된다. 헤더 행 변경만 고치고 이걸 빠뜨렸었다.
    test("'헤더 없음'을 켜도 매핑이 다시 잡힌다", async ({ page }) => {
        await openWithFile(page);
        await page.locator('.sri-overlay [data-el="headerRow"]').fill('3');
        await expect
            .poll(async () => Object.keys(await mappingOf(page)).length, { timeout: 5000 })
            .toBeGreaterThan(2);

        await page.locator('.sri-overlay [data-el="noHeader"]').check();
        await expect
            .poll(async () => Object.keys(await mappingOf(page)).length, { timeout: 5000 })
            .toBe(0);

        // 다시 해제하면 원래대로 잡힌다
        await page.locator('.sri-overlay [data-el="noHeader"]').uncheck();
        await expect
            .poll(async () => (await mappingOf(page)).name, { timeout: 5000 })
            .toBe(1);
    });

    test('바뀐 매핑이 미리보기에도 반영된다', async ({ page }) => {
        await openWithFile(page);
        await page.locator('.sri-overlay [data-el="headerRow"]').fill('3');

        await expect
            .poll(() => page.locator('.sri-pv-table tbody tr').count(), { timeout: 5000 })
            .toBeGreaterThan(0);
        // 헤더 행이 데이터로 섞여 들어가면 '접수번호'라는 글자가 미리보기에 보인다
        const body = await page.locator('.sri-pv-table tbody').innerText();
        expect(body, '헤더 행이 데이터로 들어갔다').not.toContain('접수번호');
        expect(body, '데이터 행이 안 보인다').toContain('홍길동');
    });
});
