// @ts-check
// SLS-1-247: 농가의뢰인데 우편번호가 없으면 목록에서 농가주소를 붉게
//
// 🚨 이 티켓에는 **요청보다 앞선 결함**이 있었다. 목록의 우편번호 열이
//    addressPostcode 필드가 아니라 주소 문자열 앞의 (12345) 접두에서 값을 뽑는데,
//    addressRoad가 우선이고 거기엔 그 접두가 없어(buildAddressFields는 address에만 붙인다)
//    **우편번호를 제대로 채운 건도 목록에서 "-"로 보였다.**
//    그 상태로 "우편번호 없으면 빨갛게"를 붙이면 성공한 건까지 전부 빨개진다.
//    그래서 이 스펙의 첫 단언은 경고가 아니라 **우편번호가 보이는가**다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const base = (over) => ({
    id: 'x', receptionNumber: '1', name: '홍길동',
    landClass1: '농가의뢰', subCategory: '논', date: '2026-08-14',
    parcels: [{ id: 'p', lotAddress: '봉화읍 내성리 100', subLots: [], crops: [] }],
    ...over,
});

const ROAD = '경상북도 봉화군 봉화읍 내성로 85';

async function seed(page, logs) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    await page.evaluate((rows) => {
        const year = window.soilManager.selectedYear;
        localStorage.setItem(`soilSampleLogs_${year}`, JSON.stringify(rows));
    }, logs);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
        (n) => (window.soilManager?.sampleLogs || []).length === n, logs.length);
}

/**
 * 목록은 **경지구분 1차별 탭**으로 걸러진다(#landClass1Tab, 기본 '농가의뢰').
 * 다른 1차 레코드를 보려면 탭을 옮겨야 한다 — 안 그러면 행 자체가 없어
 * `warned`가 undefined가 되고 "경고 안 켜짐"으로 잘못 통과한다.
 */
async function switchTab(page, landClass1) {
    // ⚠️ selectOption()은 못 쓴다 — 이 select는 화면에서 보이지 않는 상태라
    //    Playwright가 "element is not visible"로 막는다. 값을 직접 넣고
    //    change를 쏴서 목록 갱신을 태운다.
    await page.evaluate((v) => {
        const el = document.getElementById('landClass1Tab');
        if (!el) throw new Error('#landClass1Tab이 없다');
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, landClass1);
    await page.waitForFunction(
        (v) => document.getElementById('landClass1Tab')?.value === v, landClass1);
}

/** 이름으로 행을 찾아 우편번호·주소 셀 상태를 읽는다 */
const cellsOf = (page, name) => page.evaluate((who) => {
    const heads = [...document.querySelectorAll('table thead th')].map((t) => t.textContent.trim());
    const tr = [...document.querySelectorAll('#logTableBody tr')]
        .find((r) => r.textContent.includes(who));
    if (!tr) return null;
    const zipIdx = heads.indexOf('우편번호');
    const addrIdx = heads.indexOf('주소');
    const addrCell = tr.children[addrIdx];
    return {
        zip: (tr.children[zipIdx]?.textContent ?? '').trim(),
        addr: (addrCell?.textContent ?? '').trim(),
        warned: addrCell?.classList.contains('postcode-missing') ?? false,
        title: addrCell?.title ?? '',
    };
}, name);

test.describe('농가주소 우편번호 경고 (SLS-1-247)', () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 전제 복구 — 이게 안 되면 경고가 전부 켜져 무용지물이 된다
    // ══════════════════════════════════════════════════════════════
    test('우편번호를 채운 건이 목록에 보인다', async ({ page }) => {
        await seed(page, [base({
            addressPostcode: '36239', addressRoad: ROAD, address: `(36239) ${ROAD}`,
        })]);
        const c = await cellsOf(page, '홍길동');
        expect(c, '행을 못 찾았다').toBeTruthy();
        expect(c.zip, '우편번호가 있는데 목록에 안 보인다').toBe('36239');
    });

    test('우편번호가 있으면 경고하지 않는다', async ({ page }) => {
        await seed(page, [base({
            addressPostcode: '36239', addressRoad: ROAD, address: `(36239) ${ROAD}`,
        })]);
        const c = await cellsOf(page, '홍길동');
        expect(c, '행을 못 찾았다').toBeTruthy();
        expect(c.warned, '정상인데 경고가 켜졌다 — 전부 빨개지면 아무도 안 본다').toBe(false);
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 요청의 핵심 — 농가의뢰인데 우편번호가 없다
    // ══════════════════════════════════════════════════════════════
    test('농가의뢰 + 주소 있음 + 우편번호 없음 → 붉게 표시된다', async ({ page }) => {
        await seed(page, [base({ addressPostcode: '', addressRoad: ROAD, address: '' })]);
        const c = await cellsOf(page, '홍길동');
        expect(c, '행을 못 찾았다').toBeTruthy();
        expect(c.zip, '우편번호가 비어 있어야 하는 상황이다').toBe('-');
        expect(c.warned, '경고 표시가 없다').toBe(true);
        expect(c.title, '무엇을 하라는지 안 알려 준다').toMatch(/우편번호/);
    });

    // 주소 복사 안내를 덮어쓰면 기능이 조용히 사라진다
    test('경고가 켜져도 주소 복사 안내가 남는다', async ({ page }) => {
        await seed(page, [base({ addressPostcode: '', addressRoad: ROAD, address: '' })]);
        const c = await cellsOf(page, '홍길동');
        expect(c, '행을 못 찾았다').toBeTruthy();
        expect(c.title, '복사 안내가 사라졌다').toMatch(/복사/);
    });

    // 🚨 발송 대상이 아닌 시료는 우편번호가 없는 것이 정상이다
    test('농가의뢰가 아니면 표시하지 않는다', async ({ page }) => {
        await seed(page, [
            base({ id: 'a', receptionNumber: '1', name: '자체건', landClass1: '자체', addressPostcode: '', addressRoad: ROAD, address: '' }),
            base({ id: 'b', receptionNumber: '2', name: '대표건', landClass1: '대표필지', addressPostcode: '', addressRoad: ROAD, address: '' }),
            base({ id: 'c', receptionNumber: '3', name: '직불건', landClass1: '공익직불제', addressPostcode: '', addressRoad: ROAD, address: '' }),
        ]);
        for (const [who, cls] of [['자체건', '자체'], ['대표건', '대표필지'], ['직불건', '공익직불제']]) {
            await switchTab(page, cls);
            const c = await cellsOf(page, who);
            // 🚨 행을 못 찾으면 warned가 undefined가 되어 "경고 안 켜짐"으로 통과한다.
            //    행이 실제로 있는지 먼저 못박는다.
            expect(c, `${who}: 행을 못 찾았다 — 탭 전환이 안 됐다`).toBeTruthy();
            expect(c.warned, `${who}: 발송 대상이 아닌데 경고가 켜졌다`).toBe(false);
        }
    });

    // 🚨 주소를 아예 안 적은 건까지 빨개지면 정작 고칠 대상이 묻힌다
    test('주소가 아예 없으면 표시하지 않는다', async ({ page }) => {
        await seed(page, [base({ addressPostcode: '', addressRoad: '', address: '' })]);
        const c = await cellsOf(page, '홍길동');
        expect(c, '행을 못 찾았다').toBeTruthy();
        expect(c.warned, '주소가 없는 건까지 빨개졌다').toBe(false);
    });

    // 예전 데이터 호환 — 필드가 없고 주소 문자열에만 우편번호가 있다
    test('예전 데이터(주소 문자열에만 우편번호)도 보인다', async ({ page }) => {
        await seed(page, [base({ addressPostcode: '', addressRoad: '', address: `(36239) ${ROAD}` })]);
        const c = await cellsOf(page, '홍길동');
        expect(c, '행을 못 찾았다').toBeTruthy();
        expect(c.zip, '예전 데이터의 우편번호를 못 읽는다').toBe('36239');
        expect(c.warned, '우편번호가 있는데 경고했다').toBe(false);
    });

    // 🚨 코드리뷰가 짚은 틈 — addressRoad가 있으면 address를 아예 안 보던 경로
    test('혼합 레거시(addressRoad 있고 address에만 우편번호)도 보인다', async ({ page }) => {
        await seed(page, [base({ addressPostcode: '', addressRoad: ROAD, address: `(36239) ${ROAD}` })]);
        const c = await cellsOf(page, '홍길동');
        expect(c, '행을 못 찾았다').toBeTruthy();
        expect(c.zip, 'addressRoad가 있어 address를 안 봤다').toBe('36239');
        expect(c.warned, '우편번호가 있는데 경고했다').toBe(false);
    });

    // 🚨 코드리뷰 MAJOR — 깨진 값이 멀쩡한 폴백을 막고 경고까지 끄면,
    //    고쳐야 할 건이 정상으로 보인다. 그게 가장 나쁘다.
    test('깨진 우편번호는 무시하고 주소에서 찾는다', async ({ page }) => {
        await seed(page, [base({
            addressPostcode: '1234',                    // 5자리가 아니다
            addressRoad: ROAD, address: `(36239) ${ROAD}`,
        })]);
        const c = await cellsOf(page, '홍길동');
        expect(c, '행을 못 찾았다').toBeTruthy();
        expect(c.zip, '깨진 값이 멀쩡한 폴백을 막았다').toBe('36239');
        expect(c.warned, '우편번호를 찾았는데 경고했다').toBe(false);
    });

    test('깨진 우편번호뿐이면 경고한다', async ({ page }) => {
        await seed(page, [base({ addressPostcode: '1234', addressRoad: ROAD, address: '' })]);
        const c = await cellsOf(page, '홍길동');
        expect(c, '행을 못 찾았다').toBeTruthy();
        expect(c.zip, '깨진 값을 우편번호로 표시했다').toBe('-');
        expect(c.warned, '쓸 수 없는 우편번호인데 경고가 없다').toBe(true);
    });

    test('우편번호가 숫자형이어도 죽지 않는다', async ({ page }) => {
        await seed(page, [base({ addressPostcode: 36239, addressRoad: ROAD, address: '' })]);
        const c = await cellsOf(page, '홍길동');
        expect(c, '행이 렌더되지 않았다 — 숫자형에서 터졌다').toBeTruthy();
        expect(c.zip).toBe('36239');
        expect(c.warned).toBe(false);
    });
});
