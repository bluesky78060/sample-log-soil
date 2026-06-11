// 흙토람·공익직불제 엑셀 빌더 골든 테스트 (SLS-1-135)
// 목적: buildWorksheetData/buildGongikWorksheetData의 "컬럼 매핑"이 어긋나면
//       외부 흙토람/공익직불제 일괄등록 사이트가 파일을 거부하므로, 출력 aoa를
//       결정적 fixture로 고정해 회귀를 차단한다. (빌더 코드는 변경하지 않음)
//
// 단위 테스트 불가: HeuktoramManager가 window 미노출 + this/DOM 의존이라
//   실제 페이지에서 window.heuktoramManager 인스턴스로 빌더를 직접 호출한다.
//
// 전제: `npm run build` 후 docs/ 산출물이 있어야 함 (webServer가 docs/를 8888로 서빙).
//   미빌드 시 /heuktoram/가 404 → waitForFunction timeout.
// 골든 갱신: 컬럼 매핑을 "의도적으로" 바꾼 경우에만 GOLDEN_* 배열을 새 출력으로 교체.
//   골든 실패가 의도치 않은 변경이면 그것이 곧 회귀(외부 사이트 거부)이므로 빌더를 고칠 것.
const { test, expect } = require('@playwright/test');

// 결정적 입력: 필지 / 하위필지 / 성토(F) 3건. 주소·검정값을 고정해 파싱 결과까지 결정적.
const FIXTURE = {
    selectedYear: '2026',
    collectYear: '2026',
    collector: '김채취',
    testResults: {
        'k1': { testDate: '2026-05-10', clay: '12', pH: '6.5', organicMatter: '25', availableP: '350',
                exK: '0.8', exCa: '6.0', exMg: '1.5', silica: '120', ec: '1.2', limeReq: '300',
                NO3N: '5', cec: '10', NH4N: '2', usageCode: '', soiling: '미해당' },
        'k2': { testDate: '2026-05-11', pH: '7.1', organicMatter: '30' },
        'k3': { testDate: '2026-05-12', pH: '6.0', soiling: '해당' },
    },
    rows: [
        // 본필지 (논, 일반재배)
        { key: 'k1', isSubLot: false, baseReceptionNumber: '503',
          parcel: { lotAddress: '경상북도 봉화군 봉화읍 삼계리 123', category: '논', purpose: '일반재배', note: '', isMountain: false },
          log: { name: '홍길동', date: '2026-05-01', landClass1: '농가의뢰', receptionNumber: '503',
                 addressRoad: '경상북도 봉화군 봉화읍 행복로 12', addressDetail: '101호', subCategory: '논',
                 purpose: '일반재배', phoneNumber: '010-1234-5678' },
          crop: { name: '벼', area: '1000', unit: 'm2' } },
        // 하위필지 (밭, 산)
        { key: 'k2', isSubLot: true, baseReceptionNumber: '503',
          parcel: { lotAddress: '경상북도 봉화군 봉화읍 삼계리 123', category: '논', purpose: '일반재배', note: '인근', isMountain: false },
          subLot: { lotAddress: '경상북도 봉화군 봉화읍 문단리 산 45-2', isMountain: true },
          log: { name: '홍길동', date: '2026-05-01', landClass1: '공익직불제', receptionNumber: '503-1',
                 addressRoad: '', address: '경상북도 봉화군 봉화읍 문단리 45', addressDetail: '',
                 subCategory: '밭', purpose: '일반재배', phoneNumber: '0541112222' },
          crop: { name: '고추', area: '300', unit: 'pyeong' } },
        // 성토 본필지 (F 접두사)
        { key: 'k3', isSubLot: false, baseReceptionNumber: 'F503',
          parcel: { lotAddress: '경상북도 봉화군 물야면 오록리 78', category: '성토', purpose: '일반재배', note: '', isMountain: false },
          log: { name: '김철수', date: '2026-05-02', landClass1: '농가의뢰', receptionNumber: 'F503',
                 addressRoad: '', address: '', addressDetail: '', subCategory: '성토',
                 purpose: '일반재배', phoneNumber: '' },
          crop: { name: '', code: '', area: '', unit: 'm2' } },
    ],
};

// fixture를 heuktoramManager에 주입하고 빌더를 직접 호출하는 page 함수
async function buildAoa(page, method) {
    return page.evaluate(({ fx, m }) => {
        const mgr = window.heuktoramManager;
        if (!mgr) return { error: 'heuktoramManager 없음' };
        mgr.selectedYear = fx.selectedYear;
        mgr.testResults = fx.testResults;
        // DOM 입력 stub (실제 페이지에 요소가 없을 수 있으므로 객체로 대체)
        mgr.collectYearInput = { value: fx.collectYear };
        mgr.collectorInput = { value: fx.collector };
        mgr.bulkUsageCodeSelect = { value: '' };
        try {
            return { aoa: mgr[m](fx.rows) };
        } catch (e) {
            return { error: String(e && e.message || e) };
        }
    }, { fx: FIXTURE, m: method });
}

test.describe('엑셀 빌더 골든 (SLS-1-135)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/heuktoram/');
        await page.waitForFunction(() => !!window.heuktoramManager, { timeout: 10000 });
    });

    test('흙토람 buildWorksheetData — 50열 컬럼 매핑 골든', async ({ page }) => {
        const res = await buildAoa(page, 'buildWorksheetData');
        expect(res.error, res.error).toBeUndefined();
        const aoa = res.aoa;
        // 구조 불변식: 헤더 4행 + 데이터 3행 = 7행, 데이터행 50열(헤더 행은 makeWsRow가 56열 채움)
        expect(aoa).toHaveLength(7);
        for (let r = 0; r < 4; r++) expect(aoa[r]).toHaveLength(56);
        for (let r = 4; r < 7; r++) expect(aoa[r]).toHaveLength(50);
        // 헤더 제목 행 고정
        expect(aoa[0][0]).toBe('토양검정 일괄입력 양식');
        // 골든 스냅샷: 데이터 3행(필지/하위필지/성토)
        expect(aoa.slice(4)).toEqual(GOLDEN_HEUKTORAM);
    });

    test('공익직불제 buildGongikWorksheetData — 42열(A·B 빈열 + C~AN 40열) 컬럼 매핑 골든', async ({ page }) => {
        const res = await buildAoa(page, 'buildGongikWorksheetData');
        expect(res.error, res.error).toBeUndefined();
        const aoa = res.aoa;
        // 구조 불변식: 헤더 3행 + 데이터 3행 = 6행, 각 데이터행 42열(A·B 빈열 2 + C~AN 40열)
        expect(aoa).toHaveLength(6);
        for (const row of aoa.slice(-3)) expect(row).toHaveLength(42);
        // 골든 스냅샷: 데이터 3행(헤더 행 제외 — 마지막 3행이 데이터)
        expect(aoa.slice(-3)).toEqual(GOLDEN_GONGIK);
    });
});

// ── 골든 스냅샷 (실제 출력 캡처본으로 고정 — 컬럼 매핑 변경 시 의도적으로 갱신) ──────
const GOLDEN_HEUKTORAM = [["필지","2026","김채취","2026-05-01","농가의뢰","논","일반적인토양검정-0","","503","경상북도","봉화군","봉화읍","삼계리","","123","","","","1000","2026-05-10","홍길동","경상북도","봉화군","봉화읍","행복로","12","","101호","","","","","벼","미해당","12","6.5","25","350","0.8","6.0","1.5","120","1.2","300","5","10","2","01012345678","Y","Y"],["하위필지","2026","김채취","2026-05-01","공익직불제","논","일반적인토양검정-0","","503","경상북도","봉화군","봉화읍","문단리","산","45","2","","인근",992,"2026-05-11","홍길동","경상북도","봉화군","봉화읍","문단리","45","","","","","","","고추","미해당","","7.1","30","","","","","","","","","","","0541112222","Y","Y"],["필지","2026","김채취","2026-05-02","농가의뢰","밭","일반적인토양검정-0","","F503","경상북도","봉화군","물야면","오록리","","78","","","","","2026-05-12","김철수","","","","","","","","","","","","","해당","","6.0","","","","","","","","","","","","","Y","Y"]];
const GOLDEN_GONGIK = [["","","1","2026-05-01","2026-05-10","2026-05-01","일반적인토양검정","AFTER","김채취","503","","홍길동","경상북도","봉화군","봉화읍","삼계리","일반","123","","","농가의뢰","논","경상북도 봉화군 봉화읍 행복로 12","01012345678","1000","벼","","12","6.5","25","350","0.8","6.0","1.5","120","1.2","300","5","10","2","",""],["","","1","2026-05-01","2026-05-11","2026-05-01","일반적인토양검정","AFTER","김채취","503","","홍길동","경상북도","봉화군","봉화읍","문단리","산","45","2","인근","직불(일반)","논","경상북도 봉화군 봉화읍 문단리 45","0541112222",992,"고추","","","7.1","30","","","","","","","","","","","",""],["","","1","2026-05-02","2026-05-12","2026-05-02","일반적인토양검정","AFTER","김채취","F503","","김철수","경상북도","봉화군","물야면","오록리","일반","78","","","농가의뢰","밭","","","","","","","6.0","","","","","","","","","","","","",""]];
