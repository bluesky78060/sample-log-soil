// @ts-nocheck
const { test, expect } = require('@playwright/test');

/**
 * 퇴비 엑셀 가져오기 — 실패 경로 (SLS-1-271)
 *
 * SLS-1-268이 정상 경로를, SLS-1-270이 채번을 덮었다. 남은 것은 **거절해야 할 입력**이다.
 * 가져오기가 조용히 통과시키면 쓰레기 레코드가 대장에 남는다.
 *
 * ⚠️ toast 문구가 아니라 **상태**로 단언한다 — 모달 가시성, 현재 단계, 미리보기 행 수,
 *    저장 건수. 문구는 쉽게 바뀌고, 문구에 매달린 테스트는 그때마다 깨진다.
 *
 * ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
 */

const modalOf = (page) => page.locator('#excelImportModal');
const yearOf = (page) => page.evaluate(() => window.compostManager.selectedYear);

async function openCompost(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/compost/');
    expect(res && res.status(), 'docs/compost/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.compostManager && !!window.XLSX, { timeout: 15000 });
    await page.evaluate(() => {
        localStorage.clear();
        window.compostManager.sampleLogs = [];
    });
}

/** 브라우저 안에서 .xlsx를 만들어 파일 입력에 넣는다 (모달이 열릴지는 보장하지 않는다) */
async function uploadAoa(page, aoa) {
    const buf = await page.evaluate((rows) => {
        const ws = window.XLSX.utils.aoa_to_sheet(rows);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, '퇴액비시료');
        return Array.from(new Uint8Array(window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' })));
    }, aoa);
    await page.locator('#excelImportInput').setInputFiles({
        name: 'boundary.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from(buf),
    });
}

const HEADERS = ['접수번호', '농장명', '대표자', '시료종류', '축종', '원료(부재료)', '생산일', '검사목적', '비고'];

/**
 * "파일이 거절됐다"를 단언한다.
 *
 * ⚠️ 모달은 **처음부터 hidden**이다. `setInputFiles` 직후 곧바로 `toBeHidden()`을 보면
 *    `FileReader.onload`가 돌기도 전에 통과해 **아무것도 검증하지 못한다**
 *    (모달을 잘못 열었다가 비동기로 닫는 변이조차 놓친다).
 *    그래서 **처리가 끝났다는 신호(오류 toast)를 먼저 기다린 뒤** 모달을 확인한다.
 *    toast의 *존재*만 신호로 쓰고 문구에는 기대지 않는다.
 */
async function expectRejected(page) {
    await expect(page.locator('#toastContainer .toast.error')).toBeVisible();
    await expect(modalOf(page)).toBeHidden();
}

test.describe('퇴비 엑셀 가져오기 실패 경로 (SLS-1-271)', () => {
    test.beforeEach(async ({ page }) => {
        await openCompost(page);
    });

    test('1. 헤더만 있는 파일은 모달을 열지 않는다', async ({ page }) => {
        await uploadAoa(page, [HEADERS]);
        await expectRejected(page);
    });

    test('2. 데이터 행이 전부 비어 있으면 모달을 열지 않는다', async ({ page }) => {
        // ⚠️ 명시적으로 빈 셀을 넣는다. 행을 생략하면 XLSX writer가 지워
        //    1번과 같은 경로(jsonData.length < 2)로 합쳐진다.
        await uploadAoa(page, [HEADERS, ['', '', '', '', '', '', '', '', ''], ['', '', '', '', '', '', '', '', '']]);
        await expectRejected(page);
    });

    test('3. 어떤 열도 매핑되지 않으면 미리보기로 넘어가지 못한다', async ({ page }) => {
        // autoMapRules에는 '번호'·'날짜'·'주소'·'농장'·'시료' 같은 짧은 키가 있어
        // 무심코 고른 한글 헤더가 매핑돼 버린다. 규칙에 없는 문자열을 쓴다.
        await uploadAoa(page, [['AAA', 'BBB'], ['x', 'y']]);
        await expect(modalOf(page)).toBeVisible();

        await page.click('#excelImportNextBtn');            // step1 → step2
        await expect(page.locator('#excelImportStep2')).toBeVisible();
        await expect(page.locator('#columnMappingArea .mapping-row')).toHaveCount(2);
        // 자동매핑이 하나도 안 잡혔다
        expect(await page.locator('#columnMappingArea .mapping-select')
            .evaluateAll((els) => els.map((e) => e.value))).toEqual(['', '']);

        await page.click('#excelImportNextBtn');            // 진행이 막혀야 한다
        await expect(page.locator('#excelImportStep2')).toBeVisible();
        await expect(page.locator('#excelImportStep3')).toBeHidden();
    });

    test('4. 농장명·대표자·시료종류가 모두 빈 행은 건너뛴다 (SLS-1-273)', async ({ page }) => {
        // 예전에는 이 검사가 **통째로 죽어 있었다.** buildRecord가 sampleType에
        // '가축분퇴비'를 채우고 name을 공통 대표자로 메워, `record`로 "비었는지"를 보면
        // 어떤 입력으로도 참이 되지 않았다. 비고 한 칸만 적은 행이 기본값만 걸친
        // 레코드로 등록되고 경고도 뜨지 않았다.
        await uploadAoa(page, [HEADERS, ['', '', '', '', '', '', '', '', '메모만 있음']]);
        await expect(modalOf(page)).toBeVisible();
        await page.click('#excelImportNextBtn');
        await page.click('#excelImportNextBtn');
        await expect(page.locator('#excelImportStep3')).toBeVisible();

        // 건너뛴 사유가 행 번호와 함께 보인다
        await expect(page.locator('#importWarnings')).toBeVisible();
        await expect(page.locator('#importWarnings')).toContainText('행 2');
        await expect(page.locator('#previewTableBody tr')).toHaveCount(0);

        // 가져올 것이 없으니 진행도 막힌다
        await page.click('#excelImportNextBtn');
        await expect(modalOf(page)).toBeVisible();

        const year = await yearOf(page);
        const saved = await page.evaluate((y) => JSON.parse(localStorage.getItem(`compostSampleLogs_${y}`) || '[]'), year);
        expect(saved).toHaveLength(0);
    });

    test('4-b. 공통 대표자를 입력해도 원본이 빈 행은 건너뛴다 (SLS-1-273)', async ({ page }) => {
        // ⚠️ 이 시나리오가 핵심이다. 1단계 공통 대표자를 채우면 `record.name`이 그 값으로
        //    메워진다 — `record`를 보는 판정은 여기서 **다시 죽는다.**
        //    원본 셀을 봐야 비로소 걸러진다.
        await uploadAoa(page, [HEADERS, ['', '', '', '', '', '', '', '', '메모만 있음']]);
        await page.locator('#importName').fill('공통대표자');
        await page.click('#excelImportNextBtn');
        await page.click('#excelImportNextBtn');
        await expect(page.locator('#excelImportStep3')).toBeVisible();

        await expect(page.locator('#importWarnings')).toContainText('행 2');
        await expect(page.locator('#previewTableBody tr')).toHaveCount(0);
    });

    // 식별자가 **하나만** 있어도 남긴다 — 판정은 3필드의 AND다.
    // 각각 따로 두어야 `&&` → `||` 변이가 확실히 죽는다.
    // previewColumns: 접수번호, 접수일자, 농장명, 대표자, 시료종류, 축종, 원료, 비고
    for (const [label, row, col, expected] of [
        ['농장명만', ['', '봉화농장', '', '', '', '', '', '', ''], 3, '봉화농장'],
        ['대표자만', ['', '', '홍길동', '', '', '', '', '', ''], 4, '홍길동'],
        ['시료종류만', ['', '', '', '액비', '', '', '', '', ''], 5, '액비'],
    ]) {
        test(`4-c. ${label} 있는 행은 그대로 가져온다 (SLS-1-273)`, async ({ page }) => {
            await uploadAoa(page, [HEADERS, row]);
            await page.click('#excelImportNextBtn');
            await page.click('#excelImportNextBtn');
            await expect(page.locator('#excelImportStep3')).toBeVisible();
            await expect(page.locator('#previewTableBody tr')).toHaveCount(1);
            await expect(page.locator('#importWarnings')).toBeHidden();
            // ⚠️ 행 수만 세면 값이 뭉개져도 통과한다. 특히 '시료종류만'은 그 값이
            //    무시되고 기본값 '가축분퇴비'로 바뀌어도 1건이라 초록불이 된다.
            await expect(page.locator(`#previewTableBody tr td:nth-child(${col})`)).toHaveText(expected);
        });
    }

    test('5. 5000행을 넘으면 앞에서부터 5000건만 처리한다', async ({ page }) => {
        const MAX = 5000;
        const aoa = [['농장명']];
        for (let i = 1; i <= MAX + 1; i += 1) aoa.push([`농장${i}`]);
        await uploadAoa(page, aoa);
        await expect(modalOf(page)).toBeVisible();

        await page.click('#excelImportNextBtn');
        await page.click('#excelImportNextBtn');
        await expect(page.locator('#excelImportStep3')).toBeVisible();

        await expect(page.locator('#previewSummary')).toContainText(`${MAX}건`);
        await expect(page.locator('#previewTableBody tr')).toHaveCount(MAX);
        // ⚠️ 행 수만 세면 **뒤에서 자르는지 앞에서 자르는지** 구분하지 못한다.
        //    첫 행과 마지막 행을 함께 본다 (농장명은 previewColumns의 3번째 열).
        const names = page.locator('#previewTableBody tr td:nth-child(3)');
        await expect(names.first()).toHaveText('농장1');
        await expect(names.last()).toHaveText(`농장${MAX}`);
    });
});
