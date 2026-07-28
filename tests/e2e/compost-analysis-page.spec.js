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
        await expect(page.locator('td[data-field="copper"]')).toHaveText('210');
        // 부숙도는 고정 등급이라 select다 — td 텍스트에는 전 옵션이 들어가므로 값으로 본다
        await expect(page.locator('td[data-field="maturity"] select')).toHaveValue('부숙완료');
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

    // SLS-1-200: 질소·인산·칼리가 열렸다. 기준값이 없어 standard가 비어 있으므로
    // checkCompostFieldStatus의 "기준 없는 항목은 배지를 비운다" 가드가 함께 있어야 한다 —
    // 없으면 무조건 초록 ✓(허위 적합)가 찍힌다.
    test('질소·인산·칼리가 모든 행에서 열린다', async ({ page }) => {
        await seedAndOpen(page, {
            logs: [log({ id: 'c1', rec: '101', animalType: '돼지' }),
                   log({ id: 'c2', rec: '102', sampleType: '가축분뇨발효액', animalType: '소' })]
        });
        for (const f of ['nitrogen', 'phosphorus', 'potassium']) {
            await expect(page.locator(`td[data-field="${f}"].editable-cell`), f).toHaveCount(2);
        }
        const fields = await page.evaluate(() =>
            window.compostAnalysisPage.resultImporter.cfg.resultFields);
        expect(fields).toEqual(['moisture', 'maturity', 'copper', 'zinc', 'salinity',
                                'nitrogen', 'phosphorus', 'potassium']);
    });
});

test.describe('격자 입력 (SLS-1-205 S3)', () => {
    test('셀을 편집하면 저장소와 접수 대장에 함께 반영된다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101' })] });

        await page.evaluate(() => {
            window.compostAnalysisPage.handleCellEdit('c1', 'moisture', '62.1');
        });

        const out = await page.evaluate((year) => ({
            store: JSON.parse(localStorage.getItem(`compostTestResults_${year}`) || '{}'),
            logs: JSON.parse(localStorage.getItem(`compostSampleLogs_${year}`) || '[]')
        }), YEAR);

        expect(out.store.c1.moisture).toBe('62.1');
        // 접수 목록은 log.moisture를 직접 렌더한다 — 저장소에만 쓰면 대장이 빈다
        expect(out.logs[0].moisture).toBe('62.1');
    });

    test('판정(testResult)은 역기록에서 건드리지 않는다', async ({ page }) => {
        // 격자에 판정 열이 없다. 덮어쓰면 모달·목록에서 내린 판정이 지워진다.
        await seedAndOpen(page, {
            logs: [{ ...log({ id: 'c1', rec: '101' }), testResult: 'pass' }]
        });
        await page.evaluate(() => {
            window.compostAnalysisPage.handleCellEdit('c1', 'moisture', '55');
        });
        const logs = await page.evaluate((year) =>
            JSON.parse(localStorage.getItem(`compostSampleLogs_${year}`) || '[]'), YEAR);
        expect(logs[0].testResult).toBe('pass');
    });

    // 🚨 이 티켓의 핵심 계약
    test('붙여넣기가 비해당 셀을 건너뛴다 (돼지 행에 염분이 기록되지 않는다)', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101', animalType: '돼지' })] });

        const res = await page.evaluate(() => {
            const p = window.compostAnalysisPage;
            // MAJOR-1 가드: 실제 편집 가능 셀에 포커스가 있어야 붙여넣기가 동작한다
            document.querySelector('td[data-field="moisture"]').focus();
            // 함수율 / 부숙도 / 구리 / 아연 / 염분 5칸 붙여넣기
            const data = '62.1\t부숙완료\t210\t880\t9.9';
            p.handlePaste({
                clipboardData: { getData: () => data },
                preventDefault: () => {}
            });
            return p.results.c1;
        });

        expect(res.moisture).toBe('62.1');
        expect(res.copper).toBe('210');
        expect(res.zinc).toBe('880');
        // 돼지에 염분은 해당 없음 — 저장소에 들어가면 안 된다
        expect(res.salinity).toBeUndefined();
    });

    test('소 행에서는 반대로 염분이 들어가고 구리·아연이 건너뛰어진다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101', animalType: '소' })] });

        const res = await page.evaluate(() => {
            const p = window.compostAnalysisPage;
            document.querySelector('td[data-field="moisture"]').focus();
            p.handlePaste({
                clipboardData: { getData: () => '58.4\t부숙후기\t210\t880\t1.8' },
                preventDefault: () => {}
            });
            return p.results.c1;
        });

        expect(res.moisture).toBe('58.4');
        expect(res.salinity).toBe('1.8');
        expect(res.copper).toBeUndefined();
        expect(res.zinc).toBeUndefined();
    });

    test('여러 행 붙여넣기가 행마다 다른 규칙을 적용한다', async ({ page }) => {
        await seedAndOpen(page, {
            logs: [
                log({ id: 'c1', rec: '101', animalType: '돼지' }),
                log({ id: 'c2', rec: '102', animalType: '소' })
            ]
        });

        const res = await page.evaluate(() => {
            const p = window.compostAnalysisPage;
            document.querySelector('td[data-field="moisture"]').focus();
            p.handlePaste({
                clipboardData: { getData: () => '62.1\t부숙완료\t210\t880\t9.9\n58.4\t부숙후기\t300\t900\t1.8' },
                preventDefault: () => {}
            });
            return { c1: p.results.c1, c2: p.results.c2 };
        });

        expect(res.c1.copper).toBe('210');
        expect(res.c1.salinity).toBeUndefined();
        expect(res.c2.salinity).toBe('1.8');
        expect(res.c2.copper).toBeUndefined();
    });

    test('검사일자를 선택 행에만 일괄 적용한다', async ({ page }) => {
        await seedAndOpen(page, {
            logs: [log({ id: 'c1', rec: '101' }), log({ id: 'c2', rec: '102' })]
        });

        await page.locator('.row-checkbox[data-id="c1"]').check();
        await page.locator('#bulkTestDate').fill('2026-07-28');
        await page.locator('#applyBulkBtn').click();

        const store = await page.evaluate((year) =>
            JSON.parse(localStorage.getItem(`compostTestResults_${year}`) || '{}'), YEAR);
        expect(store.c1.testDate).toBe('2026-07-28');
        expect(store.c2).toBeUndefined();
    });

    test('부숙도는 select이고 법정 등급만 고를 수 있다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101' })] });
        const opts = await page.locator('td[data-field="maturity"] select')
            .evaluate(el => Array.from(el.options).map(o => o.value));
        // SLS-1-207: 흙토람 양식 5종. 부숙후기가 빠져 있었고 '완전부숙'이 잘못 들어 있었다.
        expect(opts).toEqual(['', '미부숙', '부숙초기', '부숙중기', '부숙후기', '부숙완료']);
    });

    test('입력 상식 범위를 벗어나면 표시한다 (판정과는 무관)', async ({ page }) => {
        await seedAndOpen(page, {
            logs: [log({ id: 'c1', rec: '101' })],
            results: { c1: { moisture: '621' } }   // 62.1 오타
        });
        await expect(page.locator('td[data-field="moisture"]')).toHaveClass(/out-of-range/);
    });
});

test.describe('결과 가져오기 (SLS-1-205 S4)', () => {
    test('importer가 배선되고 모달 마크업이 존재한다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101' })] });
        const wired = await page.evaluate(() => ({
            klass: typeof window.HeuktoramResultImporter === 'function',
            instance: !!window.compostAnalysisPage.resultImporter,
            modal: !!document.getElementById('resultImporterModal')
        }));
        expect(wired.klass).toBe(true);
        expect(wired.instance).toBe(true);
        expect(wired.modal).toBe(true);
    });

    // 🚨 붙여넣기와 동일한 계약 — 다른 경로
    test('가져오기의 applyResult가 비해당 셀을 건너뛴다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101', animalType: '돼지' })] });
        const res = await page.evaluate(() => {
            const cfg = window.compostAnalysisPage.resultImporter.cfg;
            cfg.applyResult('c1', 'copper', '210');    // 돼지 → 적용
            cfg.applyResult('c1', 'salinity', '9.9');  // 돼지 → 해당 없음
            return window.compostAnalysisPage.results.c1;
        });
        expect(res.copper).toBe('210');
        expect(res.salinity).toBeUndefined();
    });

    test('퇴비 별칭이 병합되고, cfg가 기본 맵을 덮어쓴다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101' })] });
        const out = await page.evaluate(() => {
            const p = window.compostAnalysisPage.resultImporter;
            // 병합 — 퇴비 별칭이 들어와 있다
            const merged = p._patterns()['함수율'];
            // 덮어쓰기 — '인산'이 기본 맵(토양 availableP)과 실제로 충돌하는 키다
            return { merged, base: p._patterns()['ec'], overridden: p._patterns()['인산'] };
        });
        expect(out.merged).toEqual({ type: 'field', key: 'moisture' });
        expect(out.base).toEqual({ type: 'field', key: 'ec' });   // 안 건드린 키는 그대로
        // '인산'은 기본 맵에서 토양 availableP를 가리킨다. cfg가 안 이기면
        // 퇴비의 인산 컬럼이 화이트리스트에 걸려 조용히 매핑 실패한다.
        expect(out.overridden).toEqual({ type: 'field', key: 'phosphorus' });
    });

    test('토양 importer의 기본 별칭은 그대로다 (회귀 없음)', async ({ page }) => {
        await page.goto('/heuktoram/');
        await page.waitForFunction(() => !!window.heuktoramManager?.resultImporter, { timeout: 10000 });
        const rule = await page.evaluate(() =>
            window.heuktoramManager.resultImporter._patterns()['인산']);
        expect(rule).toEqual({ type: 'field', key: 'availableP' });
    });

    test('하위필지 동기화 체크박스가 없다 (퇴비에 하위필지 개념 없음)', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101' })] });
        await expect(page.locator('#importerSyncSiblings')).toHaveCount(0);
        // 그럼에도 importer가 정상 동작해야 한다 (초기값 경로 안전 확인)
        const ok = await page.evaluate(() => {
            try { window.compostAnalysisPage.resultImporter.cfg.syncToSiblings('c1', 'moisture', '1'); return true; }
            catch { return false; }
        });
        expect(ok).toBe(true);
    });

    test('토양 전용 문구가 퇴비 화면에 남아 있지 않다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101' })] });
        const html = await page.locator('#resultImporterModal').innerHTML();
        expect(html).not.toContain('흙토람 필드 매핑');
        expect(html).not.toContain('하위필지');
        expect(html).toContain('검정 항목 매핑');
        expect(html).toContain('접수번호');
    });

    // 마크업 복제는 vite MPA 제약상 불가피하다. 주석은 회귀를 막지 못하므로
    // 두 페이지의 importer id 집합이 어긋나면 여기서 잡는다.
    test('두 페이지의 importer id 집합이 일치한다 (하위필지 체크박스 제외)', async ({ page }) => {
        const ids = async (url) => {
            await page.goto(url);
            return page.evaluate(() =>
                Array.from(document.querySelectorAll('#resultImporterModal [id]'))
                    .map(el => el.id).sort());
        };
        const soil = (await ids('/heuktoram/')).filter(id => id !== 'importerSyncSiblings');
        const compost = await ids('/compost-analysis/');
        expect(compost).toEqual(soil);
    });
});

test.describe('코드리뷰 회귀 (SLS-1-205)', () => {
    // 🚨 CRITICAL-1: init 스냅샷을 통째로 쓰면 다른 창의 변경이 소실된다.
    // 팝업을 띄워둔 채 접수 페이지에서 등록·수정·삭제하는 것은 일상 동선이다.
    test('다른 창이 추가한 레코드가 격자 저장에 소실되지 않는다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101' })] });

        // 접수 페이지에서 새 시료를 등록한 상황을 재현 (격자는 모르는 변경)
        await page.evaluate((year) => {
            const cur = JSON.parse(localStorage.getItem(`compostSampleLogs_${year}`));
            cur.push({ id: 'c9', receptionNumber: '999', farmName: '나중농장',
                       sampleType: '가축분퇴비', animalType: '소' });
            localStorage.setItem(`compostSampleLogs_${year}`, JSON.stringify(cur));
        }, YEAR);

        await page.evaluate(() => window.compostAnalysisPage.handleCellEdit('c1', 'moisture', '62.1'));

        const logs = await page.evaluate((year) =>
            JSON.parse(localStorage.getItem(`compostSampleLogs_${year}`)), YEAR);
        expect(logs.map(l => l.id).sort()).toEqual(['c1', 'c9']);
        expect(logs.find(l => l.id === 'c1').moisture).toBe('62.1');
    });

    test('다른 창이 삭제한 레코드를 격자 저장이 되살리지 않는다', async ({ page }) => {
        await seedAndOpen(page, {
            logs: [log({ id: 'c1', rec: '101' }), log({ id: 'c2', rec: '102' })]
        });
        await page.evaluate((year) => {
            const cur = JSON.parse(localStorage.getItem(`compostSampleLogs_${year}`));
            localStorage.setItem(`compostSampleLogs_${year}`,
                JSON.stringify(cur.filter(l => l.id !== 'c2')));
        }, YEAR);

        await page.evaluate(() => {
            const p = window.compostAnalysisPage;
            p.handleCellEdit('c1', 'moisture', '55');
            p.handleCellEdit('c2', 'moisture', '66');   // 이미 삭제된 건
        });

        const logs = await page.evaluate((year) =>
            JSON.parse(localStorage.getItem(`compostSampleLogs_${year}`)), YEAR);
        expect(logs.map(l => l.id)).toEqual(['c1']);
    });

    // 🚨 MAJOR-1: document 레벨 paste 핸들러가 모달 입력까지 가로챈다
    test('격자 밖(모달 텍스트영역)에 붙여넣으면 격자가 변하지 않는다', async ({ page }) => {
        await seedAndOpen(page, { logs: [log({ id: 'c1', rec: '101' })] });

        const res = await page.evaluate(() => {
            const p = window.compostAnalysisPage;
            p.focusedCell = { rowIdx: 0, colIdx: 0 };     // 셀을 클릭했던 상태
            const ta = document.getElementById('importerTextarea');
            ta.focus();                                   // 그 뒤 모달 텍스트영역으로 이동
            let prevented = false;
            p.handlePaste({
                clipboardData: { getData: () => '99.9\t부숙완료' },
                preventDefault: () => { prevented = true; }
            });
            return { results: p.results.c1, prevented };
        });

        expect(res.results).toBeUndefined();   // 격자에 아무것도 안 써짐
        expect(res.prevented).toBe(false);     // 모달 입력을 막지 않음
    });

    // MINOR-2: 정정한 값이 계속 오타라고 표시되면 안 된다
    test('범위 밖 → 범위 안으로 고치면 표시와 툴팁이 모두 사라진다', async ({ page }) => {
        await seedAndOpen(page, {
            logs: [log({ id: 'c1', rec: '101' })],
            results: { c1: { moisture: '621' } }
        });
        await expect(page.locator('td[data-field="moisture"]')).toHaveClass(/out-of-range/);

        await page.evaluate(() => window.compostAnalysisPage.handleCellEdit('c1', 'moisture', '62.1'));

        const cell = page.locator('td[data-field="moisture"]');
        await expect(cell).not.toHaveClass(/out-of-range/);
        expect(await cell.getAttribute('title')).toBeNull();
    });
});
