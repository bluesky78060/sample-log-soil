// @ts-check
// SLS-1-226: 엑셀로 가져온 건이 라벨에 실제로 인쇄되는가
//
// 🚨 신고 증상: 엑셀로 가져온 건을 라벨 인쇄하면 **이름만 나오고 주소·우편번호가 빈다.**
//    원인은 라벨 함수가 log.address만 읽는데 가져오기는 addressRoad만 채웠기 때문.
//
// ⚠️ label-render.spec.js:1-8의 교훈을 따른다 —
//    "클릭 없이 본문 텍스트만 확인하면 #labelDataTable의 <td>에 매치되어 통과하므로
//     주소·우편번호 누락을 하나도 잡지 못한다."
//    → 반드시 #btnGenerateLabels를 누르고 #labelModalSheet .label-item 안을 단언한다.
//
// 이 스펙은 **접수 목록에서 시작한다.** 그게 실제 결함 경로이고,
// openLabelPrintWithData가 넘긴 데이터가 라벨 셀까지 살아서 도착하는지를 본다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const YEAR = new Date().getFullYear();
const KEY = `soilSampleLogs_${YEAR}`;
const ROAD = '경상북도 봉화군 봉화읍 내성리 100';

/** 가져오기가 만드는 것과 같은 모양의 레코드 (addressRoad만, address는 빔) */
const IMPORTED = {
    id: 'imp1', receptionNumber: '501', name: '이제식', date: '2026-08-01',
    landClass1: '농가의뢰', subCategory: '밭', purpose: '일반재배',
    lotAddress: '봉화읍 문단리 123-3',
    addressRoad: ROAD,
    addressPostcode: '36628',
    address: '',              // ← 가져오기는 이 칸을 채우지 않는다
    parcels: [{ lotAddress: '봉화읍 문단리 123-3', crops: [{ name: '고추', area: '300' }] }],
};

/** 옛 방식으로 저장된 레코드 (address에 뭉쳐 있음) — 레거시 폴백 확인용 */
const LEGACY = {
    ...IMPORTED, id: 'leg1', receptionNumber: '502', name: '홍길동',
    addressRoad: '', addressPostcode: '',
    address: `(11111) 경상북도 봉화군 봉화읍 문단리 55`,
};

async function seedAndOpenList(page, logs) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.addInitScript(([k, d]) => localStorage.setItem(k, JSON.stringify(d)), [KEY, logs]);
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.click('.nav-btn[data-view="list"]');
    await page.waitForFunction(() => {
        const b = document.querySelector('.btn-edit');
        return b && b.offsetParent !== null;
    }, { timeout: 15000 });
}

/** 라벨 페이지로 넘어간 뒤 실제 라벨 셀을 렌더해 텍스트를 돌려준다 */
async function renderAndReadLabels(page) {
    await page.waitForURL(/label-print/, { timeout: 15000 });
    // 데이터가 실제로 소비됐는지 먼저 고정 (early return으로 인한 공허한 통과 방지)
    await page.waitForFunction(
        () => document.querySelectorAll('#labelDataTable tr').length > 1,
        { timeout: 10000 }
    );
    await page.locator('#btnGenerateLabels').click();
    await page.waitForFunction(
        () => document.querySelectorAll('#labelModalSheet .label-item').length > 0,
        { timeout: 10000 }
    );
    return page.locator('#labelModalSheet .label-item').allInnerTexts();
}

/** 목록에서 전체 선택 → 라벨 인쇄 */
async function printLabels(page) {
    const selectAll = page.locator('#selectAllCheckbox, thead input[type="checkbox"]').first();
    if (await selectAll.count()) {
        await selectAll.check();
    } else {
        for (const cb of await page.locator('.row-checkbox').all()) await cb.check();
    }
    await page.locator('#btnLabelPrint').click();
}

test.describe('가져온 건의 라벨 인쇄 (SLS-1-226)', () => {
    // 🚨 이 티켓의 핵심 — address가 비어도 주소·우편번호가 나와야 한다
    test('엑셀로 가져온 건(address 빈 상태)도 주소·우편번호가 인쇄된다', async ({ page }) => {
        await seedAndOpenList(page, [IMPORTED]);
        await printLabels(page);

        const labels = await renderAndReadLabels(page);
        expect(labels.length, '라벨 셀이 하나도 안 만들어졌다').toBeGreaterThan(0);
        const text = labels.join('\n');

        expect(text, '이름이 없다').toContain('이제식');
        expect(text, '🚨 주소가 비었다 — 신고된 바로 그 증상').toContain(ROAD);
        expect(text, '🚨 우편번호가 비었다').toContain('36628');
    });

    test('옛 방식으로 저장된 건도 그대로 인쇄된다 (레거시 폴백)', async ({ page }) => {
        await seedAndOpenList(page, [LEGACY]);
        await printLabels(page);

        const text = (await renderAndReadLabels(page)).join('\n');
        expect(text).toContain('홍길동');
        expect(text, '레거시 주소가 사라졌다').toContain('봉화읍 문단리 55');
        expect(text, '레거시 우편번호가 사라졌다').toContain('11111');
        // 접두가 주소 본문에 그대로 남으면 안 된다
        expect(text, '(11111)이 주소에 섞여 있다').not.toContain('(11111)');
    });

    test('두 방식이 섞여 있어도 각각 맞게 나온다', async ({ page }) => {
        await seedAndOpenList(page, [IMPORTED, LEGACY]);
        await printLabels(page);

        const text = (await renderAndReadLabels(page)).join('\n');
        for (const expected of ['이제식', ROAD, '36628', '홍길동', '봉화읍 문단리 55', '11111']) {
            expect(text, `'${expected}'가 라벨에 없다`).toContain(expected);
        }
    });
});
