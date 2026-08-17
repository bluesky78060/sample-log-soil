// @ts-check
// SLS-1-249: 큰따옴표가 든 입력이 필지 카드에서 잘리던 문제
//
// 🚨 이 스펙이 지키는 것은 **저장이 아니라 재열람**이다.
//    저장은 원래 잘 됐다. escapeHTML이 따옴표를 그대로 내보내서
//    `value="1"동 옆 창고"` 가 되고, 파서가 value를 '1'에서 끊었다.
//    사용자는 수정하려고 다시 연 화면에서 잘린 값을 보고, 그대로 저장하면 원본이 덮였다.
//
// ⚠️ 그래서 "저장 직후"만 확인하면 **수정 전에도 통과한다.**
//    반드시 populateFormForEdit로 다시 그린 뒤 입력란의 value를 읽어야 한다.
//
// 대상 입력란 3개 — 전부 `value="${escapeHTML(...)}"` 경로다:
//   .lot-address-input   지번주소   (soil-script.js:1272 ← safeLotAddress 1257)
//   .crop-direct-input   작물명     (soil-script.js:1287 ← safeCropName   1258)
//   .parcel-note-input   기타주소   (soil-script.js:1215)
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

// 따옴표 뒤가 잘리는지 보려면 **따옴표 뒤에 글자가 있어야** 한다.
// 'a"' 처럼 끝에 두면 잘려도 티가 안 나 통과해버린다.
const QUOTE = '1"동 옆 창고';
const MIXED = '가로 3" & <창고>';

async function openSoil(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.soilManager, { timeout: 15000 });
}

/**
 * 레코드를 저장한 뒤 **수정으로 다시 연다**.
 * @returns {Promise<{stored: any, shown: {lot: string, crop: string, note: string}}>}
 */
const saveThenReopen = (page, values) => page.evaluate((v) => {
    const m = window.soilManager;
    const key = m.getStorageKey(m.selectedYear);
    localStorage.removeItem(key);
    m.sampleLogs = [];
    m.editingGroupId = null;
    m.editingLogId = null;

    const log = {
        id: 'Q1', groupId: 'QG1', receptionNumber: '501', date: '2026-08-17',
        name: '홍길동', phoneNumber: '', address: '', subCategory: '논',
        purpose: '일반재배', landClass1: '농가의뢰', receptionMethod: '방문', note: '',
        createdAt: '2026-08-17T00:00:00.000Z',
        parcels: [{
            id: 'QP1', lotAddress: v.lot, isMountain: false, subLots: [],
            category: '논', purpose: '일반재배', note: v.note,
            crops: [{ name: v.crop, area: '1000', unit: 'm2' }]
        }]
    };
    m.sampleLogs = [log];
    localStorage.setItem(key, JSON.stringify(m.sampleLogs));

    // 🚨 여기가 핵심 — 수정으로 다시 그린다
    m.populateFormForEdit(log);

    const val = (sel) => document.querySelector(sel)?.value ?? null;
    return {
        stored: JSON.parse(localStorage.getItem(key))[0].parcels[0],
        shown: {
            lot: val('.lot-address-input'),
            crop: val('.crop-direct-input'),
            note: val('.parcel-note-input'),
        }
    };
}, values);

test.describe('따옴표가 든 입력 보존 (SLS-1-249)', () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 티켓의 증상 그 자체 — 수정으로 다시 열면 '1' 만 남았다
    // ══════════════════════════════════════════════════════════════
    test('큰따옴표가 든 값이 수정 화면에서 잘리지 않는다', async ({ page }) => {
        await openSoil(page);
        const r = await saveThenReopen(page, { lot: `내성리 ${QUOTE}`, crop: QUOTE, note: QUOTE });

        expect(r.shown.note, '기타주소가 잘렸다').toBe(QUOTE);
        expect(r.shown.crop, '작물명이 잘렸다').toBe(QUOTE);
        expect(r.shown.lot, '지번주소가 잘렸다').toBe(`내성리 ${QUOTE}`);
    });

    // ⚠️ 이건 **대조군**이다. 저장 경로는 원래 멀쩡했으므로 이 버그로는 실패하지 않는다
    //    (변이 검사로 확인: 이스케이프를 제거해도 이 테스트는 통과한다).
    //    있는 이유는 "화면이 깨졌다"와 "저장이 깨졌다"를 구분하기 위해서다 —
    //    이게 빨개지면 원인이 escapeHTML이 아니라 저장 경로에 있다는 뜻이다.
    test('저장된 레코드 자체도 온전하다 (대조군)', async ({ page }) => {
        await openSoil(page);
        const r = await saveThenReopen(page, { lot: `내성리 ${QUOTE}`, crop: QUOTE, note: QUOTE });

        expect(r.stored.note, '저장 단계에서 이미 깨졌다').toBe(QUOTE);
        expect(r.stored.crops[0].name).toBe(QUOTE);
        expect(r.stored.lotAddress).toBe(`내성리 ${QUOTE}`);
    });

    // 🚨 & 와 < 가 섞이면 이스케이프 순서가 틀렸을 때 드러난다
    //    (& 를 나중에 치환하면 &quot; 가 &amp;quot; 가 되어 글자 그대로 보인다)
    test('따옴표·앰퍼샌드·꺾쇠가 섞여도 온전하다', async ({ page }) => {
        await openSoil(page);
        const r = await saveThenReopen(page, { lot: `내성리 ${MIXED}`, crop: MIXED, note: MIXED });

        expect(r.shown.note, '혼합 문자에서 깨졌다').toBe(MIXED);
        expect(r.shown.note, '이중 이스케이프가 글자로 보인다').not.toContain('&amp;');
        expect(r.shown.crop).toBe(MIXED);
    });

    // ⚠️ 이 테스트는 **작은따옴표 이스케이프를 지키지 못한다.**
    //    변이 검사로 확인했다 — `.replace(/'/g,'&#39;')`를 지워도 통과한다.
    //    속성 구분자가 `"` 라서 `'`는 애초에 탈출을 못 하기 때문이다.
    //    그건 유닛 테스트(escapeHTML("1'동"))가 지킨다.
    //    여기서 지키는 건 반대 방향 — `'`가 `&#39;` 글자 그대로 보이지 않는가다.
    test("작은따옴표가 엔티티로 노출되지 않는다", async ({ page }) => {
        await openSoil(page);
        const v = "1'동 옆 창고";
        const r = await saveThenReopen(page, { lot: `내성리 ${v}`, crop: v, note: v });
        expect(r.shown.note, "&#39; 가 글자로 보인다").toBe(v);
        expect(r.shown.crop).toBe(v);
    });

    // 회귀 방어 — 평범한 입력이 &quot; 같은 엔티티로 보이면 안 된다
    test('따옴표 없는 평범한 입력은 그대로다', async ({ page }) => {
        await openSoil(page);
        const r = await saveThenReopen(page, { lot: '내성리 224', crop: '고추', note: '1동' });
        expect(r.shown.lot).toBe('내성리 224');
        expect(r.shown.crop).toBe('고추');
        expect(r.shown.note).toBe('1동');
    });

    // 🚨 속성 탈출로 없던 속성이 생기면 안 된다 (DOMPurify가 막지만 이중 방어)
    test('속성 문맥을 탈출해 새 속성을 만들지 못한다', async ({ page }) => {
        await openSoil(page);
        await saveThenReopen(page, {
            lot: '내성리 224', crop: '고추',
            note: '" data-injected="yes" x="'
        });
        const injected = await page.evaluate(() =>
            document.querySelector('.parcel-note-input')?.getAttribute('data-injected') ?? null);
        expect(injected, '속성 문맥을 탈출했다').toBeNull();
    });
});
