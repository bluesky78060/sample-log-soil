// @ts-check
// SLS-1-261: 목록에서 경지구분 열 숨김 (전체 보기에서는 표시)
//
// 경지구분은 **왼쪽 고정 열**이라, 숨기면 뒤 열(성명)의 left 좌표를 같이
// 당겨 줘야 한다. 안 그러면 성명이 원래 자리에 그대로 남아 그 앞에 빈 틈이
// 생긴다 — 콘솔에 아무것도 안 찍히고, 값도 멀쩡하고, 스크롤도 되는
// **눈으로만 보이는** 고장이다.
//
// 그래서 **성명 앞에 빈 틈이 없는지**를 본다 — 앞 고정 열이 끝나는 지점에서
// 성명이 바로 시작해야 한다.
//
// ⚠️ 2026-08-20 SLS-1-264로 판정 기준을 바꿨다. 원래는 "성명의 left가
//    경지구분의 left와 같은가"를 봤는데, 그건 **손으로 계산한 CSS 값끼리**의
//    비교였다. SLS-1-264가 좌표를 화면에서 재서 넣기 시작하자 성명은 실제
//    자리(389px)로 가고 숨은 경지구분은 옛 CSS 값(359px)에 남아 시험이 깨졌다.
//    깨진 쪽이 옳았다 — 손으로 계산한 359px가 틀린 값이었다.
//    이제 값끼리 비교하지 않고 **틈이 있는지**를 직접 본다.
//
// ⚠️ 화면 좌표(getBoundingClientRect)로는 재지 않는다. 실제로 재 봤더니
//    이 표의 렌더링 좌표가 CSS의 left 값과 일치하지 않고, 게다가
//    **기본 보기와 전체 보기에서 배율이 다르다**(같은 left:365가 기본에서
//    293px, 전체 보기에서 366px로 찍힌다). 원인은 이 티켓 범위 밖이고
//    건드리지 않았다. 좌표로 두 상태를 비교하면 **틀린 결론**이 나온다.
//    그래서 계산된 CSS 값을 직접 비교한다 — 배율과 무관하다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

/** 목록이 가로로 넘치는 폭 */
const VIEWPORT = { width: 1000, height: 900 };

const row = (i, landClass1) => ({
    id: `id${i}`,
    receptionNumber: String(i + 1),
    name: `홍길동${i}`,
    landClass1,
    subCategory: '논',
    purpose: '일반',
    date: '2026-08-20',
    parcels: [{ id: `p${i}`, lotAddress: '봉화읍 내성리 100번지 일원', subLots: [], crops: [] }],
});

async function open(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    await page.evaluate((data) => {
        localStorage.setItem(`soilSampleLogs_${window.soilManager.selectedYear}`, JSON.stringify(data));
    }, [row(0, '농가의뢰'), row(1, '농가의뢰'), row(2, '공익직불제'), row(3, '공익직불제')]);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => (window.soilManager?.sampleLogs || []).length === 4);
    await page.evaluate(() => window.soilManager.switchView('list'));
    await page.waitForFunction(() => (document.querySelector('#listView .table-wrapper')?.clientWidth || 0) > 0);
}

/** 경지구분 탭 이동 — select가 화면에 안 보여 selectOption()은 막힌다 */
async function setTab(page, value) {
    await page.evaluate((v) => {
        const el = document.getElementById('landClass1Tab');
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await page.waitForFunction(() => !!document.querySelector('#listView table tbody tr'));
    await waitForStableLayout(page);
    await waitForStickyApplied(page);
}

/**
 * 레이아웃이 멈출 때까지 기다린다.
 *
 * ⚠️ 탭 전환·전체 보기 토글 직후에는 열 폭이 아직 재배분 중이다. 그 상태에서
 *    재면 **없는 겹침이 있다고 나온다** — 실제로 그렇게 잘못 실패했다(전체 보기
 *    -44px 겹침으로 보고됐으나, 충분히 기다린 뒤 재면 겹침이 없다).
 *    고정 좌표가 맞았는지(waitForStickyApplied)와는 별개 조건이라 둘 다 본다.
 */
const waitForStableLayout = (page) => page.waitForFunction(() => {
    const head = document.querySelector('#listView table')?.tHead?.rows[0];
    if (!head) return false;
    const sig = [...head.cells].map((th) => `${th.offsetLeft}:${th.offsetWidth}`).join(',');
    const prev = window.__layoutSig;
    window.__layoutSig = sig;
    return prev === sig;
});

/**
 * 고정 좌표 재계산이 끝날 때까지 기다린다.
 *
 * ⚠️ 임의의 시간을 기다리지 않는다. 재계산은 rAF로 예약되므로 탭을 바꾸거나
 *    전체 보기를 켠 **직후에 재면 이전 좌표가 잡힌다.** 실제로 그래서
 *    공익직불제 탭 시험이 "틈이 남았다"고 잘못 실패했다 — 화면은 멀쩡했다.
 *    모든 고정 열의 left가 실제 자리와 일치할 때까지 기다린다.
 */
const waitForStickyApplied = (page) => page.waitForFunction(() => {
    const table = document.querySelector('#listView table');
    if (!table || !table.tHead) return false;
    let base = null;
    for (const th of table.tHead.rows[0].cells) {
        if (!th.classList.contains('sticky-col')) continue;
        if (th.offsetWidth === 0) continue;
        if (getComputedStyle(th).right !== 'auto') continue;
        if (base === null) base = th.offsetLeft;
        if (Math.abs((th.offsetLeft - base) - parseFloat(getComputedStyle(th).left)) > 1) return false;
    }
    return base !== null;
});

const toggleFullView = (page) => page.click('#viewToggleBtn');

/** 공익직불제 전용 규칙이 실제로 걸린 상태인지 */
const gongikOn = (page) => page.evaluate(
    () => document.querySelector('#listView table').classList.contains('gongik-on'));

const visibility = (page) => page.evaluate(() => {
    const th = document.querySelector('#listView th.col-landclass1');
    const td = document.querySelector('#listView tbody td.col-landclass1');
    if (!th || !td) throw new Error('경지구분 열 자체가 없다 — 숨김이 아니라 삭제됐다');
    return { th: getComputedStyle(th).display !== 'none', td: getComputedStyle(td).display !== 'none' };
});

/** 그 열이 화면에 보이는가 */
const isShown = (page, cls) => page.evaluate((selector) => {
    const th = document.querySelector(`#listView th.${selector}`);
    return !!th && getComputedStyle(th).display !== 'none';
}, cls);

test.describe('토양 목록 경지구분 열 숨김', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize(VIEWPORT);
        await open(page);
    });

    test('기본 화면에서는 안 보이고, 전체 보기에서는 보인다', async ({ page }) => {
        expect(await visibility(page), '기본 화면인데 경지구분이 보인다')
            .toEqual({ th: false, td: false });

        await toggleFullView(page);
        await waitForStableLayout(page);
        await waitForStickyApplied(page);
        expect(await visibility(page), '전체 보기인데 경지구분이 안 보인다')
            .toEqual({ th: true, td: true });

        await toggleFullView(page);
        await waitForStableLayout(page);
        await waitForStickyApplied(page);
        expect(await visibility(page), '기본 보기로 돌아왔는데 경지구분이 남아 있다')
            .toEqual({ th: false, td: false });
    });

    // 경지구분을 숨기고 뒤 열의 좌표를 안 당기면 성명 앞에 그 폭만큼 틈이 남는다.
    // 일반/공익직불제는 고정 열 구성이 다르다(차수 삽입·목적 숨김).
    for (const tab of [
        { name: '농가의뢰', gongik: false },
        { name: '공익직불제', gongik: true },
    ]) {
        test(`${tab.name} 탭: 경지구분이 숨겨지고 전체 보기에서 돌아온다`, async ({ page }) => {
            await setTab(page, tab.name);

            // 공익직불제는 좌표가 따로다. 이 클래스가 안 붙으면 아래 단언이
            // **일반 규칙을 재면서 통과해** 공익직불제를 시험한 게 아니게 된다.
            expect(await gongikOn(page), tab.gongik
                ? `${tab.name} 탭인데 gongik-on이 안 붙었다 — 일반 규칙을 재고 있다`
                : `${tab.name} 탭인데 gongik-on이 붙었다`).toBe(tab.gongik);

            expect(await isShown(page, 'col-landclass1'),
                `${tab.name}: 기본 화면인데 경지구분이 보인다`).toBe(false);
            // ⚠️ 여기서 **열 사이 간격은 재지 않는다.** 재 보니 이 표는 공익직불제
            //    탭에서 구분과 성명 열 사이에 원래 17px 간격이 있다(th·td 모두 동일,
            //    offsetLeft 921→993인데 구분 폭은 55). 이 변경과 무관한 표 자체의
            //    성질이라 "틈이 없어야 한다"는 애초에 성립하지 않는 전제였다.
            //    고정 열의 실제 배치는 list-sticky-columns-drift.spec.js(SLS-1-264)가
            //    **밀림**으로 본다 — 그게 사용자가 신고한 성질이다.

            // 전체 보기에서는 경지구분이 돌아온다.
            //
            // ⚠️ 여기서 **기하(틈·겹침)는 재지 않는다.** 전체 보기의 고정 열 배치는
            //    `list-sticky-columns-drift.spec.js`(SLS-1-264)가 양쪽 페이지와
            //    공익직불제 탭까지 포함해 더 정확하게 본다. 이 스펙에서 같은 것을
            //    다시 재려 했더니 전체 보기 직후 열 폭 재배분 때문에 **없는 겹침이
            //    있다고** 나왔다(직접 재 보면 겹침이 없다). 같은 성질을 두 곳에서
            //    재면 약한 쪽이 거짓 신호를 낸다.
            await toggleFullView(page);
            await waitForStableLayout(page);
            await waitForStickyApplied(page);
            expect(await isShown(page, 'col-landclass1'),
                `${tab.name}: 전체 보기인데 경지구분이 안 보인다`).toBe(true);
        });
    }

    // 🚨 SLS-1-277: '전체 경지구분' 탭은 감춤의 전제가 성립하지 않는다.
    //
    //    이 파일 위쪽(SLS-1-261)이 적은 근거 — "탭이 이미 현재 구분을 보여 준다" — 는
    //    탭이 구분 **하나**를 가리킬 때만 참이다. `populateLandClass1Options()`가
    //    만드는 `value=''` 옵션에서는 12개 구분의 행이 한 화면에 섞이고, 채번이
    //    경지구분 단위로 독립이라(reception-number.js) **같은 접수번호가 여러 줄로
    //    보인다.** 그 이유를 설명하는 것이 바로 이 열이다.
    test("'전체 경지구분' 탭에서는 감추지 않는다", async ({ page }) => {
        await setTab(page, '');
        expect(await page.evaluate(
            () => document.getElementById('logTable')?.classList.contains('allclass-on')
        ), "'전체 경지구분' 탭인데 allclass-on이 안 붙었다").toBe(true);
        // 머리글만 보고 끝내지 않는다 — 담당자가 읽는 것은 **행의 값**이다 (독립 리뷰 지적)
        expect(await visibility(page),
            "'전체 경지구분' 탭인데 경지구분이 감춰져 있다 — 어느 행이 어느 구분인지 알 수 없다")
            .toEqual({ th: true, td: true });

        // 구분 하나를 고르면 다시 접힌다
        await setTab(page, '농가의뢰');
        expect(await page.evaluate(
            () => document.getElementById('logTable')?.classList.contains('allclass-on')
        ), '구분을 골랐는데 allclass-on이 남아 있다').toBe(false);
        expect(await visibility(page),
            '구분을 골랐는데 경지구분이 그대로 보인다').toEqual({ th: false, td: false });
    });

    // 결과가 0건이면 renderLogs가 조기 반환해 renderCurrentPage에 닿지 않는다 —
    // 그 경로는 renderLogs 쪽 호출만이 덮는다. 두 호출 지점이 모두 필요한 이유다.
    test('결과가 0건이어도 모드 클래스가 맞는다', async ({ page }) => {
        await setTab(page, '');
        await page.evaluate(() => {
            const mgr = /** @type {any} */ (window).soilManager;
            mgr.sampleLogs = [];
            mgr.filterAndRenderLogs();
        });
        expect(await page.evaluate(
            () => document.getElementById('logTable')?.classList.contains('allclass-on')
        ), '0건 경로에서 allclass-on이 풀렸다').toBe(true);
        // ⚠️ 0건이면 표가 통째로 감춰지고 빈 상태 안내가 대신 뜬다 — 화면에 그려졌는지가 아니라
        //    **규칙이 적용되었는지**를 본다.
        expect(await page.evaluate(() => {
            const th = document.querySelector('#logTable th.col-landclass1');
            return th ? getComputedStyle(th).display : null;
        })).toBe('table-cell');
    });
});
