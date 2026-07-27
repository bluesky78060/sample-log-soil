// 접수대장 내보내기 — 경지구분1차별 시트 분리 (SLS-1-199)
//
// 검증 지점: window.XLSX 교체로 writeFile을 가로챈다.
//   soil-script.js는 import가 없어 XLSX가 자유 변수 → 호출 시점에 window.XLSX로 해석된다.
//   ⚠️ 단 window.XLSX는 **모듈 네임스페이스 객체(frozen)** 라서
//   `window.XLSX.writeFile = stub` 프로퍼티 대입은 조용히 무시된다(194 퇴비 프로브가
//   침묵한 실제 원인). 반드시 window.XLSX **객체 자체를** 얕은 복사본으로 교체해야 한다.
//
// 전제: `npm run build` 후 docs/ 산출물 필요.
const { test, expect } = require('@playwright/test');

/** 시드 → exportToExcel → 가로챈 워크북의 시트 구성 반환 */
async function exportAndCapture(page, logs, tab = '') {
    return await page.evaluate(({ logs, tab }) => {
        const m = window.soilManager;
        m.sampleLogs = JSON.parse(JSON.stringify(logs));
        // exportToExcel은 현재 경지구분1차 **탭** 기준으로 내보낸다(getTabFilteredLogs).
        // 기본 탭이 '농가의뢰'라 다른 구분이 걸러지므로, 시트 분리 검증은 '전체' 탭(빈 값) 기준.
        // 코드리뷰 MINOR-5: 탭을 파라미터로 열어, MAJOR-1이 실제로 발생했던
        // "기본 탭 + 다구분 데이터" 경로도 스위트에 고정할 수 있게 한다.
        m.currentSearchFilter.landClass1 = tab;

        let captured = null;
        const orig = window.XLSX;
        // frozen 네임스페이스라 프로퍼티 대입 불가 → 객체 교체 (자유 변수는 호출 시점 조회)
        window.XLSX = { ...orig, utils: orig.utils, writeFile: (wb) => { captured = wb; } };
        try {
            m.exportToExcel();
        } finally {
            window.XLSX = orig;
        }
        if (!captured) return { error: 'writeFile 미호출' };

        const sheets = {};
        for (const name of captured.SheetNames) {
            const rows = orig.utils.sheet_to_json(captured.Sheets[name]);
            sheets[name] = {
                count: rows.length,
                receptions: rows.map(r => r['접수번호']),
                classes: [...new Set(rows.map(r => r['경지구분1차']))],
                cols: captured.Sheets[name]['!cols'] || null,
                headers: Object.keys(rows[0] || {})
            };
        }
        return { sheetNames: captured.SheetNames, sheets };
    }, { logs, tab });
}

const soilLog = (over) => ({
    id: over.id, receptionNumber: over.rec, date: '2026-07-01', name: over.name || '홍길동',
    phoneNumber: '010-1111-1111', addressRoad: '경북 봉화군 행복로 12', addressDetail: '',
    landClass1: over.landClass1, subCategory: '논', purpose: '일반재배',
    receptionMethod: '방문', note: '', isComplete: false,
    parcels: [], createdAt: '2026-07-01T00:00:00.000Z'
});

test.describe('접수대장 시트 분리 (SLS-1-199)', () => {
    test.beforeEach(async ({ page }) => {
        const res = await page.goto('/soil/');
        expect(res && res.status(), 'docs/soil/ 없음 — `npm run build && npm test` 순서로 실행할 것')
            .toBeLessThan(400);
        await page.waitForFunction(() => !!window.soilManager && !!window.SheetName, { timeout: 10000 });
    });

    test('첫 시트는 전체 목록이고 이름·구성이 기존과 동일하다 (하위 호환)', async ({ page }) => {
        const out = await exportAndCapture(page, [
            soilLog({ id: 'a', rec: '501', landClass1: '농가의뢰' }),
            soilLog({ id: 'b', rec: '502', landClass1: '공익직불제' })
        ]);
        expect(out.error).toBeUndefined();
        expect(out.sheetNames[0]).toBe('시료접수대장');
        expect(out.sheets['시료접수대장'].count).toBe(2);
        // 열 너비 19개가 기존과 동일하게 유지되는지 (코드리뷰 MINOR-3 — EXPORT_COLS 복사 포함 고정)
        expect(out.sheets['시료접수대장'].cols).toHaveLength(19);
        expect(out.sheets['시료접수대장'].cols[12]).toEqual({ wch: 30 });
        // 구분별 시트도 동일한 열 구성·너비
        expect(out.sheets['농가의뢰'].headers).toEqual(out.sheets['시료접수대장'].headers);
        expect(out.sheets['농가의뢰'].cols).toHaveLength(19);
    });

    test('경지구분1차별 시트가 생성되고 각 시트에 해당 행만 담긴다', async ({ page }) => {
        const out = await exportAndCapture(page, [
            soilLog({ id: 'a', rec: '501', landClass1: '농가의뢰' }),
            soilLog({ id: 'b', rec: '502', landClass1: '농가의뢰' }),
            soilLog({ id: 'c', rec: '503', landClass1: '공익직불제' })
        ]);
        expect(out.sheetNames).toEqual(['시료접수대장', '농가의뢰', '공익직불제']);
        expect(out.sheets['농가의뢰'].count).toBe(2);
        expect(out.sheets['농가의뢰'].classes).toEqual(['농가의뢰']);
        expect(out.sheets['공익직불제'].count).toBe(1);
        expect(out.sheets['공익직불제'].receptions).toEqual(['503']);
    });

    test('행 수 보존 + 중복 없음 — 구분별 합 = 전체, 접수번호 합집합 일치', async ({ page }) => {
        const out = await exportAndCapture(page, [
            soilLog({ id: 'a', rec: '501', landClass1: '농가의뢰' }),
            soilLog({ id: 'b', rec: '502', landClass1: '전략' }),
            soilLog({ id: 'c', rec: '503', landClass1: '공익직불제' }),
            soilLog({ id: 'd', rec: '504', landClass1: '농가의뢰' })
        ]);
        const total = out.sheets['시료접수대장'];
        const parts = out.sheetNames.slice(1).map(n => out.sheets[n]);
        // 합계 일치
        expect(parts.reduce((s, p) => s + p.count, 0)).toBe(total.count);
        // A 누락 + B 중복이 상쇄되는 위양성 차단: 접수번호 합집합까지 비교
        const union = new Set(parts.flatMap(p => p.receptions));
        expect([...union].sort()).toEqual([...new Set(total.receptions)].sort());
    });

    test('시트 순서는 LAND_CLASS1_OPTIONS 순, 미등재 값은 뒤로', async ({ page }) => {
        const out = await exportAndCapture(page, [
            soilLog({ id: 'a', rec: '501', landClass1: '공익직불제' }),   // OPTIONS 마지막
            soilLog({ id: 'b', rec: '502', landClass1: '개량제' }),       // OPTIONS 첫 번째
            soilLog({ id: 'c', rec: '503', landClass1: '가져오기값' })    // 미등재
        ]);
        expect(out.sheetNames).toEqual(['시료접수대장', '개량제', '공익직불제', '가져오기값']);
    });

    test('금지 문자 구분 값이 sanitize되어 워크북에 반영된다 (함수-호출부 결선)', async ({ page }) => {
        // 유닛은 순수 함수만 검증한다. 이 케이스가 Discovery의 리스크
        // ("임의 구분 값으로 XLSX.writeFile throw")를 직접 잡는 유일한 테스트다.
        // 분리는 구분 2종 이상에서만 발동하므로(MAJOR-1) 다른 구분을 함께 시드한다
        const out = await exportAndCapture(page, [
            soilLog({ id: 'a', rec: '501', landClass1: '전략/직불' }),
            soilLog({ id: 'b', rec: '502', landClass1: '농가의뢰' })
        ]);
        expect(out.error).toBeUndefined();
        expect(out.sheetNames).toContain('전략 직불');
        expect(out.sheets['전략 직불'].count).toBe(1);
        expect(out.sheets['전략 직불'].receptions).toEqual(['501']);
    });

    test('구분이 1종뿐이면 분리하지 않는다 — 기존과 동일한 단일 시트 (MAJOR-1 회귀)', async ({ page }) => {
        // 기본 탭이 '농가의뢰'라 탭을 안 바꾼 대다수 사용자의 내보내기가 이 경로다.
        // 전체 시트와 바이트 동일한 중복 시트를 만들면 파일 2배 + 혼란만 남는다.
        // (1차 구현의 "전체 + 1 시트" 기대는 하위 호환 논리가 거꾸로였음 — 호환을 지키는 것은
        //  첫 시트 유지이지 중복 2번째 시트가 아니다.)
        const out = await exportAndCapture(page, [
            soilLog({ id: 'a', rec: '501', landClass1: '농가의뢰' })
        ]);
        expect(out.sheetNames).toEqual(['시료접수대장']);
    });

    // 코드리뷰 MINOR-5: 위 케이스는 '전체' 탭 + 단일 구분으로 orderedKeys.length<=1을 우회
    // 재현할 뿐이라, MAJOR-1이 실제로 터졌던 "탭이 걸린 상태"는 어디에도 없었다.
    // 그룹핑 소스를 excelData 대신 sampleLogs(탭 미적용)로 바꾸는 리팩터링이 들어오면
    // 위 케이스는 통과하는데 이 케이스만 죽는다 — 그게 이 테스트의 존재 이유다.
    test('기본 탭(농가의뢰)에서는 다구분 자료여도 단일 시트 — MAJOR-1의 실제 발생 경로', async ({ page }) => {
        const out = await exportAndCapture(page, [
            soilLog({ id: 'a', rec: '501', landClass1: '농가의뢰' }),
            soilLog({ id: 'b', rec: '502', landClass1: '전략' }),
            soilLog({ id: 'c', rec: '503', landClass1: '공익직불제' })
        ], '농가의뢰');   // 탭을 '전체'로 바꾸지 않는다
        expect(out.error).toBeUndefined();
        expect(out.sheetNames).toEqual(['시료접수대장']);
        // 탭 필터가 함께 걸려 있는지도 고정 — 시트는 1장인데 내용이 전량이면 그것대로 회귀다
        expect(out.sheets['시료접수대장'].receptions).toEqual(['501']);
    });
});
