// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * 성토 행 엑셀 가져오기 접수번호 회귀 (SLS-1-222)
 *
 * 수정 전 증상: 구분='성토' 행을 가져오면 미리보기는 1,2,3인데 실제로는 1,1,1이
 * 저장되고, 이후 일반 접수의 자동채번이 영구히 1번에 고정됐다.
 *
 * 이 스펙이 단정하는 방식이 중요하다 — 단위 테스트는 순수 계층만 덮고,
 * `sampleLogs`(메모리 배열)만 읽거나 `not.toBe('')` 수준으로 단정하면
 * **전 레코드가 '1'이어도 통과한다**. 실제로 테스트 프로젝트에서 75건이 전부
 * 통과하는 상태로 이 결함이 새어나갔다. 그래서:
 *   - 새로고침 후 localStorage를 읽어 지속성까지 확인한다
 *   - 접수번호 유일성과 **실제 번호값**을 정확 일치로 단정한다
 */

const PASTE_HEADER = '성명\t연락처\t지번주소\t작물\t면적\t구분\t목적';

/** 저장된 레코드를 localStorage에서 읽는다 (메모리 배열이 아니라) */
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
            subCategory: l.subCategory ?? '',
        }));
    });
}

/** 접수번호가 모두 채워져 있고 중복이 없는지 */
function expectUniqueReceptionNumbers(records) {
    const nums = records.map((r) => r.receptionNumber);
    for (const n of nums) {
        expect(n).not.toBe('');
        expect(n).not.toBe('null');
        expect(n).not.toBe('undefined');
    }
    expect(new Set(nums).size, `접수번호 중복: ${nums.join(', ')}`).toBe(nums.length);
}

/** 모달을 열고 붙여넣기 모드로 데이터를 입력한 뒤 자동매핑까지 수행 */
async function pasteAndAutoMap(page, dataRows) {
    await page.click('#soilImportBtn');
    const modal = page.locator('#soilImporterModal');
    await expect(modal).toBeVisible();
    await modal.locator('input[name="sriMode"][value="paste"]').check();
    await modal.locator('[data-el="textarea"]').fill([PASTE_HEADER, ...dataRows].join('\n'));
    await modal.locator('[data-act="automap"]').click();
    return modal;
}

/** 미리보기 표의 접수번호 열(2번째 셀) */
function previewNumbers(modal) {
    return modal.locator('.sri-pv-table tbody tr td:nth-child(2)').allTextContents();
}

test.describe('성토 행 가져오기 접수번호 (SLS-1-222)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/soil/');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
        await page.evaluate(() => localStorage.clear());
    });

    test('구분=성토 행은 F 접두 시퀀스로 채번되고 중복되지 않는다', async ({ page }) => {
        const modal = await pasteAndAutoMap(page, [
            '성토1\t010-1111-1111\t봉화읍 내성리 1\t-\t100\t성토\t일반재배',
            '성토2\t010-2222-2222\t봉화읍 내성리 2\t-\t200\t성토\t일반재배',
            '성토3\t010-3333-3333\t봉화읍 내성리 3\t-\t300\t성토\t일반재배',
        ]);

        // 미리보기가 F 접두를 보여준다 (수정 전에는 1, 2, 3)
        expect(await previewNumbers(modal)).toEqual(['F1', 'F2', 'F3']);

        await modal.locator('[data-act="import"]').click();
        await expect(modal).toBeHidden();

        const persisted = await readPersisted(page);
        expect(persisted).toHaveLength(3);
        expect(persisted.every((s) => s.subCategory === '성토')).toBe(true);
        expectUniqueReceptionNumbers(persisted);
        // 미리보기가 보여준 번호와 실제 저장 번호가 같아야 한다 (수정 전에는 1, 1, 1)
        expect(persisted.map((s) => s.receptionNumber)).toEqual(['F1', 'F2', 'F3']);
    });

    test('가져오기 후에도 일반 자동채번이 1번에 고정되지 않는다', async ({ page }) => {
        // 수정 전에는 성토 레코드가 일반 풀에서 제외돼 카운터가 전진하지 않았다
        const modal = await pasteAndAutoMap(page, [
            '성토1\t010-1111-1111\t봉화읍 내성리 1\t-\t100\t성토\t일반재배',
            '일반1\t010-2222-2222\t봉화읍 내성리 2\t벼\t200\t논\t일반재배',
        ]);
        expect(await previewNumbers(modal)).toEqual(['F1', '1']);
        await modal.locator('[data-act="import"]').click();
        await expect(modal).toBeHidden();

        // 저장 후 일반 다음번호는 2여야 한다 (수정 전에는 1로 고정)
        const next = await page.evaluate(() =>
            window.soilManager.getNextNumberForClass(window.soilManager.selectedYear, '농가의뢰'),
        );
        expect(next).toBe(2);
    });

    test('일반·성토가 섞인 배치도 각자의 시퀀스로 채번된다', async ({ page }) => {
        const modal = await pasteAndAutoMap(page, [
            '일반A\t010-1111-1111\t봉화읍 내성리 1\t벼\t100\t논\t일반재배',
            '성토A\t010-2222-2222\t봉화읍 내성리 2\t-\t200\t성토\t일반재배',
            '일반B\t010-3333-3333\t봉화읍 내성리 3\t고추\t300\t밭\t일반재배',
            '성토B\t010-4444-4444\t봉화읍 내성리 4\t-\t400\t성토\t일반재배',
        ]);
        expect(await previewNumbers(modal)).toEqual(['1', 'F1', '2', 'F2']);

        await modal.locator('[data-act="import"]').click();
        await expect(modal).toBeHidden();

        const persisted = await readPersisted(page);
        expectUniqueReceptionNumbers(persisted);
        expect(persisted.map((s) => s.receptionNumber)).toEqual(['1', 'F1', '2', 'F2']);
    });

    test('기존 레코드가 있으면 두 시퀀스가 각자 이어진다', async ({ page }) => {
        // beforeEach가 저장소를 비우므로 여기서만 시드해
        // "빈 저장소에서만 통과하는 테스트" 사각지대를 덮는다
        await page.evaluate(() => {
            const year = window.soilManager.selectedYear;
            localStorage.setItem(`soilSampleLogs_${year}`, JSON.stringify([
                { id: 'seed-1', receptionNumber: '7', name: '기존일반', landClass1: '농가의뢰', subCategory: '논', parcels: [] },
                { id: 'seed-2', receptionNumber: 'F4', name: '기존성토', landClass1: '농가의뢰', subCategory: '성토', parcels: [] },
            ]));
        });
        // 매니저는 init 시점에 저장소를 읽으므로 새로고침해야 메모리에 반영된다
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => (window.soilManager?.sampleLogs || []).length === 2);

        const modal = await pasteAndAutoMap(page, [
            '신규일반\t010-1111-1111\t봉화읍 내성리 9\t벼\t100\t논\t일반재배',
            '신규성토\t010-2222-2222\t봉화읍 내성리 10\t-\t200\t성토\t일반재배',
        ]);
        // 기존 최대 일반 7 → 8, 기존 최대 성토 F4 → F5
        expect(await previewNumbers(modal)).toEqual(['8', 'F5']);

        await modal.locator('[data-act="import"]').click();
        await expect(modal).toBeHidden();

        const persisted = await readPersisted(page);
        expectUniqueReceptionNumbers(persisted);
        expect(persisted.map((s) => s.receptionNumber).sort()).toEqual(['7', '8', 'F4', 'F5']);
    });

    test('성토 행의 수동 번호가 기존 일반 번호와 겹치면 등록되지 않는다', async ({ page }) => {
        // 리뷰 회귀: 중복 판정 풀을 시퀀스별로 나눴다가 이 충돌을 놓쳐
        // 같은 접수번호가 두 건 저장됐다. 폼 등록 경로는 시퀀스 무관하게 막는다.
        await page.evaluate(() => {
            const year = window.soilManager.selectedYear;
            localStorage.setItem(`soilSampleLogs_${year}`, JSON.stringify([
                { id: 's1', receptionNumber: '1', name: '기존1', landClass1: '농가의뢰', subCategory: '논', parcels: [] },
                { id: 's2', receptionNumber: '2', name: '기존2', landClass1: '농가의뢰', subCategory: '논', parcels: [] },
            ]));
        });
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => (window.soilManager?.sampleLogs || []).length === 2);

        // 접수번호 컬럼을 매핑해 수동 번호 경로를 태운다
        await page.click('#soilImportBtn');
        const modal = page.locator('#soilImporterModal');
        await expect(modal).toBeVisible();
        await modal.locator('input[name="sriMode"][value="paste"]').check();
        await modal.locator('[data-el="textarea"]').fill([
            '접수번호\t성명\t지번주소\t구분',
            '1\t성토A\t봉화읍 내성리 1\t성토',
            '2\t성토B\t봉화읍 내성리 2\t성토',
        ].join('\n'));
        await modal.locator('[data-act="automap"]').click();
        // 자동부여 체크를 해제해 매핑된 수동 번호를 쓰게 한다
        await modal.locator('[data-el="autoNumber"]').uncheck();

        await expect(modal.locator('.sri-pill.dup')).toContainText('중복 2');
        await expect(modal.locator('[data-act="import"]')).toBeDisabled();

        // 기본 정책(건너뛰기)에서 한 건도 등록되지 않고 대장이 그대로여야 한다
        const persisted = await readPersisted(page);
        expect(persisted.map((s) => s.receptionNumber)).toEqual(['1', '2']);
        expectUniqueReceptionNumbers(persisted);
    });

    test('일반 행만 가져오면 기존 동작이 유지된다 (회귀 방지)', async ({ page }) => {
        const modal = await pasteAndAutoMap(page, [
            '홍길동\t010-1111-2222\t봉화읍 내성리 123\t벼\t1200\t논\t일반재배',
            '김철수\t010-3333-4444\t물야면 오전리 45\t고추\t800\t밭\t일반재배',
        ]);
        expect(await previewNumbers(modal)).toEqual(['1', '2']);

        await modal.locator('[data-act="import"]').click();
        await expect(modal).toBeHidden();

        const persisted = await readPersisted(page);
        expect(persisted.map((s) => s.name)).toEqual(['홍길동', '김철수']);
        expectUniqueReceptionNumbers(persisted);
        expect(persisted.map((s) => s.receptionNumber)).toEqual(['1', '2']);
    });
});
