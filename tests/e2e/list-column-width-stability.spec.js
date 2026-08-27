// @ts-check
// SLS-1-279: 전체 보기를 켤 때 열 폭이 통째로 흔들리지 않는다 · 관리 열 구분선
//
// 🚨 이 결함은 **넓은 화면에서만** 나온다
//    `.data-table`이 `width: 100%`라 표가 화면보다 좁으면 남는 폭이 모든 열에
//    분배된다. 그 상태에서 전체 보기로 열 둘이 끼어들면 나머지가 전부 양보한다.
//    실측: 1440px에서는 0개, **1800px에서는 14개** 열의 폭이 바뀌었다.
//    좁은 화면만 보는 시험은 이것을 영원히 못 잡는다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

/** 흡수 열 — 남는 폭을 이 열이 가져간다 */
const ABSORBER = '필지 주소';

const makeSoilLogs = (n) =>
    Array.from({ length: n }, (_, i) => ({
        id: 'id' + i,
        receptionNumber: String(501 + i),
        name: '홍길동',
        landClass1: '농가의뢰',
        subCategory: '논',
        date: '2026-08-12',
        isComplete: false,
        receptionMethod: '방문수령',
        address: '봉화군 물야면 오전길 163',
        addressPostcode: '37190',
        phone: '010-1234-1234',
        parcels: [{
            id: 'p' + i,
            lotAddress: '봉화군 물야면 오전리 일반 709',
            subLots: [],
            crops: [{ name: '사과(5-9년생)', area: '2460' }],
        }],
    }));

async function seedSoil(page, logs, { waitRows = true } = {}) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/soil/');
    expect(res && res.status(), 'docs/soil/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof window.soilManager !== 'undefined');
    await page.evaluate((rows) => {
        const year = window.soilManager.selectedYear;
        localStorage.setItem(`soilSampleLogs_${year}`, JSON.stringify(rows));
        localStorage.setItem('soilItemsPerPage', '100');
    }, logs);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
        (n) => (window.soilManager?.sampleLogs || []).length === n, logs.length);
    await page.evaluate(() => window.soilManager.switchView('list'));
    if (waitRows) {
        await page.waitForFunction(() => document.querySelectorAll('#logTableBody tr[data-id]').length > 0);
    }
}

/** 지금 보이는 머리글 칸들의 폭 */
const columnWidths = (page) => page.evaluate(() =>
    [...document.querySelectorAll('#logTable thead th')]
        .filter((th) => getComputedStyle(th).display !== 'none')
        .map((th) => ({
            name: th.textContent.trim() || '(선택)',
            width: Math.round(th.getBoundingClientRect().width),
        })));

const toggleFullView = async (page) => {
    await page.evaluate(() => document.getElementById('viewToggleBtn').click());
    await page.waitForTimeout(200);
};

/** 전후를 견줘 폭이 바뀐 열만 추린다. 새로 나타난 열은 셈에서 뺀다. */
function changedColumns(before, after) {
    return after
        .map((a) => {
            const b = before.find((x) => x.name === a.name);
            return b && b.width !== a.width ? { name: a.name, delta: a.width - b.width } : null;
        })
        .filter(Boolean);
}

test.describe('전체 보기에서 열 폭 안정 — 넓은 화면 (SLS-1-279)', () => {
    test.use({ viewport: { width: 1800, height: 900 } });

    test('흡수 열 하나만 줄고 나머지는 그대로다', async ({ page }) => {
        await seedSoil(page, makeSoilLogs(120));

        const before = await columnWidths(page);
        await toggleFullView(page);
        const after = await columnWidths(page);

        const changed = changedColumns(before, after);
        // 🚨 고치기 전에는 14개였다
        expect(changed.map((c) => c.name)).toEqual([ABSORBER]);
        expect(changed[0].delta, '흡수 열이 남는 폭을 내놓아야 한다').toBeLessThan(0);
    });

    test('흡수 열이 내용보다 좁아지지 않는다', async ({ page }) => {
        await seedSoil(page, makeSoilLogs(120));
        await toggleFullView(page);

        const fits = await page.evaluate((label) => {
            const th = [...document.querySelectorAll('#logTable thead th')]
                .find((el) => el.textContent.trim() === label);
            const td = document.querySelector('#logTableBody td.col-lot-address');
            if (!th || !td) return null;
            // nowrap이면 내용이 넘칠 때 scrollWidth가 clientWidth보다 커진다
            return { headOk: th.scrollWidth <= th.clientWidth + 1,
                     cellOk: td.scrollWidth <= td.clientWidth + 1 };
        }, ABSORBER);

        expect(fits, '흡수 열을 찾지 못했다').not.toBeNull();
        expect(fits.headOk, '머리글이 잘렸다').toBe(true);
        expect(fits.cellOk, '주소가 잘렸다').toBe(true);
    });

    test('공익직불제 탭에서도 흡수 열만 바뀐다', async ({ page }) => {
        // codex 플랜 리뷰 제안 — 모드가 겹칠 때가 가장 위험하다.
        // ⚠️ 목록은 경지구분 탭으로 먼저 걸러진다(기본 '농가의뢰'). 탭을 옮기기 전에는
        //    공익직불제 레코드가 한 줄도 안 나오므로 행을 기다리면 안 된다.
        await seedSoil(page, makeSoilLogs(120).map((l) => ({ ...l, landClass1: '공익직불제' })),
            { waitRows: false });
        await page.evaluate(() => {
            const el = document.getElementById('landClass1Tab');
            el.value = '공익직불제';
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.waitForFunction(() =>
            document.getElementById('logTable').classList.contains('gongik-on')
            && document.querySelectorAll('#logTableBody tr[data-id]').length > 0);

        const before = await columnWidths(page);
        await toggleFullView(page);
        const after = await columnWidths(page);

        const changed = changedColumns(before, after);
        expect(changed.map((c) => c.name)).toEqual([ABSORBER]);
    });

    test('흡수 열이 폭을 바꾸는 구간에는 가로로 되돌릴 여지가 거의 없다', async ({ page }) => {
        // 🚨 codex가 "SLS-1-278의 가로 보정과 흡수 열이 부딪히지 않느냐"고 물었고,
        //    재 보니 **두 조건이 거의 배타적**이었다.
        //
        //    · 흡수 열이 폭을 바꾸려면 표가 화면 안에 들어와야 한다(남는 폭이 있어야 한다)
        //    · 가로 보정이 의미 있으려면 표가 화면보다 훨씬 넓어야 한다
        //
        //    실측(1800px): 전체 보기에서 표가 넘치는 양이 **22px뿐**이다. 그 정도면
        //    되돌릴 것도 없다. 반대로 표가 크게 넘치는 화면에서는 남는 폭이 없어
        //    흡수 열도 폭을 바꾸지 않고, 일반 열이 전부 같은 양만큼 움직인다
        //    (= SLS-1-278이 기대는 전제 그대로).
        //
        //    가로 보정 자체의 검증은 tests/e2e/list-column-toggle-anchor.spec.js가
        //    표가 크게 넘치는 폭에서 맡는다.
        await seedSoil(page, makeSoilLogs(120));
        await toggleFullView(page);

        const max = await page.evaluate(() => {
            const w = document.querySelector('.table-wrapper');
            return Math.round(w.scrollWidth - w.clientWidth);
        });

        expect(max, '이 구간에서 가로 여유가 크다면 두 기능이 겹친다 — 다시 따져야 한다')
            .toBeLessThan(50);
    });
});

test.describe('전체 보기에서 열 폭 안정 — 좁은 화면 회귀 (SLS-1-279)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('표가 이미 넘치면 아무 열도 바뀌지 않는다', async ({ page }) => {
        // 남는 폭이 없으니 분배할 것도 없다 — 고치기 전에도 0개였다
        await seedSoil(page, makeSoilLogs(120));

        const before = await columnWidths(page);
        await toggleFullView(page);
        const after = await columnWidths(page);

        expect(changedColumns(before, after)).toEqual([]);
    });
});

test.describe('관리 열 구분선 (SLS-1-279)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    /** 일반 머리글 칸의 오른쪽 경계색 — 관리 열의 왼쪽 경계가 이것과 같아야 한다 */
    const borderColors = (page) => page.evaluate(() => {
        const ths = [...document.querySelectorAll('#logTable thead th')]
            .filter((th) => getComputedStyle(th).display !== 'none');
        const plain = ths.find((th) => !th.classList.contains('col-action'));
        const action = document.querySelector('#logTable thead .col-action');
        // 데이터 행 쪽도 함께 본다 (codex 코드 리뷰 제안) — 머리글만 맞고
        // 행 영역이 어긋나면 실제로 보이는 경계는 여전히 다르다.
        const bodyAction = document.querySelector('#logTableBody td.col-action');
        const bodyPlain = document.querySelector('#logTableBody td.col-date');
        return {
            plain: getComputedStyle(plain).borderRightColor,
            action: getComputedStyle(action).borderLeftColor,
            actionWidth: getComputedStyle(action).borderLeftWidth,
            actionPosition: getComputedStyle(action).position,
            bodyAction: bodyAction ? getComputedStyle(bodyAction).borderLeftColor : null,
            bodyPlain: bodyPlain ? getComputedStyle(bodyPlain).borderRightColor : null,
        };
    });

    test('밝은 화면에서 일반 열 경계와 같은 색이다', async ({ page }) => {
        await seedSoil(page, makeSoilLogs(30));
        const c = await borderColors(page);
        // 🚨 고치기 전에는 #e2d9c8(연한 베이지)이라 혼자 약했다
        expect(c.action).toBe(c.plain);
        expect(c.actionWidth, '고정 열임을 나타내는 2px는 유지한다').toBe('2px');
        expect(c.bodyAction, '데이터 행의 관리 열 경계도 같아야 한다').toBe(c.action);
    });

    test('어두운 화면에서도 같은 색이다', async ({ page }) => {
        await seedSoil(page, makeSoilLogs(30));
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        await page.waitForTimeout(150);

        const c = await borderColors(page);
        expect(c.action).toBe(c.plain);
    });
});

test.describe('행 사이 가로 구분선 (SLS-1-279)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    /**
     * 🚨 예전에는 `tr`에만 `border-bottom`이 있었다. 표가 `border-collapse: separate`라
     *    **그 선은 그려지지 않는다** — 명세상 separate 모드에서는 행·행그룹·열·열그룹의
     *    border가 무시된다. 목록에 행 구분선이 아예 없었고, 행마다 들어가는 농가
     *    구분선(초록 줄) 때문에 있는 것처럼 보였을 뿐이다.
     */
    const rowBorders = (page) => page.evaluate(() => {
        const tr = document.querySelector('#logTableBody tr[data-id]');
        const pick = (sel) => {
            const td = tr.querySelector(sel);
            if (!td) return null;
            const cs = getComputedStyle(td);
            return { width: cs.borderBottomWidth, color: cs.borderBottomColor, position: cs.position };
        };
        return {
            plain: pick('td.col-mail-date'),      // 일반 열 (발송일자)
            action: pick('td.col-action'),        // 오른쪽 고정 열 (관리)
            stuckLeft: pick('td.col-num'),        // 왼쪽 고정 열 (접수번호)
        };
    });

    test('일반 열에 행 구분선이 그려진다', async ({ page }) => {
        await seedSoil(page, makeSoilLogs(30));
        await toggleFullView(page);

        const b = await rowBorders(page);
        expect(b.plain, '발송일자 칸을 찾지 못했다').not.toBeNull();
        expect(b.plain.width, '행 구분선이 그려지지 않는다').not.toBe('0px');
    });

    test('고정 열에도 같은 선이 이어진다', async ({ page }) => {
        // 🚨 사용자가 알린 자리다 — 고정 열은 자기 배경(흰색)을 갖고 내용 위에 떠 있어,
        //    행에 그린 선은 그 배경에 가려 끊긴다. 셀에 줘야 이어진다.
        await seedSoil(page, makeSoilLogs(30));
        await toggleFullView(page);

        const b = await rowBorders(page);
        expect(b.action.position, '관리 열이 고정 상태여야 이 시험이 의미가 있다').toBe('sticky');
        expect(b.action.width).toBe(b.plain.width);
        expect(b.action.color).toBe(b.plain.color);
        expect(b.stuckLeft.width).toBe(b.plain.width);
        expect(b.stuckLeft.color).toBe(b.plain.color);
    });

    test('어두운 화면에서도 이어진다', async ({ page }) => {
        await seedSoil(page, makeSoilLogs(30));
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        await page.waitForTimeout(150);

        const b = await rowBorders(page);
        expect(b.action.color).toBe(b.plain.color);
        expect(b.plain.width).not.toBe('0px');
    });

    test('농가 구분선은 영향받지 않는다', async ({ page }) => {
        // 그 행은 `border: none !important`라 그대로여야 한다
        await seedSoil(page, makeSoilLogs(30).map((l, i) => ({ ...l, name: '홍길동' + (i % 3) })));

        const sep = await page.evaluate(() => {
            const td = document.querySelector('#logTableBody tr.farm-separator td');
            return td ? getComputedStyle(td).borderBottomStyle : null;
        });
        expect(sep, '농가 구분선을 찾지 못했다').not.toBeNull();
        expect(sep).toBe('none');
    });
});

test.describe('좁은 화면에서 관리 열 고정 해제 (SLS-1-260 회귀)', () => {
    test.use({ viewport: { width: 1000, height: 900 } });

    test('고정이 풀리고 경계선도 없다', async ({ page }) => {
        // 구분선 색을 바꾸면서 이 규칙을 깨뜨리지 않았는지 본다
        await seedSoil(page, makeSoilLogs(30));

        const c = await page.evaluate(() => {
            const a = document.querySelector('#logTable thead .col-action');
            const cs = getComputedStyle(a);
            return { position: cs.position, borderLeftStyle: cs.borderLeftStyle, right: cs.right };
        });

        expect(c.position).toBe('static');
        expect(c.borderLeftStyle).toBe('none');
    });
});
