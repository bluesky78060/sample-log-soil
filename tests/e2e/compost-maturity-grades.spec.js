// 부숙도 등급 5종과 면적 기준 판정 (SLS-1-207)
//
// 흙토람 일괄입력 양식이 받는 등급은 미부숙·부숙초기·부숙중기·부숙후기·부숙완료 5종이다
// (compost-heuktoram-export.js:75, 실물 A2 셀에서 추출).
// 이전에는 부숙후기가 빠지고 법령·양식 어디에도 없는 '완전부숙'이 들어 있었다.
//
// 🚨 등급을 하나 끼워 넣으면 뒤쪽 순번이 전부 밀린다. 판정이 순번 숫자를 하드코딩하고
//    있으면 1500㎡ 이상 배출시설에서 **부숙후기가 '부숙완료 이상'을 통과한 것으로
//    오판정된다.** 규제 대응 기록이라 조용한 오보의 대가가 크다.
//    이 파일이 그 회귀를 막는다 — 이전에는 이 경로에 테스트가 하나도 없었다.
const { test, expect } = require('@playwright/test');

const YEAR = String(new Date().getFullYear());
const GRADES = ['미부숙', '부숙초기', '부숙중기', '부숙후기', '부숙완료'];

/** 면적을 지정해 판정 배지를 확인한다. areaSqm은 ㎡. */
async function judge(page, areaSqm, maturity) {
    return page.evaluate(({ areaSqm, maturity }) => {
        const m = window.compostManager;
        m._caAreaSqm = areaSqm;
        const field = { key: 'maturity', label: '부숙도', standard: '' };
        const el = document.createElement('span');
        m.checkCompostFieldStatus(field, maturity, el);
        return el.textContent.trim();
    }, { areaSqm, maturity });
}

test.describe('부숙도 등급 5종 (SLS-1-207)', () => {
    test.beforeEach(async ({ page }) => {
        const res = await page.goto('/compost/');
        expect(res && res.status(), 'docs/compost/ 없음 — `npm run build && npm test` 순서로 실행할 것')
            .toBeLessThan(400);
        await page.waitForFunction(() => !!window.compostManager, { timeout: 10000 });
    });

    test('공유 모듈이 5종을 정의하고 완전부숙은 없다', async ({ page }) => {
        const r = await page.evaluate(() => ({
            options: window.CompostFields.MATURITY_OPTIONS,
            order: window.CompostFields.MATURITY_ORDER,
        }));
        expect(r.options).toEqual(['', ...GRADES]);
        expect(r.order).toEqual({ 미부숙: 0, 부숙초기: 1, 부숙중기: 2, 부숙후기: 3, 부숙완료: 4 });
    });

    test('퇴비·액비 양쪽 항목 정의가 같은 5종을 쓴다', async ({ page }) => {
        const r = await page.evaluate(() => {
            const F = window.CompostFields;
            const pick = (t) => F.getFieldsForSample(t, '돼지')
                .find(f => f.key === 'maturity').options;
            return { compost: pick('가축분퇴비'), liquid: pick('가축분뇨발효액') };
        });
        expect(r.compost).toEqual(['', ...GRADES]);
        expect(r.liquid).toEqual(['', ...GRADES]);
    });

    // 플랜 리뷰 MAJOR: 붙여넣기는 원래도 목록에 없는 값을 받아들였다(즉석 option 추가).
    // 실제 결함은 **드롭다운에서 직접 고를 수 없다**는 것이었으므로 그것을 고정한다.
    test('목록 드롭다운이 5종을 실제 option으로 렌더한다', async ({ page }) => {
        const opts = await page.evaluate(({ year }) => {
            const m = window.compostManager;
            m.selectedYear = year;
            m.sampleLogs = [{
                id: 'c1', receptionNumber: '101', date: `${year}-07-01`,
                name: '홍길동', sampleType: '가축분퇴비', animalType: '돼지',
            }];
            m.filterAndRenderLogs();
            const sel = document.querySelector('.maturity-select');
            return Array.from(sel.options).map(o => o.value);
        }, { year: YEAR });
        expect(opts).toEqual(['', ...GRADES]);
    });

    // 🚨 이 티켓의 회귀 핵심
    test('1500㎡ 이상은 부숙완료만 적합, 부숙후기는 부적합', async ({ page }) => {
        expect(await judge(page, 1500, '부숙완료')).toBe('✓');
        expect(await judge(page, 3000, '부숙완료')).toBe('✓');
        // 순번을 하드코딩하면 여기가 ✓로 뒤집힌다
        expect(await judge(page, 1500, '부숙후기')).toBe('✕');
        expect(await judge(page, 1500, '부숙중기')).toBe('✕');
    });

    test('1500㎡ 미만은 부숙중기 이상이 적합', async ({ page }) => {
        expect(await judge(page, 1499, '부숙중기')).toBe('✓');
        expect(await judge(page, 1499, '부숙후기')).toBe('✓');
        expect(await judge(page, 1499, '부숙완료')).toBe('✓');
        expect(await judge(page, 1499, '부숙초기')).toBe('✕');
        expect(await judge(page, 1499, '미부숙')).toBe('✕');
    });

    test('요구 등급 표기가 판정과 같은 기준에서 나온다', async ({ page }) => {
        const r = await page.evaluate(() => ({
            big: window.CompostFields.maturityStandardFor(1500),
            small: window.CompostFields.maturityStandardFor(1499),
        }));
        expect(r.big).toBe('부숙완료 이상');
        expect(r.small).toBe('부숙중기 이상');
    });

    // 오래된 백업에서 복원된 레거시 값 — 화면과 내보내기가 어긋나면 안 된다
    test('레거시 완전부숙은 부숙완료로 취급된다', async ({ page }) => {
        expect(await page.evaluate(() => window.CompostFields.normalizeMaturity('완전부숙')))
            .toBe('부숙완료');
        expect(await judge(page, 1500, '완전부숙')).toBe('✓');   // 조회 실패로 ✕가 되면 안 된다
    });

    test('알 수 없는 값은 적합으로 통과시키지 않는다', async ({ page }) => {
        expect(await judge(page, 1499, '아무거나')).toBe('✕');
    });
});
