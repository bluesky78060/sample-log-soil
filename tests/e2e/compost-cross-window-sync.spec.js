// 다른 창의 저장소 변경 감지 (SLS-1-206)
//
// 사용자 보고: "흙토람에서 결과 입력한 내용이 목록에서 안 나타난다"
//
// 검정결과 화면은 별도 창이다. 거기서 저장하면 localStorage는 바뀌지만
// 접수 목록 페이지의 메모리 sampleLogs는 그대로라 값이 안 보인다.
// SLS-1-205 코드리뷰 MAJOR-3의 반대 방향 — 그때는 팝업이 낡는 것만 고쳤다.
const { test, expect } = require('@playwright/test');

const YEAR = String(new Date().getFullYear());

const log = (over = {}) => ({
    id: 'c1', receptionNumber: '101', date: `${YEAR}-07-01`,
    name: '홍길동', farmName: '가나농장',
    sampleType: '가축분퇴비', animalType: '돼지',
    isComplete: false, ...over
});

async function open(page, logs) {
    await page.goto('/compost/');
    await page.waitForFunction(() => !!window.compostManager, { timeout: 10000 });
    await page.evaluate(({ year, logs }) => {
        const m = window.compostManager;
        m.selectedYear = year;
        m.sampleLogs = JSON.parse(JSON.stringify(logs));
        localStorage.setItem(`compostSampleLogs_${year}`, JSON.stringify(logs));
        localStorage.removeItem(`compostTestResults_${year}`);
        m._lastLogsRaw = localStorage.getItem(`compostSampleLogs_${year}`);
        m._lastResultsRaw = localStorage.getItem(`compostTestResults_${year}`);
        m.filterAndRenderLogs();
    }, { year: YEAR, logs });
}

/** 검정결과 창이 저장한 상황을 재현 — 이 페이지를 거치지 않고 저장소만 바꾼다 */
async function otherWindowSaves(page, logs) {
    await page.evaluate(({ year, logs }) => {
        localStorage.setItem(`compostSampleLogs_${year}`, JSON.stringify(logs));
    }, { year: YEAR, logs });
}

test.describe('다른 창 변경 감지 (SLS-1-206)', () => {
    test('감지 장치가 배선되어 있다', async ({ page }) => {
        await open(page, [log()]);
        const wired = await page.evaluate(() => ({
            setup: typeof window.compostManager.setupCrossWindowSync === 'function',
            refresh: typeof window.compostManager.refreshFromStorage === 'function',
        }));
        expect(wired.setup).toBe(true);
        expect(wired.refresh).toBe(true);
    });

    // 🚨 이 티켓의 목적
    test('다른 창이 저장한 함수율·부숙도가 목록에 나타난다', async ({ page }) => {
        await open(page, [log()]);
        await otherWindowSaves(page, [log({ moisture: '62.1', maturity: '부숙완료' })]);

        await page.evaluate(() => window.compostManager.refreshFromStorage());

        const shown = await page.evaluate(() => {
            const m = window.compostManager;
            return {
                moisture: m.sampleLogs[0].moisture,
                maturity: m.sampleLogs[0].maturity,
                // 목록 DOM에도 반영됐는가
                domMoisture: document.querySelector('.moisture-input')?.value,
                domMaturity: document.querySelector('.maturity-select')?.value,
            };
        });
        expect(shown.moisture).toBe('62.1');
        expect(shown.maturity).toBe('부숙완료');
        expect(shown.domMoisture).toBe('62.1');
        expect(shown.domMaturity).toBe('부숙완료');
    });

    test('storage 이벤트로도 갱신된다', async ({ page }) => {
        await open(page, [log()]);
        await otherWindowSaves(page, [log({ moisture: '55' })]);

        await page.evaluate((year) => {
            window.dispatchEvent(new StorageEvent('storage', {
                key: `compostSampleLogs_${year}`,
            }));
        }, YEAR);

        expect(await page.evaluate(() => window.compostManager.sampleLogs[0].moisture)).toBe('55');
    });

    test('관계없는 키의 storage 이벤트는 무시한다', async ({ page }) => {
        await open(page, [log()]);
        await otherWindowSaves(page, [log({ moisture: '99' })]);

        await page.evaluate(() => {
            window.dispatchEvent(new StorageEvent('storage', { key: 'soilSampleLogs_2026' }));
        });
        // 갱신되지 않아야 한다
        expect(await page.evaluate(() => window.compostManager.sampleLogs[0].moisture)).toBeUndefined();
    });

    // ⚠️ 폼 편집 중 갱신이 입력을 날리면 안 된다
    test('폼 편집 중에도 입력 내용이 유지된다', async ({ page }) => {
        await open(page, [log()]);
        const kept = await page.evaluate(async ({ year }) => {
            const m = window.compostManager;
            m.editSample('c1');
            document.getElementById('farmName').value = '입력중인농장';

            // 그 사이 다른 창이 저장
            localStorage.setItem(`compostSampleLogs_${year}`,
                JSON.stringify([{ ...m.sampleLogs[0], moisture: '77' }]));
            m.refreshFromStorage();

            return {
                farmName: document.getElementById('farmName').value,
                editingId: m.editingId,
                moisture: m.sampleLogs[0].moisture,
            };
        }, { year: YEAR });

        expect(kept.farmName).toBe('입력중인농장');   // 입력이 살아 있다
        expect(kept.editingId).toBe('c1');            // 편집 상태도 유지
        expect(kept.moisture).toBe('77');             // 목록 데이터는 갱신됨
    });

    test('변경이 없으면 다시 그리지 않는다', async ({ page }) => {
        await open(page, [log()]);
        const calls = await page.evaluate(() => {
            const m = window.compostManager;
            let n = 0;
            const orig = m.filterAndRenderLogs.bind(m);
            m.filterAndRenderLogs = () => { n++; orig(); };
            m.refreshFromStorage();
            m.refreshFromStorage();
            m.refreshFromStorage();
            return n;
        });
        expect(calls).toBe(0);
    });

    test('손상된 JSON이면 기존 데이터를 유지한다', async ({ page }) => {
        await open(page, [log({ moisture: '50' })]);
        await page.evaluate((year) => {
            localStorage.setItem(`compostSampleLogs_${year}`, '{깨진 JSON');
            window.compostManager.refreshFromStorage();
        }, YEAR);

        const logs = await page.evaluate(() => window.compostManager.sampleLogs);
        expect(logs).toHaveLength(1);
        expect(logs[0].moisture).toBe('50');
    });

    // 🚨 코드리뷰 MAJOR-1 — 검정결과만 바뀌는 경로가 있다
    // 검사일자 일괄 적용처럼 함수율·부숙도를 건드리지 않는 저장은 compostSampleLogs를
    // 그대로 두고 compostTestResults만 바꾼다. 접수 데이터만 보고 조기 반환하면
    // 캐시가 안 비워져 버튼 라벨(결과입력/결과확인)이 낡은 채로 남는다.
    test('검정결과만 바뀌어도 캐시가 비워지고 다시 그린다', async ({ page }) => {
        await open(page, [log()]);
        const r = await page.evaluate(({ year }) => {
            const m = window.compostManager;
            m._cachedCompostResults = { 어떤: '낡은캐시' };
            let n = 0;
            const orig = m.filterAndRenderLogs.bind(m);
            m.filterAndRenderLogs = () => { n++; orig(); };

            // 접수 데이터는 손대지 않고 검정결과만 저장 (다른 창이 한 것처럼)
            localStorage.setItem(`compostTestResults_${year}`,
                JSON.stringify({ '101': { testDate: `${year}-07-20` } }));
            m.refreshFromStorage();

            // 렌더가 캐시를 곧바로 다시 채우므로 null이 아니라 "낡은 값이 사라졌는가"를 본다
            return { renders: n, cache: m._cachedCompostResults };
        }, { year: YEAR });

        expect(r.renders).toBe(1);                    // 다시 그렸는가
        expect(r.cache?.어떤).toBeUndefined();        // 낡은 캐시가 버려졌는가
        expect(r.cache?.['101']?.testDate).toBe(`${YEAR}-07-20`);  // 새 검정결과로 채워졌는가
    });

    test('배선 시점에 두 저장소의 기준값이 잡혀 첫 focus가 헛돌지 않는다', async ({ page }) => {
        await page.goto('/compost/');
        await page.waitForFunction(() => !!window.compostManager, { timeout: 10000 });
        const baseline = await page.evaluate(() => {
            const m = window.compostManager;
            return {
                logs: m._lastLogsRaw === localStorage.getItem(m.getStorageKey(m.selectedYear)),
                results: m._lastResultsRaw
                    === localStorage.getItem(`compostTestResults_${m.selectedYear}`),
            };
        });
        expect(baseline.logs).toBe(true);
        expect(baseline.results).toBe(true);
    });

    // 🚨 코드리뷰 MAJOR-2 — 교차 창 갱신이 편집 대상을 지워버릴 수 있다
    test('편집 중이던 항목이 다른 창에서 삭제되면 안내하고 빠져나온다', async ({ page }) => {
        await open(page, [log()]);
        const r = await page.evaluate(async ({ year }) => {
            const m = window.compostManager;
            m.editSample('c1');

            const toasts = [];
            m.showToast = (msg, type) => toasts.push({ msg, type });
            m.saveLogs = () => {};
            m.switchView = () => {};

            // 다른 창이 이 항목을 삭제 → 교차 창 갱신이 반영
            localStorage.setItem(`compostSampleLogs_${year}`, JSON.stringify([]));
            m.refreshFromStorage();

            await m.submitForm(new Event('submit'));
            return { toasts, editingId: m.editingId };
        }, { year: YEAR });

        expect(r.toasts).toHaveLength(1);              // 조용히 무반응이면 안 된다
        expect(r.toasts[0].type).toBe('error');
        expect(r.toasts[0].msg).toContain('삭제된 항목');
        expect(r.editingId).toBeNull();                // 편집 상태에 갇히지 않는다
    });

    test('저장 후에는 기준값이 맞춰져 헛도는 재렌더가 없다', async ({ page }) => {
        await open(page, [log()]);
        const calls = await page.evaluate(async () => {
            const m = window.compostManager;
            m.sampleLogs[0].moisture = '61';
            await m.saveLogs();

            let n = 0;
            const orig = m.filterAndRenderLogs.bind(m);
            m.filterAndRenderLogs = () => { n++; orig(); };
            m.refreshFromStorage();   // 자기가 저장한 내용이 되돌아온 상황
            return n;
        });
        expect(calls).toBe(0);
    });
});
