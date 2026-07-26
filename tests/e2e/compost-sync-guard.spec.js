// 퇴비 검정결과 동기화 가드 (SLS-1-196)
//
// 배경: syncCompostTestResultsFromFirestore()가 병합 후 saveLogs()를 호출했는데,
//       saveLogs()는 전건 batchSave이고 문서마다 updatedAt: serverTimestamp()가 찍힌다.
//       onYearChange는 매 페이지 로드마다 호출되므로 "열기만 해도 전 문서의 updatedAt이 갱신"되어
//       타 기기 병합이 교란됐다. BaseSampleManager.js:417-418이 명시적으로 금지한 패턴이다.
//
// ⚠️ 픽스처 규약 (1차 리뷰 반려 사유)
//   - 클라우드 updatedAt은 **Firestore Timestamp 객체** `{seconds, nanoseconds}`다.
//     firestore-db가 serverTimestamp()로 덮어쓰고 getAll이 변환 없이 반환하기 때문.
//     ISO 문자열 픽스처를 쓰면 실제로는 죽어 있는 비교식을 통과시켜 거짓 안전감을 준다.
//   - judgment/testResult의 실제 도메인은 `'' | 'pass' | 'fail'`이다('적합'/'부적합'은 표시용).
//
// 전제: `npm run build` 후 docs/ 산출물 필요.
const { test, expect } = require('@playwright/test');

const YEAR = new Date().getFullYear();
const ts = (iso) => ({ seconds: Math.floor(new Date(iso).getTime() / 1000), nanoseconds: 0 });

/**
 * firestoreDb를 스텁하고 동기화를 1회 실행한다.
 * 반환: saveLogs 호출 횟수 + 저장 페이로드 + getAll 호출 횟수 + 최종 logs
 */
async function runSync(page, { cloudResults, logs, localResults = null, yearLoaded = true }) {
    return await page.evaluate(async ({ cloudResults, logs, localResults, yearLoaded, year }) => {
        const m = window.compostManager;

        let getAllCalls = 0;
        window.firestoreDb = {
            isEnabled: () => true,
            getAll: async () => { getAllCalls++; return cloudResults; },
            delete: async () => {},
            batchSave: async () => {}
        };

        const savedPayloads = [];
        m.saveLogs = function () {
            // 실제 오염 지점은 batchSave의 페이로드이므로 무엇이 저장되는지 기록한다
            savedPayloads.push(JSON.parse(JSON.stringify(this.sampleLogs)));
        };

        m.selectedYear = String(year);
        m.sampleLogs = JSON.parse(JSON.stringify(logs));
        m._cachedCompostResults = null;
        // 로드 완료 플래그 — 경합 가드가 실제로 동작하는지 검증하기 위해 주입한다
        m._yearDataLoaded = yearLoaded ? String(year) : null;

        const lsKey = `compostTestResults_${year}`;
        if (localResults) localStorage.setItem(lsKey, JSON.stringify(localResults));
        else localStorage.removeItem(lsKey);

        await m.syncCompostTestResultsFromFirestore();

        const result = {
            getAllCalls,
            saveLogsCalls: savedPayloads.length,
            savedPayloads,
            logs: JSON.parse(JSON.stringify(m.sampleLogs)),
            stored: JSON.parse(localStorage.getItem(lsKey) || 'null')
        };
        // own property 제거 → 프로토타입 메서드 복원.
        // 현재는 beforeEach의 page.goto가 매번 새 페이지를 만들어 오염이 없지만,
        // beforeAll로 바뀌거나 한 테스트에서 두 번 호출하면 즉시 문제가 된다.
        delete m.saveLogs;
        return result;
    }, { cloudResults, logs, localResults, yearLoaded, year: YEAR });
}

test.describe('퇴비 검정결과 동기화 가드 (SLS-1-196)', () => {
    test.beforeEach(async ({ page }) => {
        const res = await page.goto('/compost/');
        expect(res && res.status(), 'docs/compost/ 없음 — `npm run build && npm test` 순서로 실행할 것')
            .toBeLessThan(400);
        await page.waitForFunction(() => !!window.compostManager, { timeout: 10000 });
    });

    test('클라우드 값이 로컬과 동일하면 저장하지 않는다 (전건 재업로드 차단)', async ({ page }) => {
        const out = await runSync(page, {
            cloudResults: [
                { id: 'c1', _resultKey: 'c1', judgment: 'pass', moisture: '55', maturity: '부숙완료',
                  updatedAt: ts('2026-07-01T00:00:00Z') }
            ],
            logs: [
                { id: 'c1', receptionNumber: '101', name: '홍길동',
                  testResult: 'pass', moisture: '55', maturity: '부숙완료' }
            ]
        });
        // 함수가 실제로 진행했음을 먼저 고정한다 (early return으로 인한 공허한 통과 방지)
        expect(out.getAllCalls).toBe(1);
        expect(out.stored).not.toBeNull();
        // 값이 그대로이므로 저장이 발동하면 안 된다
        expect(out.saveLogsCalls).toBe(0);
    });

    test('클라우드 값이 다르면 저장하고 해당 필드만 갱신한다', async ({ page }) => {
        const out = await runSync(page, {
            cloudResults: [
                { id: 'c1', _resultKey: 'c1', judgment: 'fail', moisture: '55',
                  updatedAt: ts('2026-07-01T00:00:00Z') }
            ],
            logs: [
                { id: 'c1', receptionNumber: '101', name: '홍길동',
                  testResult: 'pass', moisture: '55', maturity: '부숙완료' }
            ]
        });
        expect(out.saveLogsCalls).toBe(1);
        expect(out.logs[0].testResult).toBe('fail');       // 변경됨
        expect(out.logs[0].moisture).toBe('55');            // 동일
        expect(out.logs[0].maturity).toBe('부숙완료');      // 클라우드에 없으므로 보존
        // 저장 페이로드에 실제로 반영됐는지
        expect(out.savedPayloads[0][0].testResult).toBe('fail');
    });

    test('Firestore Timestamp 객체 비교가 동작한다 (클라우드 최신 → 채택)', async ({ page }) => {
        // 이 테스트가 이 파일의 존재 이유 중 하나다.
        // ISO 픽스처를 쓰면 비교식이 죽어 있어도 통과했다.
        const out = await runSync(page, {
            cloudResults: [
                { id: 'c1', _resultKey: 'c1', judgment: 'fail', updatedAt: ts('2026-07-20T00:00:00Z') }
            ],
            localResults: {
                c1: { judgment: 'pass', updatedAt: '2026-07-01T00:00:00.000Z' }
            },
            logs: [{ id: 'c1', receptionNumber: '101', testResult: 'pass' }]
        });
        // 클라우드가 더 최신이므로 채택돼야 한다
        expect(out.stored.c1.judgment).toBe('fail');
    });

    test('로컬 검정결과가 더 최신이면 클라우드가 이기지 못한다', async ({ page }) => {
        const out = await runSync(page, {
            cloudResults: [
                { id: 'c1', _resultKey: 'c1', judgment: 'fail', updatedAt: ts('2026-07-01T00:00:00Z') }
            ],
            localResults: {
                c1: { judgment: 'pass', updatedAt: '2026-07-20T00:00:00.000Z' }
            },
            logs: [{ id: 'c1', receptionNumber: '101', testResult: 'pass' }]
        });
        expect(out.stored.c1.judgment).toBe('pass');
    });

    test('인라인 편집이 더 최신이면 되돌려지지 않는다 (MAJOR-1 회귀 가드)', async ({ page }) => {
        // toggleTestResult 등은 log.updatedAt만 갱신하고 검정결과 저장소는 건드리지 않는다.
        // 저장소를 무조건 승자로 두면 사용자 편집이 매 로드마다 되돌려지고,
        // 그 때문에 saveLogs()가 매 로드 발동해 전건 재업로드가 영구 반복된다.
        const out = await runSync(page, {
            cloudResults: [
                { id: 'c1', _resultKey: 'c1', judgment: 'pass', updatedAt: ts('2026-07-01T00:00:00Z') }
            ],
            logs: [
                // 사용자가 방금 '미판정'으로 토글 → log.updatedAt이 더 최신
                { id: 'c1', receptionNumber: '101', testResult: '',
                  updatedAt: '2026-07-20T00:00:00.000Z' }
            ]
        });
        expect(out.logs[0].testResult).toBe('');   // 편집 보존
        expect(out.saveLogsCalls).toBe(0);          // 저장 미발동 = 전건 재업로드 없음
    });

    test('연도 데이터 로드 전이면 시료 동기화를 건너뛴다 (경합 가드)', async ({ page }) => {
        const out = await runSync(page, {
            cloudResults: [
                { id: 'c1', _resultKey: 'c1', judgment: 'fail', updatedAt: ts('2026-07-01T00:00:00Z') }
            ],
            // 매칭되는 로그가 있는데도 로드 미완료이므로 건드리면 안 된다
            logs: [{ id: 'c1', receptionNumber: '101', testResult: 'pass' }],
            yearLoaded: false
        });
        expect(out.getAllCalls).toBe(1);            // 함수는 진행했고
        expect(out.stored).not.toBeNull();          // 검정결과 자체는 저장했으며
        expect(out.logs[0].testResult).toBe('pass'); // 시료는 건드리지 않았다
        expect(out.saveLogsCalls).toBe(0);
    });

    test('검정결과 자체는 시료 동기화를 건너뛰어도 로컬에 저장된다', async ({ page }) => {
        const out = await runSync(page, {
            cloudResults: [
                { id: 'c1', _resultKey: 'c1', judgment: 'pass', updatedAt: ts('2026-07-01T00:00:00Z') }
            ],
            logs: [],
            yearLoaded: false
        });
        expect(out.stored.c1.judgment).toBe('pass');
    });

    test('loadYearData 오버라이드가 게이트를 실제로 연다 (프로덕션 배선 검증)', async ({ page }) => {
        // 다른 테스트는 _yearDataLoaded를 주입만 하므로, 오버라이드를 삭제해도 전부 통과한다.
        // 그런데 오버라이드가 사라지면 플래그가 영원히 undefined가 되어
        // 시료 동기화 기능 전체가 조용히 죽는다. 그 배선을 여기서 고정한다.
        const flag = await page.evaluate(async ({ year }) => {
            const m = window.compostManager;
            window.firestoreDb = { isEnabled: () => false };  // 로컬 경로로 단축
            m._yearDataLoaded = undefined;
            await m.loadYearData(String(year));
            return m._yearDataLoaded;
        }, { year: YEAR });
        expect(flag).toBe(String(YEAR));
    });

    test('연도가 바뀐 뒤 도착한 응답은 폐기된다 (교차 연도 오염 차단)', async ({ page }) => {
        // getAll이 대기하는 사이 사용자가 다른 연도로 전환하면, 늦게 온 응답이
        // 새 연도의 저장소·컬렉션을 오염시킬 수 있다.
        const out = await page.evaluate(async ({ year }) => {
            const m = window.compostManager;
            const staleYear = year - 1;
            let saveLogsCalls = 0;
            m.saveLogs = function () { saveLogsCalls++; };
            m.selectedYear = String(staleYear);
            m._yearDataLoaded = String(year);
            m.sampleLogs = [{ id: 'c1', testResult: 'pass' }];

            window.firestoreDb = {
                isEnabled: () => true,
                getAll: async () => {
                    // 응답이 도착하는 사이 사용자가 연도를 바꿨다
                    m.selectedYear = String(year);
                    return [{ id: 'c1', _resultKey: 'c1', judgment: 'fail',
                              updatedAt: { seconds: 1782000000, nanoseconds: 0 } }];
                },
                delete: async () => {}, batchSave: async () => {}
            };
            localStorage.removeItem(`compostTestResults_${year}`);
            await m.syncCompostTestResultsFromFirestore();
            return {
                saveLogsCalls,
                testResult: m.sampleLogs[0].testResult,
                stored: localStorage.getItem(`compostTestResults_${year}`)
            };
        }, { year: YEAR });

        // 이전 연도 응답이므로 어느 것도 건드리지 않아야 한다
        expect(out.stored).toBeNull();
        expect(out.testResult).toBe('pass');
        expect(out.saveLogsCalls).toBe(0);
    });

    test("판정 ''(미판정)도 1급 상태로 동기화된다", async ({ page }) => {
        // judgment는 '' 자체가 "미판정"이라는 유효 상태다. falsy라고 무시하면
        // 타 기기에서 판정을 지운 것이 전파되지 않는다.
        const out = await runSync(page, {
            cloudResults: [
                { id: 'c1', _resultKey: 'c1', judgment: '', updatedAt: ts('2026-07-20T00:00:00Z') }
            ],
            logs: [{ id: 'c1', receptionNumber: '101', testResult: 'pass' }]
        });
        expect(out.logs[0].testResult).toBe('');
        expect(out.saveLogsCalls).toBe(1);
        // 호출 횟수뿐 아니라 실제로 무엇이 저장되는지도 고정한다
        expect(out.savedPayloads[0][0].testResult).toBe('');
    });
});
