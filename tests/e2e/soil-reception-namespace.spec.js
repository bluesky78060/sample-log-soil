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
                // 진짜 중복은 표기 완전일치다 ('5'와 '5-1'은 정상 서브넘버라 중복이 아니다)
                { id: 'c', receptionNumber: '5', name: '중복1', subCategory: '논', landClass1: '농가의뢰' },
                { id: 'd', receptionNumber: '5', name: '중복2', subCategory: '논', landClass1: '농가의뢰' },
                // 정상 서브넘버 — 오탐되면 안 된다
                { id: 'e', receptionNumber: '8', name: '다작물', subCategory: '논', landClass1: '농가의뢰' },
                { id: 'f', receptionNumber: '8-1', name: '다작물', subCategory: '논', landClass1: '농가의뢰' },
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
                // 한 필지 다작물이 만드는 정상 서브넘버 — 중복으로 오탐되면 안 된다
                { id: 'c', receptionNumber: '2', name: '다작물', subCategory: '논', landClass1: '농가의뢰' },
                { id: 'd', receptionNumber: '2-1', name: '다작물', subCategory: '논', landClass1: '농가의뢰' },
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

    test('신규 등록에서 필지 구분만 성토로 바꿔도 위반 저장이 막힌다', async ({ page }) => {
        // 리뷰 지적(M-2): 검사가 _submitSingleEdit에만 있어 신규 등록·그룹 수정으로
        // 위반 레코드가 계속 만들어졌다. 필지 구분이 권위값이고, 필지 구분 select는
        // 접수번호를 다시 뽑지 않으므로 타이핑 한 번 없이 위반이 생긴다.
        await page.goto('/soil/');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => typeof window.soilManager !== 'undefined');

        // 필수 필드를 전부 채운다 — 하나라도 비면 HTML5 검증이 토스트 없이 막아
        // 테스트가 '잘못된 이유로' 통과한다 (리뷰 지적)
        await page.fill('#name', '홍길동');
        await page.fill('#phoneNumber', '010-1111-2222');
        await page.locator('#purpose').selectOption({ index: 1 });
        await page.evaluate(() => {
            const d = document.getElementById('date');
            if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
            const rm = document.getElementById('receptionMethod');
            if (rm && !rm.value) rm.value = '방문';
        });
        await page.locator('.lot-address-input').first().fill('봉화읍 내성리 1');
        // 상단 구분은 논(기본) → 접수번호는 일반 표기로 자동 부여된다
        const assigned = await page.locator('#receptionNumber').inputValue();
        expect(assigned).not.toMatch(/^F/);

        // 필지 구분만 성토로 바꾼다 — 접수번호는 그대로다
        const parcelCategory = page.locator('.parcel-category-select').first();
        if (await parcelCategory.count() > 0) await parcelCategory.selectOption('성토');

        await page.click('#navSubmitBtn');

        // 차단 사유에 결합한다 — 다른 검증으로 막혀도 통과하면 이 가드를 검증하지 못한다
        await expect(page.locator('.toast-message').last()).toContainText('F로 시작해야 합니다');

        // 저장이 막혀 대장이 비어 있어야 한다
        const count = await page.evaluate(() => (window.soilManager.sampleLogs || []).length);
        expect(count).toBe(0);
    });

    test('이미 위반인 레코드의 정당한 수정은 막지 않는다', async ({ page }) => {
        // 리뷰 지적(M-3): existingLog 비교가 없으면 점검이 찾아준 위반 레코드의
        // 전화번호 오타조차 고칠 수 없다 — 정직한 출구가 없어진다.
        await page.goto('/soil/');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
        await page.evaluate(() => localStorage.clear());
        await seedLedger(page, [{
            id: 'bad-1', receptionNumber: 'F9', name: '위반레코드', phoneNumber: '010-0000-0000',
            date: '2026-08-01', subCategory: '논', purpose: '일반재배',   // ← F인데 구분이 논 (위반)
            landClass1: '농가의뢰', receptionMethod: '방문', note: '',
            groupId: 'g-bad', parcelIndex: 1, totalParcels: 1,
            lotAddress: '봉화읍 내성리 9', area: '100', cropsDisplay: '벼',
            parcels: [{ id: 'p1', lotAddress: '봉화읍 내성리 9', isMountain: false, subLots: [],
                        crops: [{ name: '벼', area: '100' }], category: '논', purpose: '일반재배', note: '' }],
        }]);

        await page.click('.nav-btn[data-view="list"]');
        await page.click('.btn-edit');
        await expect(page.locator('#receptionNumber')).toHaveValue('F9');

        // 접수번호·구분은 그대로 두고 전화번호만 고친다
        await page.fill('#phoneNumber', '010-9999-8888');
        await page.click('#navSubmitBtn');
        await page.waitForTimeout(500);

        // 저장이 되어야 한다 (위반은 원래도 있었고 이 수정이 만든 것이 아니다)
        const saved = await page.evaluate(() =>
            (window.soilManager.sampleLogs || []).map((l) => ({ no: String(l.receptionNumber), tel: l.phoneNumber })));
        expect(saved).toEqual([{ no: 'F9', tel: '010-9999-8888' }]);
    });

    test('그룹 편집으로 위반 건수가 늘면 구분이 같아도 막는다', async ({ page }) => {
        // 재리뷰 2 지적(MAJOR): "악화 없음" 예외가 `wasOffending`을 **구분의 Set**으로
        // 비교해, 위반 레코드가 1건 → 2건으로 늘어도 구분은 여전히 '성토' 하나라
        // 통과했다. 주석은 "새로 만들거나 늘렸을 때만 차단"인데 늘어난 것을 못 봤다.
        await page.goto('/soil/');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
        await page.evaluate(() => localStorage.clear());
        await seedLedger(page, [{
            id: 'bad-1', receptionNumber: '3', name: '손상', subCategory: '성토',   // ← F 없는데 성토 (위반)
            landClass1: '농가의뢰', groupId: 'g-bad', parcelIndex: 1, totalParcels: 1, parcels: [],
        }]);

        /** 그룹 수정 중 상태로 두고 필지 구성만 바꿔 검사한다 */
        const check = (parcels) => page.evaluate((ps) => {
            const mgr = window.soilManager;
            mgr.editingLogId = null;
            mgr.editingGroupId = 'g-bad';
            mgr.editingGroupLogs = mgr.sampleLogs.filter((l) => l.groupId === 'g-bad');
            const fd = new FormData();
            fd.set('receptionNumber', '3');
            fd.set('subCategory', '성토');
            return mgr._checkReceptionNamespace(ps, fd);
        }, parcels);

        const one = (crops) => ({ category: '성토', crops: crops.map((name) => ({ name })) });

        // 필지 1개·작물 1개 — 위반 건수가 그대로(1건)다. 정당한 수정이므로 허용해야 한다
        expect(await check([one(['벼'])])).toBe(true);

        // 필지 2개 — 저장되면 위반이 2건이 된다. 악화이므로 막아야 한다
        expect(await check([one(['벼']), one(['콩'])])).toBe(false);
    });

    test('작물 분할까지 세어 위반 레코드 증가를 막는다', async ({ page }) => {
        // 재리뷰 2-2 지적(MAJOR): 위반 **필지** 수를 대장의 **레코드** 수와 비교하면
        // 단위가 어긋난다. 한 필지의 작물이 2개 이상이면 `_buildLogsForParcels`가
        // 작물마다 레코드를 만들기 때문이다(`useSubNumbers` 분기).
        await page.goto('/soil/');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
        await page.evaluate(() => localStorage.clear());
        // 위반 필지 1개 × 작물 2개 = 기존 위반 **레코드 2건** ('3'과 '3-1')
        await seedLedger(page, [
            { id: 'bad-1', receptionNumber: '3', subCategory: '성토', landClass1: '농가의뢰', groupId: 'g-bad', parcels: [] },
            { id: 'bad-2', receptionNumber: '3-1', subCategory: '성토', landClass1: '농가의뢰', groupId: 'g-bad', parcels: [] },
        ]);

        const check = (parcels) => page.evaluate((ps) => {
            const mgr = window.soilManager;
            mgr.editingLogId = null;
            mgr.editingGroupId = 'g-bad';
            mgr.editingGroupLogs = mgr.sampleLogs.filter((l) => l.groupId === 'g-bad');
            const fd = new FormData();
            fd.set('receptionNumber', '3');
            fd.set('subCategory', '성토');
            return mgr._checkReceptionNamespace(ps, fd);
        }, parcels);

        const twoCrops = () => ({ category: '성토', crops: [{ name: '벼' }, { name: '콩' }] });

        // 필지 1개 × 작물 2개 = 레코드 2건 — 그대로다. 허용
        expect(await check([twoCrops()])).toBe(true);

        // 필지 2개 × 작물 2개 = 레코드 4건 — 2건 → 4건 악화다. 차단해야 한다.
        // 필지 수만 세면 2 <= 2가 되어 그냥 통과했다.
        expect(await check([twoCrops(), twoCrops()])).toBe(false);
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
