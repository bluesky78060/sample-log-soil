// @ts-nocheck
const { test, expect } = require('@playwright/test');
const XLSX = require('xlsx');

/**
 * 퇴비 엑셀 가져오기 — 전 구간 왕복 (SLS-1-268)
 *
 * compost는 레거시 `ExcelImportManager` 경로가 **현역**이다
 * (`compost/index.html:107`의 가져오기 label이 `util-btn`으로 화면에 보인다).
 * 그런데 이 동작을 지키는 것이 `compost-import-smoke.spec.js` 하나뿐이었고,
 * 그 스모크는 **마크업과 전역만 남고 배선이 끊겨도 통과한다.**
 *
 * 이 스펙은 파일 선택 → 컬럼 매핑 → 미리보기 → 저장까지 실제로 밟는다.
 *
 * ⚠️ 단언 방식이 중요하다 (SLS-1-222의 교훈):
 *    `sampleLogs`(메모리 배열)만 읽거나 `not.toBe('')` 수준으로 단정하면
 *    **전 레코드가 '1'이어도 통과한다.** 실제로 그렇게 새어나간 결함이 있었다.
 *    그래서 여기서는 **새로고침 후 localStorage**를 읽고 **정확 일치**로 단정한다.
 *
 * ⚠️ 연도를 하드코딩하지 않는다. `selectedYear`는 init의 `findYearWithData()`가
 *    덮으므로(BaseSampleManager.js:101) 현재 연도와 다를 수 있다. 하드코딩하면
 *    연말·연초에 **조용히 빈 배열을 읽고 통과**한다.
 *
 * ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
 */

/** 실제 사용자가 받는 서식과 동일한 헤더 (templateConfig.headers) */
const HEADERS = ['접수번호', '농장명', '대표자', '시료종류', '축종', '원료(부재료)', '생산일', '검사목적', '비고'];
/** 접수번호 열을 뺀 서식 — 자동 채번 경로를 밟기 위한 것 */
const HEADERS_NO_NUM = HEADERS.slice(1);

const ROW_A = ['봉화농장', '홍길동', '가축분퇴비', '소', '톱밥, 왕겨', '2026-01-15', '비료공정규격', ''];
const ROW_B = ['영주농장', '김영수', '가축분퇴비', '돼지', '왕겨', '2026-01-16', '비료공정규격', ''];
const ROW_C = ['울진농장', '박철수', '액비', '닭', '수분조절재', '2026-01-17', '비료공정규격', ''];

const modalOf = (page) => page.locator('#excelImportModal');

/** 현재 선택 연도 (하드코딩 금지 — 위 주석 참조) */
const yearOf = (page) => page.evaluate(() => window.compostManager.selectedYear);

/**
 * 퇴비 페이지를 열고 저장소를 비운다.
 * 메모리 배열까지 비워야 자동 채번의 기준(getExistingLogs)이 실제로 0이 된다 —
 * localStorage만 지우면 이미 로드된 sampleLogs가 남아 기대 번호가 밀린다.
 */
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

/**
 * 브라우저 안에서 .xlsx를 만들어 파일 입력에 넣는다.
 * 레거시 importer는 붙여넣기 모드가 없어 **실제 파일 경로가 유일한 진입로**다.
 */
async function uploadSheet(page, headers, rows) {
    const buf = await page.evaluate(({ headers, rows }) => {
        const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, '퇴액비시료');
        return Array.from(new Uint8Array(window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' })));
    }, { headers, rows });

    await page.locator('#excelImportInput').setInputFiles({
        name: 'compost.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from(buf),
    });
    await expect(modalOf(page)).toBeVisible();
    return modalOf(page);
}

/** "다음"/"가져오기" 버튼 (단계에 따라 라벨이 바뀐다 — excel-import-manager.js:221) */
const nextBtn = (page) => page.locator('#excelImportNextBtn');

/** step1 → step2 → step3 까지 진행 */
async function advanceToPreview(page) {
    await nextBtn(page).click();                                   // step1 → step2
    await expect(page.locator('#excelImportStep2')).toBeVisible();
    await nextBtn(page).click();                                   // step2 → step3
    await expect(page.locator('#excelImportStep3')).toBeVisible();
}

/** 미리보기 표의 접수번호 열 (previewColumns의 첫 열) */
const previewNumbers = (page) =>
    page.locator('#previewTableBody tr td:nth-child(1)').allTextContents();

/** 저장된 레코드를 **새로고침 후 localStorage**에서 읽는다 (메모리 배열 아님) */
async function readPersisted(page) {
    const year = await yearOf(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.compostManager, { timeout: 15000 });
    return page.evaluate((y) => {
        const raw = localStorage.getItem(`compostSampleLogs_${y}`);
        return (raw ? JSON.parse(raw) : []).map((l) => ({
            receptionNumber: String(l.receptionNumber ?? ''),
            farmName: l.farmName ?? '',
            name: l.name ?? '',
            sampleType: l.sampleType ?? '',
            animalType: l.animalType ?? '',
        }));
    }, year);
}

/** 미리보기까지 간 뒤 "가져오기"를 눌러 저장한다 */
async function importAll(page) {
    await nextBtn(page).click();
    await expect(modalOf(page)).toBeHidden();
}

test.describe('퇴비 엑셀 가져오기 전 구간 (SLS-1-268)', () => {
    test.beforeEach(async ({ page }) => {
        await openCompost(page);
    });

    test('1. 파일을 선택하면 가져오기 모달이 1단계로 열린다', async ({ page }) => {
        await uploadSheet(page, HEADERS, [['1', ...ROW_A]]);
        await expect(page.locator('#excelImportStep1')).toBeVisible();
        await expect(page.locator('#excelImportStep2')).toBeHidden();
        await expect(page.locator('#excelImportStep3')).toBeHidden();
        // 기본 접수일자가 채워져 있어야 step1 검증을 통과한다 (:73-77)
        await expect(page.locator('#importDate')).not.toHaveValue('');
    });

    test('2. 컬럼 매핑이 자동으로 실제 필드를 가리킨다', async ({ page }) => {
        await uploadSheet(page, HEADERS, [['1', ...ROW_A]]);
        await nextBtn(page).click();
        await expect(page.locator('#excelImportStep2')).toBeVisible();

        const area = page.locator('#columnMappingArea');
        await expect(area.locator('.mapping-row')).toHaveCount(HEADERS.length);

        // ⚠️ 행 개수만 세면 자동매핑이 **전부 비어 있어도 통과**한다. 선택값을 정확히 본다.
        const expected = {
            0: 'receptionNumber', 1: 'farmName', 2: 'name', 3: 'sampleType',
            4: 'animalType', 5: 'rawMaterials', 6: 'productionDate', 7: 'purpose', 8: 'note',
        };
        for (const [idx, field] of Object.entries(expected)) {
            await expect(
                area.locator(`.mapping-select[data-col-idx="${idx}"]`),
                `${HEADERS[idx]} 열이 ${field}로 매핑되지 않았다`
            ).toHaveValue(field);
        }
    });

    test('3. 미리보기에 행과 값이 그대로 나온다', async ({ page }) => {
        await uploadSheet(page, HEADERS, [['1', ...ROW_A], ['2', ...ROW_B]]);
        await advanceToPreview(page);

        await expect(page.locator('#previewTableBody tr')).toHaveCount(2);
        await expect(page.locator('#previewSummary')).toContainText('2건');

        // ⚠️ 첫 행만 보면 **두 행 모두 1번 레코드를 렌더해도 통과**한다.
        //    행별 매핑이 실제로 다른지 보려면 두 행을 다 읽어야 한다.
        //    previewColumns 순서: 접수번호, 접수일자, 농장명, 대표자, 시료종류, 축종, 원료, 비고
        const col = (n) => page.locator(`#previewTableBody tr td:nth-child(${n})`).allTextContents();
        expect(await col(1)).toEqual(['1', '2']);            // 접수번호
        expect(await col(3)).toEqual(['봉화농장', '영주농장']);  // 농장명
        expect(await col(4)).toEqual(['홍길동', '김영수']);      // 대표자
        expect(await col(5)).toEqual(['가축분퇴비', '가축분퇴비']);
        expect(await col(6)).toEqual(['소', '돼지']);           // 축종
    });

    test('4. 가져오기를 누르면 새로고침 후에도 레코드가 남는다', async ({ page }) => {
        await uploadSheet(page, HEADERS, [['1', ...ROW_A], ['2', ...ROW_B]]);
        await advanceToPreview(page);
        await importAll(page);

        const persisted = await readPersisted(page);
        expect(persisted).toHaveLength(2);
        expect(persisted.map((r) => r.farmName)).toEqual(['봉화농장', '영주농장']);
        expect(persisted.map((r) => r.name)).toEqual(['홍길동', '김영수']);
        expect(persisted.map((r) => r.animalType)).toEqual(['소', '돼지']);
    });

    test('5. 접수번호가 없으면 1,2,3으로 자동 채번되고 미리보기와 저장이 일치한다', async ({ page }) => {
        await uploadSheet(page, HEADERS_NO_NUM, [ROW_A, ROW_B, ROW_C]);
        await advanceToPreview(page);

        // 미리보기가 보여주는 번호 (수정 전 soil에서는 여기가 1,2,3인데 저장은 1,1,1이었다)
        expect(await previewNumbers(page)).toEqual(['1', '2', '3']);

        await importAll(page);
        const persisted = await readPersisted(page);
        expect(persisted.map((r) => r.receptionNumber)).toEqual(['1', '2', '3']);
    });

    test('6. 엑셀에 접수번호가 있으면 그 번호가 보존된다', async ({ page }) => {
        await uploadSheet(page, HEADERS, [['101', ...ROW_A], ['102', ...ROW_B]]);
        await advanceToPreview(page);
        expect(await previewNumbers(page)).toEqual(['101', '102']);

        await importAll(page);
        const persisted = await readPersisted(page);
        expect(persisted.map((r) => r.receptionNumber)).toEqual(['101', '102']);
    });

    test('7. 접수번호가 일부 행에만 있으면 나머지는 빈 채로 저장된다 (현재 동작)', async ({ page }) => {
        // ⚠️ 이것은 **현재 동작을 고정**하는 테스트다. 개선이 아니라 기록이다.
        //    excel-import-manager.js:370의 `.some()`은 한 행만 번호가 있어도
        //    배치 전체의 자동 채번을 건너뛴다 → 나머지 행은 빈 접수번호로 저장된다.
        //    고칠 때 이 테스트가 빨개지면서 "무엇이 바뀌는지"를 드러내는 것이 목적이다.
        await uploadSheet(page, HEADERS, [['201', ...ROW_A], ['', ...ROW_B]]);
        await advanceToPreview(page);
        expect(await previewNumbers(page)).toEqual(['201', '']);

        await importAll(page);
        const persisted = await readPersisted(page);
        // ⚠️ 저장 후 순서가 미리보기와 **뒤집힌다.** compost-script.js:2397의 정렬이
        //    `parseInt('') || 0` → 0으로 보아 빈 번호를 목록 맨 앞에 놓기 때문이다.
        //    번호가 빈 채로 남는 것과 별개인 두 번째 증상이라 농장명으로 짝지어 단언한다.
        expect(persisted.map((r) => ({ farmName: r.farmName, receptionNumber: r.receptionNumber })))
            .toEqual([
                { farmName: '영주농장', receptionNumber: '' },
                { farmName: '봉화농장', receptionNumber: '201' },
            ]);
    });

    test('8. 서식 다운로드가 동작한다', async ({ page }) => {
        // #downloadTemplateBtn은 모달 step1 **안**에 있다 — 먼저 모달을 열어야 한다.
        await uploadSheet(page, HEADERS, [['1', ...ROW_A]]);
        await expect(page.locator('#excelImportStep1')).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.click('#downloadTemplateBtn'),
        ]);
        expect(download.suggestedFilename()).toBe('퇴액비_가져오기_서식.xlsx');

        // ⚠️ 파일명만 보면 **빈 파일이거나 헤더가 틀려도 통과**한다.
        //    사용자는 이 서식에 맞춰 입력하므로 헤더가 곧 계약이다 — 내용을 읽어 확인한다.
        const saved = await download.path();
        expect(saved, '다운로드 파일 경로를 얻지 못했다').toBeTruthy();
        const wb = XLSX.readFile(saved);
        expect(wb.SheetNames).toEqual(['퇴액비시료']);
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets['퇴액비시료'], { header: 1, defval: '' });
        expect(aoa[0]).toEqual(HEADERS);
        // 예시 행이 있어야 사용자가 형식을 안다 (templateConfig.sampleRow)
        expect(aoa[1][0]).toBe('1');
        expect(aoa[1][1]).toBe('봉화농장');
    });
});
