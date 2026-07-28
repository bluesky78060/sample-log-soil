// 퇴비 미판정 감지 수단 (SLS-1-203)
//
// SLS-1-202에서 자동 판정을 없앴다(사용자 요청). 그 전에는 autoJudgeCompost의 hasData
// 게이트가 "측정값이 하나라도 있으면 판정을 비우지 않는다"를 보장했다. 안전망이
// 사라졌으니 미판정 레코드가 실제로 늘어나는데, 알아챌 수단이 목록 배지 '-' 하나뿐이었다.
// 부숙도 판정은 규제 대응 기록이라 누락의 대가가 작지 않다.
//
// 사용자 지시(2026-07-28)로 "접수 엑셀에 판정 컬럼 추가"는 취소됐다.
// 남은 수단은 전부 화면 안에서 미판정을 드러낸다.
const { test, expect } = require('@playwright/test');

const YEAR = String(new Date().getFullYear());

const log = (over = {}) => ({
    id: 'c1', receptionNumber: '101', date: `${YEAR}-07-01`,
    name: '홍길동', farmName: '가나농장',
    sampleType: '가축분퇴비', animalType: '돼지',
    isComplete: false, ...over
});

async function seed(page, logs, results = null) {
    await page.evaluate(({ year, logs, results }) => {
        const m = window.compostManager;
        m.selectedYear = year;
        m.sampleLogs = JSON.parse(JSON.stringify(logs));
        localStorage.setItem(`compostSampleLogs_${year}`, JSON.stringify(logs));
        if (results) {
            localStorage.setItem(`compostTestResults_${year}`, JSON.stringify(results));
        } else {
            localStorage.removeItem(`compostTestResults_${year}`);
        }
        m._cachedCompostResults = null;
        m.filterAndRenderLogs();
    }, { year: YEAR, logs, results });
}

/** 모달을 열고 어느 판정 라디오가 선택됐는지 본다 */
async function openModalJudgment(page, id) {
    return page.evaluate((id) => {
        window.compostManager.openCompostAnalysisModal(id);
        return document.querySelector('input[name="caJudgment"]:checked')?.value ?? null;
    }, id);
}

test.describe('퇴비 판정 가시성 (SLS-1-203)', () => {
    test.beforeEach(async ({ page }) => {
        const res = await page.goto('/compost/');
        expect(res && res.status(), 'docs/compost/ 없음 — `npm run build && npm test` 순서로 실행할 것')
            .toBeLessThan(400);
        await page.waitForFunction(() => !!window.compostManager, { timeout: 10000 });
    });

    // ───────── D: 모달 판정 시드 ─────────

    // 🚨 1차 경로 — 검정결과 레코드가 아예 없는 경우
    test('배지로만 판정한 시료의 모달이 그 판정을 보여준다', async ({ page }) => {
        await seed(page, [log({ testResult: 'pass' })]);
        expect(await openModalJudgment(page, 'c1')).toBe('pass');
    });

    test('배지 판정이 모달 저장으로 되돌아가지 않는다', async ({ page }) => {
        await seed(page, [log({ testResult: 'fail' })]);
        const after = await page.evaluate(async () => {
            const m = window.compostManager;
            m.openCompostAnalysisModal('c1');
            m.showToast = () => {};
            // 판정은 손대지 않고 검사일자만 입력해 저장 — 실무에서 가장 흔한 흐름
            document.getElementById('caTestDate').value = '2026-07-20';
            await m.saveCompostAnalysis();
            return m.sampleLogs[0].testResult;
        });
        expect(after).toBe('fail');   // '' 로 덮이면 사용자가 매긴 판정이 사라진다
    });

    test('레코드가 명시적 미판정이면 배지 값으로 덮지 않는다', async ({ page }) => {
        // existing.judgment === '' 는 "사용자가 미판정을 골랐다"는 의사표시다.
        // 검정결과 레코드가 판정의 권위 있는 저장소이고, log.testResult는 레코드가
        // 아예 없을 때만 쓰는 폴백이다.
        //
        // 두 값이 어긋난 상태로 시드한다 — SLS-1-203 이전에 쓰인 데이터의 모습이다.
        // ?? 대신 || 를 쓰면 빈 문자열이 falsy라 배지 값('pass')이 되살아난다.
        await seed(page, [log({ testResult: 'pass' })], { c1: { id: 'c1', judgment: '', moisture: '60' } });
        expect(await openModalJudgment(page, 'c1')).toBe('');
    });

    // 🚨 2차 경로 (플랜 리뷰 MAJOR-2) — 미판정 레코드가 있는 상태에서 배지로 판정
    test('미판정 레코드가 있어도 배지 판정이 모달에 반영된다', async ({ page }) => {
        await seed(page, [log({ testResult: '' })], { c1: { id: 'c1', judgment: '', moisture: '60' } });
        const r = await page.evaluate(() => {
            const m = window.compostManager;
            m.toggleTestResult('c1');            // '' → 'pass'
            m.openCompostAnalysisModal('c1');
            return {
                badge: m.sampleLogs[0].testResult,
                radio: document.querySelector('input[name="caJudgment"]:checked')?.value,
                record: m.loadAllCompostTestResults().c1.judgment,
            };
        });
        expect(r.badge).toBe('pass');
        expect(r.radio).toBe('pass');    // 동기화 없으면 ''이 되어 저장 시 판정이 사라진다
        expect(r.record).toBe('pass');   // 레코드가 항상 최신 — 단방향 동기화의 근본 해결
    });

    test('레코드가 없으면 배지 토글이 레코드를 만들지 않는다', async ({ page }) => {
        // 만들면 검정값이 텅 빈 레코드가 생겨 "결과확인" 라벨이 켜지고,
        // 사용자는 입력한 적 없는 결과가 있다고 오해한다.
        await seed(page, [log()]);
        const rec = await page.evaluate(() => {
            window.compostManager.toggleTestResult('c1');
            return window.compostManager.loadAllCompostTestResults().c1;
        });
        expect(rec).toBeUndefined();
    });

    // 🚨 코드리뷰 MAJOR — 레코드 저장이 실패하면 배지만 바뀌어 두 저장소가 어긋난다
    test('레코드 저장이 실패하면 배지도 되돌리고 알린다', async ({ page }) => {
        await seed(page, [log({ testResult: '' })], { c1: { id: 'c1', judgment: '', moisture: '60' } });
        const r = await page.evaluate(() => {
            const m = window.compostManager;
            const toasts = [];
            m.showToast = (msg, type) => toasts.push({ msg, type });
            m.saveAllCompostTestResults = () => false;   // quota 초과 재현
            m.toggleTestResult('c1');
            return {
                badge: m.sampleLogs[0].testResult,
                record: m.loadAllCompostTestResults().c1.judgment,
                toasts,
            };
        });
        // 배지와 레코드가 어긋난 채 남으면 안 된다 — 규제 대응 기록이다
        expect(r.badge).toBe('');
        expect(r.record).toBe('');
        expect(r.toasts).toHaveLength(1);
        expect(r.toasts[0].type).toBe('error');
    });

    // ───────── E: 판정 순환 ─────────

    test('배지 토글이 미판정 → 적합 → 부적합 → 미판정으로 돈다', async ({ page }) => {
        await seed(page, [log()]);
        const seq = await page.evaluate(() => {
            const m = window.compostManager;
            const out = [];
            for (let i = 0; i < 4; i++) {
                m.toggleTestResult('c1');
                out.push(m.sampleLogs[0].testResult);
            }
            return out;
        });
        expect(seq).toEqual(['pass', 'fail', '', 'pass']);
    });

    // ───────── A: 통계 3분할 ─────────

    test('통계가 적합·부적합·미판정을 나누고 합이 전체와 같다', async ({ page }) => {
        await seed(page, [
            log({ id: 'a', testResult: 'pass' }),
            log({ id: 'b', testResult: 'pass' }),
            log({ id: 'c', testResult: 'fail' }),
            log({ id: 'd', testResult: '' }),
            log({ id: 'e' }),                       // testResult 자체가 없는 레거시
        ]);
        const r = await page.evaluate(() => {
            window.compostManager.showStatistics();
            const n = (id) => document.getElementById(id).textContent;
            return {
                total: n('statTotalCount'), pass: n('statPassCount'),
                fail: n('statFailCount'), none: n('statUnjudgedCount'),
                passRate: n('statPassRate'),
            };
        });
        expect(r.pass).toBe('2');
        expect(r.fail).toBe('1');
        expect(r.none).toBe('2');    // 빈 문자열 + 키 없음 둘 다 미판정
        expect(Number(r.pass) + Number(r.fail) + Number(r.none)).toBe(Number(r.total));
        expect(r.passRate).toBe('40.0%');
    });

    // ───────── B: 판정 필터 ─────────

    test('판정 필터가 각 값에서 올바른 부분집합을 남긴다', async ({ page }) => {
        await seed(page, [
            log({ id: 'a', receptionNumber: '101', testResult: 'pass' }),
            log({ id: 'b', receptionNumber: '102', testResult: 'fail' }),
            log({ id: 'c', receptionNumber: '103' }),
        ]);
        const pick = (want) => page.evaluate((want) => {
            const m = window.compostManager;
            m.currentSearchFilter.completed = '';       // 완료 필터 간섭 제거
            m.currentSearchFilter.judgment = want;
            m.filterAndRenderLogs();
            return Array.from(document.querySelectorAll('.maturity-select'))
                .map(el => el.dataset.id).sort();
        }, want);

        expect(await pick('pass')).toEqual(['a']);
        expect(await pick('fail')).toEqual(['b']);
        expect(await pick('none')).toEqual(['c']);
        expect(await pick('')).toEqual(['a', 'b', 'c']);   // 빈 값은 전체
    });

    test('공유 파일을 고치지 않고 훅으로 붙였다', async ({ page }) => {
        // filterAndRenderLogs는 BaseSampleManager(토양과 공유)에 있다.
        // 판정 필터는 matchesTypeSpecificFilters 오버라이드로만 들어가야 한다.
        const own = await page.evaluate(() =>
            Object.prototype.hasOwnProperty.call(
                Object.getPrototypeOf(window.compostManager), 'matchesTypeSpecificFilters'));
        expect(own).toBe(true);
    });

    // ───────── C: 미판정 완료 경고 ─────────

    test('판정 없이 완료하면 알리되 막지는 않는다', async ({ page }) => {
        await seed(page, [log()]);
        const r = await page.evaluate(() => {
            const m = window.compostManager;
            const toasts = [];
            m.showToast = (msg, type) => toasts.push({ msg, type });
            m.toggleComplete('c1');
            return { toasts, isComplete: m.sampleLogs[0].isComplete };
        });
        expect(r.isComplete).toBe(true);            // 동작은 그대로 수행된다
        expect(r.toasts).toHaveLength(1);
        expect(r.toasts[0].type).toBe('warning');
        expect(r.toasts[0].msg).toContain('판정');
    });

    test('판정이 있으면 완료해도 경고하지 않는다', async ({ page }) => {
        await seed(page, [log({ testResult: 'pass' })]);
        const toasts = await page.evaluate(() => {
            const m = window.compostManager;
            const out = [];
            m.showToast = (msg, type) => out.push({ msg, type });
            m.toggleComplete('c1');
            return out;
        });
        expect(toasts).toHaveLength(0);
    });

    test('완료를 해제할 때는 경고하지 않는다', async ({ page }) => {
        await seed(page, [log({ isComplete: true })]);
        const toasts = await page.evaluate(() => {
            const m = window.compostManager;
            const out = [];
            m.showToast = (msg, type) => out.push({ msg, type });
            m.toggleComplete('c1');   // true → false
            return out;
        });
        expect(toasts).toHaveLength(0);
    });
});
