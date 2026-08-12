// @ts-nocheck
const { test, expect } = require('@playwright/test');

/**
 * 접수번호 네임스페이스 불변식 (SLS-1-223)
 *
 * `F` 접두 ⟺ 구분='성토'. 이 불변식이 깨진 레코드는 채번 풀 분류가 어긋나
 * 조용한 중복의 원인이 된다. 두 경로를 검증한다:
 *   1) 수정 화면에서 구분만 바꿔 불변식을 깨는 저장 → 차단
 *   2) 설정 화면의 정합성 점검 → 위반·중복을 찾아 보여준다
 */

/** 대장을 심고 매니저가 읽도록 새로고침한다 */
async function seedLedger(page, logs) {
    await page.evaluate((rows) => {
        const year = window.soilManager.selectedYear;
        localStorage.setItem(`soilSampleLogs_${year}`, JSON.stringify(rows));
    }, logs);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction((n) => (window.soilManager?.sampleLogs || []).length === n, logs.length);
}

test.describe('접수번호 네임스페이스 불변식 (SLS-1-223)', () => {
    test('설정 화면 정합성 점검이 위반과 중복을 찾는다', async ({ page }) => {
        await page.goto('/settings/');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => typeof window.ReceptionNumber !== 'undefined');

        const year = new Date().getFullYear();
        await page.evaluate((y) => {
            localStorage.setItem(`soilSampleLogs_${y}`, JSON.stringify([
                { id: 'a', receptionNumber: '3', name: '위반1', subCategory: '성토', landClass1: '농가의뢰' },
                { id: 'b', receptionNumber: 'F9', name: '위반2', subCategory: '논', landClass1: '농가의뢰' },
                { id: 'c', receptionNumber: '5', name: '중복1', subCategory: '논', landClass1: '농가의뢰' },
                { id: 'd', receptionNumber: '5-1', name: '중복2', subCategory: '논', landClass1: '농가의뢰' },
            ]));
        }, year);

        await page.click('#auditReceptionBtn');
        const result = page.locator('#auditReceptionResult');
        await expect(result).toContainText('규칙 위반 2건');
        await expect(result).toContainText('중복 번호 1건');
        await expect(result).toContainText('F로 시작하지 않음');
        await expect(result).toContainText('구분이 성토가 아님');
        await expect(result).toContainText('확인 필요');
    });

    test('정상 대장에서는 이상 없음으로 보고한다', async ({ page }) => {
        await page.goto('/settings/');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => typeof window.ReceptionNumber !== 'undefined');

        const year = new Date().getFullYear();
        await page.evaluate((y) => {
            localStorage.clear();
            localStorage.setItem(`soilSampleLogs_${y}`, JSON.stringify([
                { id: 'a', receptionNumber: '1', name: '정상1', subCategory: '논', landClass1: '농가의뢰' },
                { id: 'b', receptionNumber: 'F1', name: '정상2', subCategory: '성토', landClass1: '농가의뢰' },
            ]));
        }, year);

        await page.click('#auditReceptionBtn');
        await expect(page.locator('#auditReceptionResult')).toContainText('이상 없음');
    });

    test('수정 화면에서 구분만 바꿔 불변식을 깨는 저장은 막힌다', async ({ page }) => {
        // 이 화면은 접수번호와 구분을 독립적으로 받는다. 구분만 성토→논으로 바꾸면
        // 원본 F1이 남아 불변식이 깨진 레코드가 만들어진다 — 조용한 중복의 씨앗이다.
        await page.goto('/soil/');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
        await page.evaluate(() => localStorage.clear());
        await seedLedger(page, [{
            id: 'fill-1', receptionNumber: 'F1', name: '성토시료', phoneNumber: '010-1111-2222',
            date: '2026-08-01', subCategory: '성토', purpose: '일반재배',
            landClass1: '농가의뢰', receptionMethod: '-', note: '',
            groupId: 'g1', parcelIndex: 1, totalParcels: 1,
            lotAddress: '봉화읍 내성리 1', area: '100', cropsDisplay: '-',
            parcels: [{ id: 'p1', lotAddress: '봉화읍 내성리 1', isMountain: false, subLots: [],
                        crops: [], category: '성토', purpose: '일반재배', note: '' }],
        }]);

        await page.click('.nav-btn[data-view="list"]');
        await page.click('.btn-edit');
        await expect(page.locator('#receptionNumber')).toHaveValue('F1');

        // 구분을 성토가 아닌 값으로 바꾼다 (필지 구분이 우선하므로 그쪽을 바꾼다)
        const parcelCategory = page.locator('.parcel-category-select').first();
        if (await parcelCategory.count() > 0) {
            await parcelCategory.selectOption('논');
        }
        await page.locator('#subCategory').selectOption('논');

        await page.click('#navSubmitBtn');
        await page.waitForTimeout(500);

        // 저장이 막히고 대장이 그대로여야 한다
        const after = await page.evaluate(() =>
            (window.soilManager.sampleLogs || []).map((l) => ({ no: String(l.receptionNumber), sub: l.subCategory })));
        expect(after).toEqual([{ no: 'F1', sub: '성토' }]);
    });

    test('가져오기 자동채번이 손상 레코드의 번호를 재발급하지 않는다', async ({ page }) => {
        // 표기 기준 네임스페이스의 핵심 효과 — 구분 기준이던 시절에는
        // 성토 '3'이 두 풀 어디에도 없어 일반 자동채번이 '3'을 다시 부여했다
        await page.goto('/soil/');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
        await page.evaluate(() => localStorage.clear());
        await seedLedger(page, [
            { id: 'bad', receptionNumber: '3', name: '손상', subCategory: '성토', landClass1: '농가의뢰', parcels: [] },
        ]);

        const next = await page.evaluate(() =>
            window.soilManager.getNextNumberForClass(window.soilManager.selectedYear, '농가의뢰'));
        expect(next).toBe(4);   // 손상 전에는 1이 나와 '3'과 충돌했다

        const nextFill = await page.evaluate(() =>
            window.soilManager.generateNextFillReceptionNumber('농가의뢰'));
        expect(nextFill).toBe('F1');   // 표기가 일반이므로 성토 시퀀스는 비어 있다
    });
});
