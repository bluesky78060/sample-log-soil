// @ts-check
// SLS-1-239: 흙토람 표기 '직불(일반)'을 표준값 '공익직불제'로 받아들인다
//
// 🚨 유닛으로는 못 잡는 것이 하나 있다. `_recompute()`는 배치에 등장하는 1차를
//    **행 값에서 직접 훑어** 매니저에서 커서를 받는데, 거기서 별칭을 표준값으로
//    맞추지 않으면 `nextNumberByClass['직불(일반)']`을 만들어 놓고 저장은
//    '공익직불제'로 한다. computePreview는 `nextNumberByClass['공익직불제']`를
//    못 찾아 **창에서 고른 1차의 커서로 폴백**한다 — 남의 시퀀스 번호가 나온다.
//
//    유닛 테스트는 `nextNumberByClass`를 **자기가 만들어 넘기므로** 이 배선이
//    끊겨도 통과한다. 그래서 여기서 확인한다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

// 경지구분 1차 열이 있는 붙여넣기 헤더
const HEADER = '성명\t연락처\t지번주소\t작물\t면적\t경지구분 1차\t구분';

async function seedAndOpen(page, logs) {
    await page.goto('/soil/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    await page.evaluate((seed) => {
        localStorage.clear();
        const year = window.soilManager.selectedYear;
        localStorage.setItem(`soilSampleLogs_${year}`, JSON.stringify(seed));
    }, logs);
    // 매니저는 init 시점에 저장소를 읽으므로 새로고침해야 메모리에 반영된다
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
        (n) => (window.soilManager?.sampleLogs || []).length === n,
        logs.length
    );
}

async function pasteAndAutoMap(page, dataRows) {
    await page.click('#soilImportBtn');
    const modal = page.locator('#soilImporterModal');
    await expect(modal).toBeVisible();
    await modal.locator('input[name="sriMode"][value="paste"]').check();
    await modal.locator('[data-el="textarea"]').fill([HEADER, ...dataRows].join('\n'));
    await modal.locator('[data-act="automap"]').click();
    return modal;
}

const previewNumbers = (modal) =>
    modal.locator('.sri-pv-table tbody tr td:nth-child(2)').allTextContents();

async function readPersisted(page) {
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    return page.evaluate(() => {
        const year = window.soilManager.selectedYear;
        const raw = localStorage.getItem(`soilSampleLogs_${year}`);
        return (raw ? JSON.parse(raw) : []).map((l) => ({
            receptionNumber: String(l.receptionNumber ?? ''),
            name: l.name ?? '',
            landClass1: l.landClass1 ?? '',
        }));
    });
}

test.describe("경지구분 1차 '직불(일반)' 별칭 (SLS-1-239)", () => {
    // 🚨 이 스펙의 핵심 — 별칭 행이 **공익직불제 시퀀스**의 번호를 받는가.
    //    창에서 고른 1차(농가의뢰)의 번호가 나오면 배선이 끊긴 것이다.
    test('별칭 행이 공익직불제 시퀀스를 이어받고, 그 번호가 실제로 저장된다', async ({ page }) => {
        await seedAndOpen(page, [
            { id: 's1', receptionNumber: '7', name: '기존직불', landClass1: '공익직불제', subCategory: '논', parcels: [] },
            // 창의 기본 1차(농가의뢰)에 **일부러 멀리 떨어진 번호**를 둔다.
            // 별칭을 안 맞추면 이 시퀀스로 폴백해 51이 나온다.
            { id: 's2', receptionNumber: '50', name: '기존농가', landClass1: '농가의뢰', subCategory: '논', parcels: [] },
        ]);

        const modal = await pasteAndAutoMap(page, [
            '홍길동\t010-1111-1111\t봉화읍 내성리 9\t벼\t100\t직불(일반)\t논',
        ]);

        expect(
            await previewNumbers(modal),
            "별칭을 표준값으로 안 맞춰 남의 시퀀스 커서를 썼다 (51이면 농가의뢰 폴백)"
        ).toEqual(['8']);

        await modal.locator('[data-act="import"]').click();
        await expect(modal).toBeHidden();

        const persisted = await readPersisted(page);
        const added = persisted.find((r) => r.name === '홍길동');
        expect(added, '가져오기가 저장되지 않았다').toBeTruthy();
        // 저장값이 표준값이어야 통계·필터·채번이 '공익직불제'와 하나로 남는다
        expect(added.landClass1, "별칭이 저장값으로 새어 나갔다 — 분류가 갈라진다")
            .toBe('공익직불제');
        expect(added.receptionNumber, '미리보기 번호와 저장 번호가 다르다').toBe('8');
    });

    // 🚨 이 티켓 전에는 서식의 예시값이 그대로 오류 행이 됐다 (사용자 보고 증상).
    test('별칭 행이 오류로 빠지지 않는다', async ({ page }) => {
        await seedAndOpen(page, []);
        const modal = await pasteAndAutoMap(page, [
            '홍길동\t010-1111-1111\t봉화읍 내성리 9\t벼\t100\t직불(일반)\t논',
        ]);

        const body = await modal.locator('.sri-pv-table tbody').innerText();
        expect(body, "'직불(일반)'이 아직 오류로 처리된다").not.toMatch(/알 수 없습니다/);
        await expect(
            modal.locator('[data-act="import"]'),
            '가져오기 버튼이 막혀 있다'
        ).toBeEnabled();
    });
});
