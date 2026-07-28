// 흙토람 일괄입력용 폼 항목 (SLS-1-200 S1)
//
// 신규 4항목이 저장·편집·초기화 전 경로에서 살아남는지 고정한다.
// 특히 편집 경로: populateTypeSpecificFields에서 빠뜨리면 폼이 비고, 그대로 저장하면
// formData가 빈 문자열을 반환해 **기존 값이 조용히 덮인다**.
// 비료관리법 해당여부가 날아가면 흙토람에서 판정 기준이 바뀐다.
const { test, expect } = require('@playwright/test');

const YEAR = String(new Date().getFullYear());
const NEW_FIELDS = ['samplingDate', 'businessNumber', 'isFarm', 'fertilizerLawApplies'];

test.describe('흙토람 일괄입력용 폼 항목 (SLS-1-200)', () => {
    test.beforeEach(async ({ page }) => {
        const res = await page.goto('/compost/');
        expect(res && res.status(), 'docs/compost/ 없음 — `npm run build && npm test` 순서로 실행할 것')
            .toBeLessThan(400);
        await page.waitForFunction(() => !!window.compostManager, { timeout: 10000 });
    });

    test('신규 4항목이 폼에 존재한다', async ({ page }) => {
        for (const id of NEW_FIELDS) {
            await expect(page.locator(`#${id}`), id).toHaveCount(1);
        }
    });

    test('채취일자와 생산일자가 분리되어 있다', async ({ page }) => {
        // 흙토람 양식은 채취일자(T열)·생산일자(U열)가 별도 열이다.
        // 이전에는 한 칸에 "채취 년 월 일 (생산 년 월 일)"로 합쳐져 있었다.
        await expect(page.locator('#samplingDate')).toHaveCount(1);
        await expect(page.locator('#productionDate')).toHaveCount(1);
        const labels = await page.evaluate(() => ({
            sampling: document.querySelector('label[for="samplingDate"]')?.textContent.trim(),
            production: document.querySelector('label[for="productionDate"]')?.textContent.trim()
        }));
        expect(labels.sampling).toBe('채취 년 월 일');
        expect(labels.production).toBe('생산 년 월 일');
    });

    test('농가여부·비료관리법은 해당/미해당만 고를 수 있다', async ({ page }) => {
        for (const id of ['isFarm', 'fertilizerLawApplies']) {
            const opts = await page.locator(`#${id}`).evaluate(el =>
                Array.from(el.options).map(o => o.value));
            expect(opts, id).toEqual(['', '해당', '미해당']);
        }
    });

    // 🚨 편집 경로 — 4지점 중 가장 놓치기 쉬운 곳
    test('편집 폼이 신규 항목을 채우고, 저장해도 값이 덮이지 않는다', async ({ page }) => {
        const saved = await page.evaluate(async ({ year }) => {
            const m = window.compostManager;
            m.selectedYear = year;
            m.sampleLogs = [{
                id: 'c1', receptionNumber: '101', date: `${year}-07-01`,
                name: '홍길동', farmName: '가나농장',
                sampleType: '가축분퇴비', animalType: '돼지',
                productionDate: `${year}-06-01`,
                samplingDate: `${year}-06-15`,
                businessNumber: '111-11-11111',
                isFarm: '해당',
                fertilizerLawApplies: '미해당'
            }];

            // 편집 모드 진입 → 폼이 채워진다
            m.editSample('c1');
            const filled = {
                samplingDate: document.getElementById('samplingDate').value,
                businessNumber: document.getElementById('businessNumber').value,
                isFarm: document.getElementById('isFarm').value,
                fertilizerLawApplies: document.getElementById('fertilizerLawApplies').value
            };

            // 다른 값만 고치고 저장 — 신규 항목은 손대지 않는다
            document.getElementById('farmName').value = '다라농장';
            m.saveLogs = () => {};
            m.showToast = () => {};
            m.switchView = () => {};
            await m.submitForm(new Event('submit'));

            const log = m.sampleLogs.find(l => l.id === 'c1');
            return { filled, after: {
                samplingDate: log.samplingDate, businessNumber: log.businessNumber,
                isFarm: log.isFarm, fertilizerLawApplies: log.fertilizerLawApplies,
                farmName: log.farmName
            } };
        }, { year: YEAR });

        // 편집 폼이 채워졌는가
        expect(saved.filled.samplingDate).toBe(`${YEAR}-06-15`);
        expect(saved.filled.businessNumber).toBe('111-11-11111');
        expect(saved.filled.isFarm).toBe('해당');
        expect(saved.filled.fertilizerLawApplies).toBe('미해당');

        // 저장 후에도 살아 있는가 — 여기가 조용한 유실이 나던 자리
        expect(saved.after.samplingDate).toBe(`${YEAR}-06-15`);
        expect(saved.after.businessNumber).toBe('111-11-11111');
        expect(saved.after.isFarm).toBe('해당');
        expect(saved.after.fertilizerLawApplies).toBe('미해당');
        expect(saved.after.farmName).toBe('다라농장');   // 의도한 변경은 반영
    });

    // 수정 분기는 Object.assign이라 키를 빼도 기존 값은 보존된다(유실 아님).
    // 대신 **편집한 값이 저장되지 않는** 결함이 되므로 따로 고정한다.
    test('편집 모드에서 신규 항목을 고치면 그 변경이 저장된다', async ({ page }) => {
        const after = await page.evaluate(async ({ year }) => {
            const m = window.compostManager;
            m.selectedYear = year;
            m.sampleLogs = [{
                id: 'c1', receptionNumber: '101', date: `${year}-07-01`,
                name: '홍길동', sampleType: '가축분퇴비', animalType: '돼지',
                samplingDate: `${year}-06-15`, businessNumber: '111-11-11111',
                isFarm: '해당', fertilizerLawApplies: '미해당'
            }];
            m.editSample('c1');

            // 검사자가 신규 항목 자체를 고치는 상황
            document.getElementById('businessNumber').value = '999-99-99999';
            document.getElementById('fertilizerLawApplies').value = '해당';
            document.getElementById('samplingDate').value = `${year}-06-20`;
            document.getElementById('isFarm').value = '미해당';

            m.saveLogs = () => {}; m.showToast = () => {}; m.switchView = () => {};
            await m.submitForm(new Event('submit'));

            const log = m.sampleLogs.find(l => l.id === 'c1');
            return {
                businessNumber: log.businessNumber, fertilizerLawApplies: log.fertilizerLawApplies,
                samplingDate: log.samplingDate, isFarm: log.isFarm
            };
        }, { year: YEAR });

        expect(after.businessNumber).toBe('999-99-99999');
        expect(after.fertilizerLawApplies).toBe('해당');
        expect(after.samplingDate).toBe(`${YEAR}-06-20`);
        expect(after.isFarm).toBe('미해당');
    });

    test('신규 등록에서 값이 저장된다', async ({ page }) => {
        const log = await page.evaluate(async ({ year }) => {
            const m = window.compostManager;
            m.selectedYear = year;
            m.sampleLogs = [];
            m.editingId = null;
            m.saveLogs = () => {};
            m.showToast = () => {};
            m.switchView = () => {};

            document.getElementById('receptionNumber').value = '201';
            document.getElementById('name').value = '홍길동';
            document.getElementById('samplingDate').value = `${year}-07-10`;
            document.getElementById('businessNumber').value = '222-22-22222';
            document.getElementById('isFarm').value = '미해당';
            document.getElementById('fertilizerLawApplies').value = '해당';

            await m.submitForm(new Event('submit'));
            return m.sampleLogs[0];
        }, { year: YEAR });

        expect(log.samplingDate).toBe(`${YEAR}-07-10`);
        expect(log.businessNumber).toBe('222-22-22222');
        expect(log.isFarm).toBe('미해당');
        expect(log.fertilizerLawApplies).toBe('해당');
    });

    test('resetForm이 신규 항목을 비운다', async ({ page }) => {
        const after = await page.evaluate(() => {
            const m = window.compostManager;
            document.getElementById('samplingDate').value = '2026-01-01';
            document.getElementById('businessNumber').value = '333-33-33333';
            document.getElementById('isFarm').value = '해당';
            document.getElementById('fertilizerLawApplies').value = '해당';
            m.resetForm();
            return {
                samplingDate: document.getElementById('samplingDate').value,
                businessNumber: document.getElementById('businessNumber').value,
                isFarm: document.getElementById('isFarm').value,
                fertilizerLawApplies: document.getElementById('fertilizerLawApplies').value
            };
        });
        expect(after).toEqual({
            samplingDate: '', businessNumber: '', isFarm: '', fertilizerLawApplies: ''
        });
    });
});
