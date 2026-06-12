// 토양 시료 폼 제출 골든 테스트 (SLS-1-137)
// 목적: submitForm() 분해(SLS-1-138) 전 "동작 고정" 안전망. 3개 모드(신규/단일수정/그룹수정)의
//       결과 sampleLogs를 결정적 fixture로 캡처해 골든 스냅샷으로 박는다. 분해 후 한 셀이라도
//       바뀌면 회귀이므로 즉시 잡힌다. (submitForm 소스는 변경하지 않음)
//
// 전제: `npm run build` 후 docs/ 산출물 필요 (webServer가 docs/를 8888로 서빙).
// 비결정 필드(id/groupId/createdAt/updatedAt)는 page 내 __norm으로 마스킹 후 비교.
// 골든 갱신: submitForm 동작을 "의도적으로" 바꾼 경우에만 GOLDEN_* 교체. 의도치 않은 변경=회귀.
const { test, expect } = require('@playwright/test');

// page 컨텍스트에 주입할 헬퍼(정규화·폼세팅).
// 주의: addInitScript 콜백은 직렬화되어 브라우저에서 실행되므로 외부 변수 클로저 참조 금지.
async function installHelpers(page) {
  await page.addInitScript(() => {
    window.__norm = (logs) => logs.map((l) => {
      const c = JSON.parse(JSON.stringify(l));
      const mask = (o) => { if (o && typeof o === 'object') { for (const k of Object.keys(o)) {
        if (k === 'id') o[k] = '<id>'; else if (k === 'groupId') o[k] = '<gid>';
        else if (k === 'createdAt' || k === 'updatedAt') o[k] = '<ts>';
        else if (o[k] && typeof o[k] === 'object') mask(o[k]); } } };
      mask(c); return c;
    });
    window.__setForm = (m, f) => {
      for (const [k, v] of Object.entries(f)) { const el = m.form.elements[k]; if (el) el.value = v; }
      if (m.addressPostcode) m.addressPostcode.value = f.addressPostcode || '';
      if (m.addressRoad) m.addressRoad.value = f.addressRoad || '';
      if (m.addressDetail) m.addressDetail.value = f.addressDetail || '';
      if (m.receptionNumberInput) m.receptionNumberInput.value = f.receptionNumber || '';
    };
  });
}

test.describe('폼 제출 골든 (SLS-1-137)', () => {
  test.beforeEach(async ({ page }) => {
    await installHelpers(page);
    await page.goto('/soil/');
    await page.waitForFunction(() => !!window.soilManager, { timeout: 10000 });
  });

  test('신규 등록 — 다중작물 채번(503/504/504-1) 골든', async ({ page }) => {
    const out = await page.evaluate(() => {
      const m = window.soilManager; const k = m.getStorageKey ? m.getStorageKey(m.selectedYear) : `soilSampleLogs_${new Date().getFullYear()}`;
      localStorage.removeItem(k); m.sampleLogs = []; m.editingGroupId = null; m.editingLogId = null;
      window.__setForm(m, { receptionNumber: '503', date: '2026-05-01', name: '홍길동', phoneNumber: '010-1234-5678',
        address: '경상북도 봉화군 봉화읍 행복로 12', addressRoad: '경상북도 봉화군 봉화읍 행복로 12', addressDetail: '101호',
        subCategory: '논', purpose: '일반재배', landClass1: '농가의뢰', receptionMethod: '방문', note: '' });
      m.parcels = [
        { id: 'p1', lotAddress: '경상북도 봉화군 봉화읍 삼계리 123', isMountain: false, subLots: [], category: '논', purpose: '일반재배', note: '', crops: [{ name: '벼', area: '1000', unit: 'm2' }] },
        { id: 'p2', lotAddress: '경상북도 봉화군 봉화읍 문단리 45', isMountain: false, subLots: [], category: '밭', purpose: '일반재배', note: '', crops: [{ name: '고추', area: '300', unit: 'm2' }, { name: '배추', area: '200', unit: 'm2' }] },
      ];
      m.getCurrentLandClass1 = () => '농가의뢰';
      m.submitForm();
      return window.__norm(m.sampleLogs);
    });
    expect(out.map((r) => r.receptionNumber)).toEqual(['503', '504', '504-1']);
    expect(out).toEqual(GOLDEN_NEWREG);
  });

  test('신규 성토 — F접두사(F503) 골든', async ({ page }) => {
    const out = await page.evaluate(() => {
      const m = window.soilManager; const k = m.getStorageKey ? m.getStorageKey(m.selectedYear) : `soilSampleLogs_${new Date().getFullYear()}`;
      localStorage.removeItem(k); m.sampleLogs = []; m.editingGroupId = null; m.editingLogId = null;
      window.__setForm(m, { receptionNumber: 'F503', date: '2026-05-02', name: '김철수', phoneNumber: '',
        address: '', subCategory: '성토', purpose: '일반재배', landClass1: '농가의뢰', receptionMethod: '우편', note: '성토시료' });
      m.parcels = [{ id: 'p1', lotAddress: '경상북도 봉화군 물야면 오록리 78', isMountain: false, subLots: [], category: '성토', purpose: '일반재배', note: '', crops: [{ name: '', area: '', unit: 'm2' }] }];
      m.getCurrentLandClass1 = () => '농가의뢰';
      m.submitForm();
      return window.__norm(m.sampleLogs);
    });
    expect(out).toEqual(GOLDEN_FILLREG);
  });

  test('단일 수정 — 레코드 갱신 골든', async ({ page }) => {
    const out = await page.evaluate(() => {
      const m = window.soilManager; const k = m.getStorageKey ? m.getStorageKey(m.selectedYear) : `soilSampleLogs_${new Date().getFullYear()}`;
      // 운영 레코드 전체 필드 — 단일수정이 보존해야 하는 필드(isComplete/businessRegNo/basePnu/gongik*) 포함
      const orig = { id: 'E1', groupId: 'G1', receptionNumber: '700', date: '2026-04-01', name: '기존자', phoneNumber: '010-0000-0000',
        address: '대구', subCategory: '논', purpose: '일반재배', landClass1: '농가의뢰', receptionMethod: '방문', note: 'old',
        createdAt: '2026-04-01T00:00:00.000Z', isComplete: true, businessRegNo: 'BR001', basePnu: 'PNU123',
        gongikOrder: '2', gongikBaseYear: '2025', parcels: [], lotAddress: 'old', area: '0', cropsDisplay: '-' };
      m.sampleLogs = [orig]; localStorage.setItem(k, JSON.stringify(m.sampleLogs));
      m.editingGroupId = null; m.editingLogId = 'E1';
      window.__setForm(m, { receptionNumber: '700', date: '2026-05-05', name: '수정자', phoneNumber: '010-9999-8888',
        address: '경상북도 봉화군', subCategory: '밭', purpose: '유기', landClass1: '공익직불제', receptionMethod: '이메일', note: '수정됨' });
      m.parcels = [{ id: 'p9', lotAddress: '경상북도 봉화군 봉성면 동양리 10', isMountain: false, subLots: [], category: '밭', purpose: '유기', note: '', crops: [{ name: '사과', area: '500', unit: 'm2' }] }];
      m.submitForm();
      return window.__norm(m.sampleLogs);
    });
    expect(out).toEqual(GOLDEN_SINGLEEDIT);
  });

  test('그룹 수정 — 기존 ID 보존 + commonData 갱신 골든', async ({ page }) => {
    page.on('dialog', (d) => d.accept()); // 그룹수정 삭제 confirm 수락(이 테스트에서만 발생 가능)
    const out = await page.evaluate(() => {
      const m = window.soilManager; const k = m.getStorageKey ? m.getStorageKey(m.selectedYear) : `soilSampleLogs_${new Date().getFullYear()}`;
      const o1 = { id: 'E1', groupId: 'G1', receptionNumber: '503', date: '2026-04-01', name: '그룹주', subCategory: '논',
        purpose: '일반재배', landClass1: '농가의뢰', createdAt: '2026-04-01T00:00:00.000Z', isComplete: false,
        parcels: [], lotAddress: 'a', area: '0', cropsDisplay: '-' };
      const o2 = { ...o1, id: 'E2', receptionNumber: '504' };
      m.sampleLogs = [o1, o2]; localStorage.setItem(k, JSON.stringify(m.sampleLogs));
      m.editingLogId = null; m.editingGroupId = 'G1'; m.editingGroupLogs = [o1, o2];
      window.__setForm(m, { receptionNumber: '503', date: '2026-05-09', name: '그룹수정자', phoneNumber: '010-1111-2222',
        address: '경상북도 봉화군', subCategory: '밭', purpose: '유기', landClass1: '공익직불제', receptionMethod: '팩스', note: '그룹수정' });
      m.parcels = [
        { id: 'p1', lotAddress: '경상북도 봉화군 봉화읍 해저리 11', isMountain: false, subLots: [], category: '밭', purpose: '유기', note: '', crops: [{ name: '마늘', area: '100', unit: 'm2' }] },
        { id: 'p2', lotAddress: '경상북도 봉화군 봉화읍 해저리 12', isMountain: false, subLots: [], category: '밭', purpose: '유기', note: '', crops: [{ name: '양파', area: '150', unit: 'm2' }] },
      ];
      m.getCurrentLandClass1 = () => '공익직불제';
      m.submitForm();
      return { logs: window.__norm(m.sampleLogs), rawIds: m.sampleLogs.map((l) => l.id).sort() };
    });
    expect(out.rawIds).toEqual(GOLDEN_GROUPEDIT_IDS); // 기존 레코드 ID 보존
    expect(out.logs).toEqual(GOLDEN_GROUPEDIT);
  });
});

// ── 골든 스냅샷 (실제 submitForm 출력 캡처본) ──────────────────────────
const GOLDEN_NEWREG = [{"id":"<id>","receptionNumber":"503","date":"2026-05-01","name":"홍길동","phoneNumber":"010-1234-5678","address":"경상북도 봉화군 봉화읍 행복로 12","addressPostcode":"","addressRoad":"경상북도 봉화군 봉화읍 행복로 12","addressDetail":"101호","subCategory":"논","purpose":"일반재배","landClass1":"농가의뢰","receptionMethod":"방문","note":"","gongikOrder":"1","gongikBaseYear":"","createdAt":"<ts>","updatedAt":"<ts>","groupId":"<gid>","parcelIndex":1,"totalParcels":2,"parcels":[{"id":"<id>","lotAddress":"경상북도 봉화군 봉화읍 삼계리 123","isMountain":false,"subLots":[],"crops":[{"name":"벼","area":"1000","unit":"m2"}],"category":"논","purpose":"일반재배","note":""}],"lotAddress":"경상북도 봉화군 봉화읍 삼계리 123","area":"1000","cropsDisplay":"벼"},{"id":"<id>","receptionNumber":"504","date":"2026-05-01","name":"홍길동","phoneNumber":"010-1234-5678","address":"경상북도 봉화군 봉화읍 행복로 12","addressPostcode":"","addressRoad":"경상북도 봉화군 봉화읍 행복로 12","addressDetail":"101호","subCategory":"밭","purpose":"일반재배","landClass1":"농가의뢰","receptionMethod":"방문","note":"","gongikOrder":"1","gongikBaseYear":"","createdAt":"<ts>","updatedAt":"<ts>","groupId":"<gid>","parcelIndex":2,"totalParcels":2,"parcels":[{"id":"<id>","lotAddress":"경상북도 봉화군 봉화읍 문단리 45","isMountain":false,"subLots":[],"crops":[{"name":"고추","area":"300","unit":"m2"}],"category":"밭","purpose":"일반재배","note":""}],"lotAddress":"경상북도 봉화군 봉화읍 문단리 45","area":"300","cropsDisplay":"고추","cropIndex":1},{"id":"<id>","receptionNumber":"504-1","date":"2026-05-01","name":"홍길동","phoneNumber":"010-1234-5678","address":"경상북도 봉화군 봉화읍 행복로 12","addressPostcode":"","addressRoad":"경상북도 봉화군 봉화읍 행복로 12","addressDetail":"101호","subCategory":"밭","purpose":"일반재배","landClass1":"농가의뢰","receptionMethod":"방문","note":"","gongikOrder":"1","gongikBaseYear":"","createdAt":"<ts>","updatedAt":"<ts>","groupId":"<gid>","parcelIndex":2,"totalParcels":2,"parcels":[{"id":"<id>","lotAddress":"경상북도 봉화군 봉화읍 문단리 45","isMountain":false,"subLots":[],"crops":[{"name":"배추","area":"200","unit":"m2"}],"category":"밭","purpose":"일반재배","note":""}],"lotAddress":"경상북도 봉화군 봉화읍 문단리 45","area":"200","cropsDisplay":"배추","cropIndex":2}];
const GOLDEN_FILLREG = [{"id":"<id>","receptionNumber":"F503","date":"2026-05-02","name":"김철수","phoneNumber":"","address":"","addressPostcode":"","addressRoad":"","addressDetail":"","subCategory":"성토","purpose":"일반재배","landClass1":"농가의뢰","receptionMethod":"우편","note":"성토시료","gongikOrder":"1","gongikBaseYear":"","createdAt":"<ts>","updatedAt":"<ts>","groupId":"<gid>","parcelIndex":1,"totalParcels":1,"parcels":[{"id":"<id>","lotAddress":"경상북도 봉화군 물야면 오록리 78","isMountain":false,"subLots":[],"crops":[{"name":"","area":"","unit":"m2"}],"category":"성토","purpose":"일반재배","note":""}],"lotAddress":"경상북도 봉화군 물야면 오록리 78","area":"0","cropsDisplay":"-"}];
const GOLDEN_SINGLEEDIT = [{"id":"<id>","groupId":"<gid>","receptionNumber":"700","date":"2026-05-05","name":"수정자","phoneNumber":"010-9999-8888","address":"경상북도 봉화군","subCategory":"밭","purpose":"유기","landClass1":"공익직불제","receptionMethod":"이메일","note":"수정됨","createdAt":"<ts>","isComplete":true,"businessRegNo":"BR001","basePnu":"PNU123","gongikOrder":"2","gongikBaseYear":"2025","parcels":[{"id":"<id>","lotAddress":"경상북도 봉화군 봉성면 동양리 10","isMountain":false,"subLots":[],"crops":[{"name":"사과","area":"500","unit":"m2"}],"category":"밭","purpose":"유기","note":""}],"lotAddress":"경상북도 봉화군 봉성면 동양리 10","area":"500","cropsDisplay":"사과","addressPostcode":"","addressRoad":"","addressDetail":"","updatedAt":"<ts>"}];
const GOLDEN_GROUPEDIT_IDS = ["E1","E2"];
const GOLDEN_GROUPEDIT = [{"id":"<id>","receptionNumber":"503","date":"2026-05-09","name":"그룹수정자","phoneNumber":"010-1111-2222","address":"경상북도 봉화군","addressPostcode":"","addressRoad":"","addressDetail":"","subCategory":"밭","purpose":"유기","landClass1":"공익직불제","receptionMethod":"팩스","note":"그룹수정","updatedAt":"<ts>","groupId":"<gid>","parcelIndex":1,"totalParcels":2,"parcels":[{"id":"<id>","lotAddress":"경상북도 봉화군 봉화읍 해저리 11","isMountain":false,"subLots":[],"crops":[{"name":"마늘","area":"100","unit":"m2"}],"category":"밭","purpose":"유기","note":""}],"lotAddress":"경상북도 봉화군 봉화읍 해저리 11","area":"100","cropsDisplay":"마늘","createdAt":"<ts>","isComplete":false,"businessRegNo":"","gongikOrder":"1","gongikBaseYear":"","basePnu":""},{"id":"<id>","receptionNumber":"504","date":"2026-05-09","name":"그룹수정자","phoneNumber":"010-1111-2222","address":"경상북도 봉화군","addressPostcode":"","addressRoad":"","addressDetail":"","subCategory":"밭","purpose":"유기","landClass1":"공익직불제","receptionMethod":"팩스","note":"그룹수정","updatedAt":"<ts>","groupId":"<gid>","parcelIndex":2,"totalParcels":2,"parcels":[{"id":"<id>","lotAddress":"경상북도 봉화군 봉화읍 해저리 12","isMountain":false,"subLots":[],"crops":[{"name":"양파","area":"150","unit":"m2"}],"category":"밭","purpose":"유기","note":""}],"lotAddress":"경상북도 봉화군 봉화읍 해저리 12","area":"150","cropsDisplay":"양파","createdAt":"<ts>","isComplete":false,"businessRegNo":"","gongikOrder":"1","gongikBaseYear":"","basePnu":""}];
