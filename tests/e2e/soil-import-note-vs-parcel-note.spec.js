// @ts-check
// SLS-1-241: 비고가 필지 '기타주소'에 함께 저장되던 버그
//
// 🚨 `parcel.note`는 이름만 note다. 실제로는 **주소 필드**이고, 화면뿐 아니라
//    흙토람에 제출하는 파일로 나간다:
//      화면       폼 '기타주소' 입력란 · 목록 '기타주소' 열 · 상세 모달
//      흙토람     dataRow[16] '기타주소'
//      공익직불제  dataRow[C+17] '상세주소'
//    가져오기가 레코드 '비고'를 거기 복사해, 비고 문구가 제출 서류의 주소 칸에 들어갔다.
//
// ⚠️ 메모리 배열(sampleLogs)만 보면 안 된다 — 저장 단계에서 다시 채워져도 통과한다.
//    **새로고침 후 localStorage**를 직접 읽는다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const PASTE_HEADER = '성명\t연락처\t지번주소\t작물\t면적\t구분\t비고';
const NOTE_TEXT = '전화 후 방문 요망';

async function open(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.goto('/soil/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    await page.evaluate(() => localStorage.clear());
}

async function importOneRow(page) {
    await page.click('#soilImportBtn');
    const modal = page.locator('#soilImporterModal');
    await expect(modal).toBeVisible();
    await modal.locator('input[name="sriMode"][value="paste"]').check();
    await modal.locator('[data-el="textarea"]').fill(
        [PASTE_HEADER, `홍길동\t010-1111-1111\t봉화읍 내성리 100\t벼\t1200\t논\t${NOTE_TEXT}`].join('\n')
    );
    await modal.locator('[data-act="automap"]').click();
    await expect.poll(() => page.locator('.sri-pv-table tbody tr').count(), { timeout: 10000 })
        .toBeGreaterThan(0);
    await modal.locator('[data-act="import"]').click();
    await expect(modal).toBeHidden();
}

/** 새로고침 후 저장소에서 직접 읽는다 (메모리 배열이 아니라) */
async function readPersisted(page) {
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    return page.evaluate(() => {
        const year = window.soilManager.selectedYear;
        const raw = localStorage.getItem(`soilSampleLogs_${year}`);
        return (raw ? JSON.parse(raw) : []).map((l) => ({
            name: l.name ?? '',
            note: l.note ?? '',
            parcelNote: l.parcels?.[0]?.note ?? '',
        }));
    });
}

test.describe("가져오기 비고 vs 필지 기타주소 (SLS-1-241)", () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 이 티켓의 증상 — 비고가 기타주소로 새어 나간다
    // ══════════════════════════════════════════════════════════════
    test('비고를 매핑해 가져와도 필지 기타주소는 비어 있다', async ({ page }) => {
        await open(page);
        await importOneRow(page);

        const [rec] = await readPersisted(page);
        expect(rec, '가져오기가 저장되지 않았다').toBeTruthy();

        expect(rec.parcelNote, '비고가 기타주소에 복사됐다 — 제출 파일 주소 칸까지 나간다')
            .toBe('');
        // 🚨 같이 지워 버리면 비고 기능이 죽는다
        expect(rec.note, '레코드 비고까지 지워졌다').toBe(NOTE_TEXT);
    });

    // ⚠️ 행 전체에서 문구를 찾으면 안 된다 — 비고 열에도 같은 문구가 (정상적으로) 있다.
    //    헤더에서 '기타주소' 열 위치를 찾아 **그 셀만** 본다.
    //    (기본 보기에서는 이 열이 CSS로 숨겨져 toBeVisible이 실패하므로 내용으로 판정한다)
    test('목록의 기타주소 셀이 비고 문구로 채워지지 않는다', async ({ page }) => {
        await open(page);
        await importOneRow(page);
        await page.waitForFunction(() => (window.soilManager?.sampleLogs || []).length > 0);

        const cells = await page.evaluate(() => {
            const table = document.querySelector('#logTableBody')?.closest('table');
            const heads = [...(table?.querySelectorAll('thead th') || [])].map((th) => th.textContent.trim());
            const idx = heads.indexOf('기타주소');
            const tr = [...document.querySelectorAll('#logTableBody tr')]
                .find((r) => r.textContent.includes('홍길동'));
            return {
                idx,
                rowFound: !!tr,
                cell: idx >= 0 && tr ? (tr.children[idx]?.textContent ?? '').trim() : null,
            };
        });

        expect(cells.idx, "목록에 '기타주소' 열이 없다 — 헤더가 바뀌었는가").toBeGreaterThanOrEqual(0);
        expect(cells.rowFound, '가져온 행이 목록에 없다').toBe(true);
        expect(cells.cell, '기타주소 셀에 비고 문구가 들어갔다').not.toBe(NOTE_TEXT);
        expect(cells.cell, '기타주소가 비어 있지 않다').toBe('-');
    });

    // 🚨 과잉 수정 방지 — 가져오기가 **다른 레코드의 기타주소를 건드리면 안 된다.**
    //
    // ⚠️ 이 테스트가 덮는 범위를 정확히 적어 둔다. 처음에 계획서에
    //    "폼 경로의 parcel.note까지 비우는 변이를 이 테스트가 잡는다"고 적었는데
    //    **틀렸다** — 변이를 넣어 보니 통과했다. 여기서는 시드 후 가져오기만 하므로
    //    폼 저장·수정 경로(soil-log-record.js:56 / soil-script.js:2261)는 타지 않는다.
    //    그 경로는 이번 변경이 건드리지 않은 곳이라 여기서 다루지 않는다.
    test('가져오기가 기존 레코드의 기타주소를 건드리지 않는다', async ({ page }) => {
        await open(page);
        await page.evaluate(() => {
            const year = window.soilManager.selectedYear;
            localStorage.setItem(`soilSampleLogs_${year}`, JSON.stringify([{
                id: 'seed-1', receptionNumber: '1', name: '기존농가',
                landClass1: '농가의뢰', subCategory: '논', note: '',
                parcels: [{
                    id: 'p1', lotAddress: '봉화읍 내성리 5', subLots: [], crops: [],
                    note: '창고 옆 진입로',   // ← 사용자가 직접 넣은 기타주소
                }],
            }]));
        });
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => (window.soilManager?.sampleLogs || []).length === 1);

        // 가져오기를 한 번 더 해도 기존 레코드는 건드리지 않는다
        await importOneRow(page);

        const persisted = await readPersisted(page);
        const seeded = persisted.find((r) => r.name === '기존농가');
        expect(seeded?.parcelNote, '사용자가 넣은 기타주소를 지웠다').toBe('창고 옆 진입로');
    });
});
