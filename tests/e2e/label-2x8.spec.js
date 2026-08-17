// @ts-check
// SLS-1-248: 프린텍 V3240 16칸(2열 8행) 규격 추가
//
// 🚨 이 스펙이 지키는 것 중 가장 값비싼 것은 **인쇄 시 축소 해제**다.
//    .label-preview에 scale(0.6)이 걸려 있어, @media print의 예외 목록에서 빠지면
//    60% 크기로 인쇄되어 **라벨지 한 장이 통째로 버려진다.** 되돌릴 수 없는 소모다.
//
// 🚨 그리고 시작 위치 범위 방어. 16칸에서 17이 들어가면 firstPageSlots가 0이 되어
//    빈 페이지가 생기고 장수 계산이 깨진다.
//
// 규격 근거(제조사 확인): V3260 18칸 = 100×30mm / V3240 16칸 = 99.06×33.85mm
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const ROWS = [
    ['성명', '주소', '우편번호'],
    ...Array.from({ length: 20 }, (_, i) => [`홍길동${i + 1}`, `봉화읍 내성리 ${i + 1}`, '36239']),
];

/**
 * ⚠️ 템플릿 선택과 시작위치 프리뷰는 **데이터를 올려야 나타나는 영역** 안에 있다.
 *    그냥 열면 `element is not visible`로 막히므로, 그 영역을 드러낸 뒤 조작한다.
 *    (CSS 치수 검증에는 필요 없지만 클릭·selectOption에는 필요하다)
 */
async function openLabelApp(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/label-print/');
    expect(res && res.status(), 'docs/label-print/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!document.getElementById('labelTemplate'), { timeout: 15000 });

    // 숨겨진 조상들을 드러낸다
    await page.evaluate(() => {
        let n = document.getElementById('labelTemplate');
        while (n && n !== document.body) {
            const cs = getComputedStyle(n);
            if (cs.display === 'none') n.style.display = 'block';
            if (cs.visibility === 'hidden') n.style.visibility = 'visible';
            n.classList?.remove('hidden');
            n = n.parentElement;
        }
    });
    await expect(page.locator('#labelTemplate')).toBeVisible();
    // 프리뷰가 그려질 때까지 (초기 렌더는 DOMContentLoaded에서 돈다)
    await expect
        .poll(() => page.locator('#labelGridPreview .label-cell').count(), { timeout: 10000 })
        .toBeGreaterThan(0);
}

const setTemplate = async (page, key) => {
    await page.locator('#labelTemplate').selectOption(key);
    await page.waitForFunction(
        (k) => document.getElementById('labelTemplate')?.value === k, key);
};

const cellCount = (page) => page.locator('#labelGridPreview .label-cell').count();
const startPos = (page) => page.locator('#labelStartPosition').inputValue();

test.describe('16칸 라벨 규격 (SLS-1-248)', () => {
    test('선택지에 16칸이 있고 고를 수 있다', async ({ page }) => {
        await openLabelApp(page);
        const opts = await page.locator('#labelTemplate option').allTextContents();
        expect(opts.join(' '), '16칸 선택지가 없다').toMatch(/2열 8행.*16개/);
        await setTemplate(page, '2x8');
        expect(await page.locator('#labelTemplate').inputValue()).toBe('2x8');
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 프리뷰 칸 수 — 안 바뀌면 없는 칸(17·18)을 고를 수 있다
    // ══════════════════════════════════════════════════════════════
    test('템플릿을 바꾸면 시작위치 칸 수가 따라 바뀐다', async ({ page }) => {
        await openLabelApp(page);
        expect(await cellCount(page), '기본(18칸) 프리뷰가 안 그려졌다').toBe(18);

        await setTemplate(page, '2x8');
        expect(await cellCount(page), '16칸인데 프리뷰가 안 줄었다').toBe(16);

        // 되돌리면 복원된다
        await setTemplate(page, '2x9');
        expect(await cellCount(page), '18칸으로 복원되지 않았다').toBe(18);
    });

    // 🚨 칸 수가 줄 때 이전 선택이 범위 밖으로 남으면 장수 계산이 깨진다
    test('18칸에서 17을 고른 뒤 16칸으로 바꾸면 시작 위치가 되돌아온다', async ({ page }) => {
        await openLabelApp(page);
        await page.locator('#labelGridPreview .label-cell[data-pos="17"]').click();
        expect(await startPos(page), '17이 선택되지 않았다').toBe('17');

        await setTemplate(page, '2x8');
        expect(await startPos(page), '범위 밖 시작 위치가 남았다').toBe('1');
    });

    // 셀을 다시 그려도 클릭이 살아 있어야 한다 (이벤트 위임)
    test('프리뷰를 다시 그린 뒤에도 칸을 고를 수 있다', async ({ page }) => {
        await openLabelApp(page);
        await setTemplate(page, '2x8');
        await page.locator('#labelGridPreview .label-cell[data-pos="16"]').click();
        expect(await startPos(page), '재생성 후 클릭이 죽었다 — 리스너가 사라졌다').toBe('16');
        await expect(
            page.locator('#labelGridPreview .label-cell[data-pos="16"]'),
            '선택 표시가 안 된다'
        ).toHaveClass(/start/);
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 인쇄 축소 해제 — 빠지면 60%로 인쇄되어 라벨지가 버려진다
    // ══════════════════════════════════════════════════════════════
    test('인쇄 시 16칸 시트에 축소가 남지 않는다', async ({ page }) => {
        await openLabelApp(page);
        // 실제 시트 요소를 만들어 @media print 규칙을 적용해 본다
        const applied = await page.evaluate(() => {
            const el = document.createElement('div');
            el.className = 'label-sheet-2x8 label-preview';
            document.body.appendChild(el);
            const t = getComputedStyle(el).transform;
            el.remove();
            return t;
        });
        // 화면(screen)에서는 축소가 걸려 있어야 정상
        expect(applied, '미리보기 축소 자체가 없다 — 전제가 바뀌었다').not.toBe('');

        await page.emulateMedia({ media: 'print' });
        const printed = await page.evaluate(() => {
            const el = document.createElement('div');
            el.className = 'label-sheet-2x8 label-preview';
            document.body.appendChild(el);
            const t = getComputedStyle(el).transform;
            el.remove();
            return t;
        });
        expect(printed, '인쇄 시 축소가 남아 있다 — 60% 크기로 인쇄된다')
            .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    });

    // 🚨 계산이 아니라 **실제 렌더 위치**로 좌우 대칭을 확인한다.
    //    CSS 값만 보면 justify-content가 만드는 여백을 놓친다.
    test('16칸 라벨이 좌우 대칭으로 배치된다', async ({ page }) => {
        await openLabelApp(page);
        const pos = await page.evaluate(() => {
            const sheet = document.createElement('div');
            sheet.className = 'label-sheet-2x8';
            for (let i = 0; i < 16; i++) {
                const c = document.createElement('div');
                c.className = 'label-item';
                sheet.appendChild(c);
            }
            document.body.appendChild(sheet);
            const sr = sheet.getBoundingClientRect();
            const first = sheet.children[0].getBoundingClientRect();
            const second = sheet.children[1].getBoundingClientRect();
            const v = {
                leftGap: first.left - sr.left,
                rightGap: sr.right - second.right,
                gutter: second.left - first.right,
            };
            sheet.remove();
            return v;
        });
        const mm = (px) => px / 3.7795275591;
        // 좌우 여백이 같아야 한다 (0.3mm 이내)
        expect(Math.abs(mm(pos.leftGap) - mm(pos.rightGap)),
            `좌 ${mm(pos.leftGap).toFixed(2)}mm / 우 ${mm(pos.rightGap).toFixed(2)}mm — 치우쳤다`)
            .toBeLessThan(0.3);
        expect(mm(pos.leftGap), '좌측 여백이 계산값과 다르다').toBeCloseTo(4.44, 1);
        expect(mm(pos.gutter), '가운데 간격이 3mm가 아니다').toBeCloseTo(3, 1);
    });

    // 기존 규격도 같은 보호를 받는가 (회귀)
    test('인쇄 시 18칸 시트도 축소가 없다', async ({ page }) => {
        await openLabelApp(page);
        await page.emulateMedia({ media: 'print' });
        const t = await page.evaluate(() => {
            const el = document.createElement('div');
            el.className = 'label-sheet-2x9 label-preview';
            document.body.appendChild(el);
            const v = getComputedStyle(el).transform;
            el.remove();
            return v;
        });
        expect(t).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    });

    // 🚨 실물 규격 — 틀리면 라벨이 어긋나 인쇄된다
    test('16칸 시트의 치수가 제조사 규격과 맞다', async ({ page }) => {
        await openLabelApp(page);
        const css = await page.evaluate(() => {
            const el = document.createElement('div');
            el.className = 'label-sheet-2x8';
            document.body.appendChild(el);
            const s = getComputedStyle(el);
            const v = {
                cols: s.gridTemplateColumns,
                rows: s.gridTemplateRows,
                top: s.paddingTop,
                bottom: s.paddingBottom,
                left: s.paddingLeft,
                justify: s.justifyContent,
                height: s.height,
                box: s.boxSizing,
            };
            el.remove();
            return v;
        });
        // 브라우저는 mm를 px로 환산한다 — 1mm ≈ 3.7795px
        const mm = (px) => parseFloat(px) / 3.7795275591;
        expect(css.box, 'border-box가 아니면 세로 계산 전제가 깨진다').toBe('border-box');
        expect(mm(css.height), '시트 높이가 A4가 아니다').toBeCloseTo(297, 0);
        expect(mm(css.top), '상단 여백이 다르다').toBeCloseTo(13.1, 1);
        expect(mm(css.bottom), '하단 여백이 다르다').toBeCloseTo(13.1, 1);

        const rows = css.rows.split(/\s+/).filter(Boolean);
        expect(rows.length, '8행이 아니다').toBe(8);
        expect(mm(rows[0]), '행 높이가 33.85mm가 아니다').toBeCloseTo(33.85, 1);

        const cols = css.cols.split(/\s+/).filter(Boolean);
        expect(cols.length, '2열이 아니다').toBe(2);
        expect(mm(cols[0]), '열 너비가 99.06mm가 아니다').toBeCloseTo(99.06, 1);

        // ══════════════════════════════════════════════════════════════
        // 🚨 가로 대칭 — 코드리뷰가 잡은 결함. padding-left와 justify-content:center가
        //    겹치면 좌 6.94 / 우 1.94mm로 크게 치우쳐 라벨이 어긋나 인쇄된다.
        // ══════════════════════════════════════════════════════════════
        expect(mm(css.left), '좌측 padding이 있으면 좌우가 치우친다').toBeCloseTo(0, 1);

        // 🚨 세로가 A4를 넘으면 마지막 행이 잘린다
        expect(13.1 + 33.85 * 8 + 13.1, '세로 합이 297mm가 아니다').toBeCloseTo(297, 3);
    });
});
