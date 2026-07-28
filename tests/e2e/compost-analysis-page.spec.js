// 퇴·액비 검정결과 페이지 (SLS-1-205 S2)
//
// 전제: `npm run build` 후 docs/ 산출물 필요.
const { test, expect } = require('@playwright/test');

const YEAR = String(new Date().getFullYear());

const log = (over) => ({
    id: over.id,
    receptionNumber: over.rec,
    farmName: over.farm || '가나농장',
    sampleType: over.sampleType || '가축분퇴비',
    animalType: over.animalType || '돼지',
    date: `${YEAR}-07-01`,
    isComplete: false
});

/** 접수 데이터·검정결과·핸드오프를 심고 페이지를 연다 */
async function seedAndOpen(page, { logs, results = {}, selectedIds = [] }) {
    await page.goto('/compost-analysis/');
    await page.evaluate(({ year, logs, results, selectedIds }) => {
        localStorage.setItem(`compostSampleLogs_${year}`, JSON.stringify(logs));
        localStorage.setItem(`compostTestResults_${year}`, JSON.stringify(results));
        localStorage.setItem('compostAnalysis_year', year);
        localStorage.setItem('compostAnalysis_selected_ids', JSON.stringify(selectedIds));
    }, { year: YEAR, logs, results, selectedIds });
    await page.reload();
    await page.waitForFunction(() => !!window.compostAnalysisPage, { timeout: 10000 });
}

test.describe('퇴·액비 검정결과 페이지 (SLS-1-205)', () => {
    test('페이지가 열리고 필요한 전역이 배선되어 있다', async ({ page }) => {
        const res = await page.goto('/compost-analysis/');
        expect(res && res.status(), 'docs/compost-analysis/ 없음 — `npm run build && npm test` 순서로 실행할 것')
            .toBeLessThan(400);
        await page.waitForFunction(() => !!window.compostAnalysisPage, { timeout: 10000 });

        // 프로덕션 배선 — 유닛은 모듈을 직접 import하므로 entry 배선이 끊겨도 통과한다
        // (SLS-1-204 MAJOR-2 교훈). 여기서 실제 페이지 배선을 고정한다.
        const wired = await page.evaluate(() => ({
            store: typeof window.CompostResultsStore?.load === 'function',
            fields: typeof window.CompostFields?.appliesTo === 'function',
            resultFields: window.CompostFields?.RESULT_FIELDS?.length
        }));
        expect(wired.store).toBe(true);
        expect(wired.fields).toBe(true);
        expect(wired.resultFields).toBe(8);
    });

    test('접수 자료가 없으면 안내를 보여준다', async ({ page }) => {
        await seedAndOpen(page, { logs: [] });
        await expect(page.locator('#emptyState')).toBeVisible();
        await expect(page.locator('#recordCount')).toHaveText('0건');
    });

    test('선택 id가 비어 있으면 그 연도 전건을 표시한다', async ({ page }) => {
        await seedAndOpen(page, {
            logs: [log({ id: 'c1', rec: '101' }), log({ id: 'c2', rec: '102' })],
            selectedIds: []
        });
        await expect(page.locator('#caTableBody tr')).toHaveCount(2);
        await expect(page.locator('#recordCount')).toHaveText('2건');
    });

    test('선택 id가 있으면 그 행만 표시한다', async ({ page }) => {
        await seedAndOpen(page, {
            logs: [log({ id: 'c1', rec: '101' }), log({ id: 'c2', rec: '102' })],
            selectedIds: ['c2']
        });
        await expect(page.locator('#caTableBody tr')).toHaveCount(1);
        await expect(page.locator('#caTableBody tr td.col-reception')).toHaveText('102');
    });

    test('저장된 검정결과가 셀에 표시된다', async ({ page }) => {
        await seedAndOpen(page, {
            logs: [log({ id: 'c1', rec: '101' })],
            results: { c1: { moisture: '62.1', maturity: '부숙완료', copper: '210' } }
        });
        await expect(page.locator('td[data-field="moisture"]')).toHaveText('62.1');
        await expect(page.locator('td[data-field="maturity"]')).toHaveText('부숙완료');
        await expect(page.locator('td[data-field="copper"]')).toHaveText('210');
    });

    // 이 티켓의 핵심 계약 — 축종별로 적용 항목이 다르다.
    // 비활성 표시가 S3의 붙여넣기·가져오기·일괄적용 건너뛰기의 근거가 된다.
    test('돼지 행은 구리·아연이 열리고 염분은 비활성이다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101', animalType: '돼지' })] });
        await expect(page.locator('td[data-field="copper"]')).toHaveClass(/editable-cell/);
        await expect(page.locator('td[data-field="zinc"]')).toHaveClass(/editable-cell/);
        await expect(page.locator('td[data-field="salinity"]')).toHaveClass(/cell-na/);
    });

    test('소 행은 염분이 열리고 구리·아연은 비활성이다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101', animalType: '소' })] });
        await expect(page.locator('td[data-field="salinity"]')).toHaveClass(/editable-cell/);
        await expect(page.locator('td[data-field="copper"]')).toHaveClass(/cell-na/);
        await expect(page.locator('td[data-field="zinc"]')).toHaveClass(/cell-na/);
    });

    test('함수율·부숙도는 모든 행에서 열린다', async ({ page }) => {
        await seedAndOpen(page, {
            logs: [
                log({ id: 'c1', rec: '101', animalType: '닭·오리 등' }),
                log({ id: 'c2', rec: '102', sampleType: '가축분뇨발효액', animalType: '소' })
            ]
        });
        await expect(page.locator('td[data-field="moisture"].editable-cell')).toHaveCount(2);
        await expect(page.locator('td[data-field="maturity"].editable-cell')).toHaveCount(2);
    });

    // 질소·인산·칼리는 COMPOST_FIELDS에 아직 없다(S3에서 배지 가드와 함께 추가).
    // 지금 넣으면 standard가 비어 무조건 초록 ✓(허위 적합)가 표시된다.
    test('질소·인산·칼리는 아직 전부 비활성이다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101' })] });
        for (const f of ['nitrogen', 'phosphorus', 'potassium']) {
            await expect(page.locator(`td[data-field="${f}"]`)).toHaveClass(/cell-na/);
        }
    });
});
