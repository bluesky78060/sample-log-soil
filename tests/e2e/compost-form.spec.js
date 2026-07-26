// 퇴비 접수 스모크 (SLS-1-195)
//
// 목적: SLS-1-192에서 base로 백포트한 필터 계층이 **실제로 동작하는지** 보증한다.
//
// ⚠️ 단언은 반드시 음성(0건/사라짐)이어야 한다.
//    M-1(filterAndRenderLogs 무력화)은 "아무것도 거르지 않는" 결함이므로,
//    "필터를 걸면 레코드가 보인다"는 양성 단언은 정상 코드와 파손 코드 양쪽에서 통과한다.
//    백포트 이전 base 구현(this.renderLogs(this.sampleLogs))에서 이 파일은 실패해야 한다.
//
// 전제: `npm run build` 후 docs/ 산출물 필요 (webServer가 docs/를 8888로 서빙).
//       미빌드 상태를 즉시 드러내기 위해 goto 응답 상태를 첫 단언으로 둔다.
const { test, expect } = require('@playwright/test');

const YEAR = new Date().getFullYear();

// 결정적 시드 3건 — 이름/접수번호/날짜/완료상태가 서로 구분되도록 구성
const SEED = [
    { id: 'c1', receptionNumber: '101', date: `${YEAR}-03-10`, name: '홍길동', phoneNumber: '010-1111-1111', isComplete: false },
    { id: 'c2', receptionNumber: '202', date: `${YEAR}-06-20`, name: '김철수', phoneNumber: '010-2222-2222', isComplete: false },
    { id: 'c3', receptionNumber: '303', date: `${YEAR}-09-30`, name: '이영희', phoneNumber: '010-3333-3333', isComplete: false }
];

async function seedAndRender(page, filter = {}) {
    return await page.evaluate(({ seed, filter }) => {
        const m = window.compostManager;
        m.sampleLogs = JSON.parse(JSON.stringify(seed));
        m.currentSearchFilter = {
            dateFrom: '', dateTo: '', name: '',
            receptionFrom: '', receptionTo: '', completed: '',
            ...filter
        };
        m.switchView && m.switchView('list');
        m.filterAndRenderLogs();
        return document.querySelectorAll('#logTableBody tr').length;
    }, { seed: SEED, filter });
}

test.describe('퇴비 접수 스모크 (SLS-1-195)', () => {
    test.beforeEach(async ({ page }) => {
        const res = await page.goto('/compost/');
        // 미빌드 감지 — docs/compost/가 없으면 여기서 즉시 실패한다
        expect(res && res.status(), 'docs/compost/ 없음 — `npm run build && npm test` 순서로 실행할 것')
            .toBeLessThan(400);
        await page.waitForFunction(() => !!window.compostManager, { timeout: 10000 });
    });

    test('페이지가 로드되고 매니저가 초기화된다', async ({ page }) => {
        const info = await page.evaluate(() => ({
            moduleKey: window.compostManager.moduleKey,
            storageKey: window.compostManager.storageKey,
            hasFilterMatchers: typeof window.compostManager.matchesNameFilter === 'function'
                && typeof window.compostManager.matchesReceptionFilter === 'function'
                && typeof window.compostManager.matchesDateFilter === 'function'
                && typeof window.compostManager.matchesCompletedFilter === 'function'
        }));
        expect(info.moduleKey).toBe('compost');
        expect(info.storageKey).toBe('compostSampleLogs');
        // 192 백포트가 실제로 이 페이지에 도달했는지
        expect(info.hasFilterMatchers).toBe(true);
    });

    test('필터가 비어 있으면 전건이 렌더된다 (기준선)', async ({ page }) => {
        expect(await seedAndRender(page)).toBe(3);
    });

    test('저장 키가 메인 통계 패널이 읽는 키와 일치한다', async ({ page }) => {
        // main-stats.js는 compostSampleLogs_{year}를 읽는다. 저장 키가 어긋나면
        // 페이지 안에서는 정상인데 메인 통계만 조용히 비어 있게 된다.
        const stored = await page.evaluate(({ seed }) => {
            const m = window.compostManager;
            m.sampleLogs = JSON.parse(JSON.stringify(seed));
            m.saveLogs();
            const raw = localStorage.getItem(`compostSampleLogs_${m.selectedYear}`);
            return raw ? JSON.parse(raw).length : -1;
        }, { seed: SEED });
        expect(stored).toBe(3);
    });

    // --- 이하 4개가 이 파일의 존재 이유 ---

    test('성명 필터 — 일치하지 않는 이름은 0건 (음성)', async ({ page }) => {
        expect(await seedAndRender(page, { name: '존재하지않는이름' })).toBe(0);
    });

    test('성명 필터 — 일치하는 이름만 남는다', async ({ page }) => {
        expect(await seedAndRender(page, { name: '김철수' })).toBe(1);
    });

    test('접수번호 범위 — 범위 밖은 0건 (음성)', async ({ page }) => {
        expect(await seedAndRender(page, { receptionFrom: '900', receptionTo: '999' })).toBe(0);
    });

    test('접수번호 범위 — 범위 안만 남는다', async ({ page }) => {
        expect(await seedAndRender(page, { receptionFrom: '200', receptionTo: '250' })).toBe(1);
    });

    test('날짜 범위 — 범위 밖은 0건 (음성)', async ({ page }) => {
        expect(await seedAndRender(page, {
            dateFrom: `${YEAR + 1}-01-01`, dateTo: `${YEAR + 1}-12-31`
        })).toBe(0);
    });

    test('날짜 범위 — 범위 안만 남는다', async ({ page }) => {
        expect(await seedAndRender(page, {
            dateFrom: `${YEAR}-06-01`, dateTo: `${YEAR}-06-30`
        })).toBe(1);
    });

    test('완료 필터 — 완료 처리하면 incomplete 목록에서 사라지고 completed에서 나타난다', async ({ page }) => {
        // 전건 미완료 상태에서 incomplete 필터 = 3건
        expect(await seedAndRender(page, { completed: 'incomplete' })).toBe(3);

        // 1건을 완료 처리
        const afterComplete = await page.evaluate(() => {
            const m = window.compostManager;
            m.sampleLogs[0].isComplete = true;
            m.filterAndRenderLogs();
            return document.querySelectorAll('#logTableBody tr').length;
        });
        expect(afterComplete).toBe(2); // incomplete 필터에서 사라짐 (음성)

        // completed 필터로 전환하면 그 1건이 나타남
        const asCompleted = await page.evaluate(() => {
            const m = window.compostManager;
            m.currentSearchFilter.completed = 'completed';
            m.filterAndRenderLogs();
            return document.querySelectorAll('#logTableBody tr').length;
        });
        expect(asCompleted).toBe(1);
    });

    test('복수 조건이 AND로 결합된다', async ({ page }) => {
        // 이름은 홍길동(101, 3월)인데 접수번호 범위는 202대 → 교집합 0건
        expect(await seedAndRender(page, {
            name: '홍길동', receptionFrom: '200', receptionTo: '250'
        })).toBe(0);
    });

    test('검색어 대문자 입력도 정상 동작한다 (매처 내부 정규화)', async ({ page }) => {
        // SLS-1-192 코드리뷰 MINOR-6: 소문자 정규화를 호출부에 전가하면
        // 대문자 입력 시 조용히 0건이 된다. base 매처가 정규화하는지 확인.
        const count = await page.evaluate(({ seed }) => {
            const m = window.compostManager;
            m.sampleLogs = JSON.parse(JSON.stringify(seed));
            m.sampleLogs[0].name = 'Hong';
            m.currentSearchFilter = {
                dateFrom: '', dateTo: '', name: 'HONG',
                receptionFrom: '', receptionTo: '', completed: ''
            };
            m.filterAndRenderLogs();
            return document.querySelectorAll('#logTableBody tr').length;
        }, { seed: SEED });
        expect(count).toBe(1);
    });

    test('등록 결과 엑셀 내보내기가 배선되어 있다 (SLS-1-194 M-1)', async ({ page }) => {
        // 195 이식에서 마크업만 넘어오고 핸들러가 누락돼 등록 직후 모달의 주 강조 버튼이
        // 무반응이었다. 버튼 → 메서드 → XLSX 배관까지 실제로 이어지는지 고정한다.
        // 주의: XLSX는 번들 스코프에 바인딩되어 window.XLSX 스텁이 닿지 않는다.
        //       따라서 파일 저장 자체가 아니라 "버튼 → 메서드 → 데이터 조립"까지를 고정한다.
        //       M-1은 리스너 누락이었으므로 이 범위로 회귀를 잡을 수 있다.
        const out = await page.evaluate(() => {
            const m = window.compostManager;
            const btn = document.getElementById('exportResultBtn');
            if (!btn) return { error: 'exportResultBtn 없음' };

            const sample = {
                id: 'c1', receptionNumber: '101', date: '2026-07-26', name: '홍길동',
                sampleType: '가축분퇴비', animalType: '소', note: ''
            };
            m.currentRegistrationData = sample;

            // 클릭이 실제로 메서드까지 도달하는지 (리스너 배선 확인)
            let invoked = 0;
            const orig = m.exportRegistrationResult;
            m.exportRegistrationResult = function () { invoked++; };
            btn.click();
            m.exportRegistrationResult = orig;

            return {
                invoked,
                hasMethod: typeof m.exportRegistrationResult === 'function',
                rows: m.buildRegistrationRows(sample),
                inlineDisplay: btn.style.display
            };
        });

        expect(out.error).toBeUndefined();
        expect(out.hasMethod).toBe(true);
        // 숨김 처리로 회피하지 않고 실제로 배선했는지
        expect(out.inlineDisplay).not.toBe('none');
        // 리스너가 붙어 있어야 한다 — M-1의 정확한 회귀 지점
        expect(out.invoked).toBe(1);
        // 화면 표와 엑셀이 공유하는 행 구성
        const labels = out.rows.map((r) => r.label);
        expect(labels).toContain('접수번호');
        expect(labels).toContain('시료종류');
        expect(out.rows.find((r) => r.label === '접수번호').value).toBe('101');
        expect(out.rows.find((r) => r.label === '시료종류').value).toBe('가축분퇴비');
    });

    test('라벨 인쇄 데이터가 스키마에 맞게 생성된다', async ({ page }) => {
        // 192 Open Question: getLabelAddressParts 기본 구현이 전제하는 분리 필드가
        // compost 폼 스키마와 맞는지 미검증이었다.
        const labelData = await page.evaluate(() => {
            const m = window.compostManager;
            localStorage.removeItem('labelPrintData');
            // 페이지 이동을 막고 저장 결과만 확인
            const origHref = Object.getOwnPropertyDescriptor(window.location, 'href');
            m.openLabelPrintWithData([{
                name: '홍길동',
                addressRoad: '경상북도 봉화군 봉화읍 행복로 12',
                addressDetail: '101호',
                addressPostcode: '36231'
            }]);
            if (origHref) { /* no-op: 복원 불필요 */ }
            return JSON.parse(localStorage.getItem('labelPrintData') || '[]');
        });
        expect(labelData).toHaveLength(1);
        expect(labelData[0].name).toBe('홍길동');
        expect(labelData[0].address).toContain('행복로 12');
        expect(labelData[0].address).toContain('101호');
        expect(labelData[0].postalCode).toBe('36231');
    });
});
