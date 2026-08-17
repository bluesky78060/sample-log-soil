// @ts-check
// SLS-1-249: 퇴비 목록에서 &·<·" 가 엔티티 글자로 보이던 문제
//
// 🚨 이건 **적대적 검증이 잡은 것**이다. escapeHTML 수정만 하고 넘어갔으면
//    `홍"길동` 이 `홍&quot;길동` 으로 보이는 회귀를 함께 배포할 뻔했다.
//
//    compost-script.js는 성명·주소·연락처·비고를 escapeHTML로 감싼 뒤
//    textContent · title · dataset.tooltip 에 넣고 있었다.
//    그 셋은 **HTML을 파싱하지 않는 텍스트 싱크**다 — 이스케이프하면 엔티티가 그대로 보인다.
//    (&·<·> 는 이 티켓 전에도 이미 깨져 있었다)
//
// ⚠️ 이 스펙은 **textContent를 읽어야** 의미가 있다. innerHTML을 읽으면
//    브라우저가 다시 이스케이프해서 `&amp;` 가 나오므로 정상·비정상을 구분하지 못한다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

// & < > " ' 를 한 번에 — 하나라도 새면 잡힌다
const NAME = '홍길동 & 김철수';
const NOTE = '가로 3" <급함> & 재검토';
const ADDR = '봉화읍 내성리 1"동';

async function seed(page, log) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/compost/');
    expect(res && res.status(), 'docs/compost/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.compostManager, { timeout: 15000 });

    await page.evaluate((row) => {
        const m = window.compostManager;
        const key = m.getStorageKey(m.selectedYear);
        localStorage.setItem(key, JSON.stringify([row]));
    }, log);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
        () => (window.compostManager?.sampleLogs || []).length === 1, null, { timeout: 15000 });
}

const baseLog = {
    id: 'C1', receptionNumber: '1', date: '2026-08-17',
    sampleType: '퇴비', animalType: '우분', purpose: '부숙도',
    receptionMethod: '방문', farmName: '행복농장',
};

/**
 * 목록 행의 셀들을 textContent로 읽는다.
 *
 * ⚠️ 헤더는 **`#logTableBody`가 속한 표에서만** 뽑는다. 퇴비 페이지에는 표가 4개
 *    (logTableBody/resultTableBody/previewTableBody/caFieldsBody) 있어서
 *    `table thead th`로 전부 긁으면 인덱스가 어긋나 엉뚱한 셀을 읽는다.
 * ⚠️ 성명 열의 실제 표기는 **'대표자'** 다.
 */
const cellsOf = (page) => page.evaluate(() => {
    const tbody = document.getElementById('logTableBody');
    const table = tbody?.closest('table');
    const tr = tbody?.querySelector('tr');
    if (!table || !tr) return null;
    const heads = [...table.querySelectorAll('thead th')].map((t) => t.textContent.trim());
    const cellAt = (label) => {
        const i = heads.indexOf(label);
        return i < 0 ? null : tr.children[i];
    };
    const nameCell = cellAt('대표자');
    const noteCell = cellAt('비고');
    return {
        heads,
        name: nameCell?.textContent ?? null,
        note: noteCell?.textContent ?? null,
        noteTooltip: noteCell?.dataset?.tooltip ?? null,
        nameTitle: nameCell?.title ?? null,
    };
});

test.describe('퇴비 목록 특수문자 표시 (SLS-1-249)', () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 이 티켓 전부터 깨져 있던 것 — & 와 < 가 엔티티로 보였다
    // ══════════════════════════════════════════════════════════════
    test('& 와 < 가 엔티티 글자로 보이지 않는다', async ({ page }) => {
        await seed(page, { ...baseLog, name: NAME, note: NOTE });
        const c = await cellsOf(page);
        expect(c, '행을 못 찾았다').toBeTruthy();

        expect(c.name, "&amp; 가 글자로 보인다").toBe(NAME);
        expect(c.name).not.toContain('&amp;');
        expect(c.note, '&lt; 가 글자로 보인다').toBe(NOTE);
        expect(c.note).not.toContain('&lt;');
    });

    // 🚨 escapeHTML이 따옴표까지 처리하게 되면서 새로 깨질 뻔한 것
    test('큰따옴표가 &quot; 로 보이지 않는다', async ({ page }) => {
        await seed(page, { ...baseLog, name: '홍"길동', note: NOTE, addressRoad: ADDR });
        const c = await cellsOf(page);
        expect(c, '행을 못 찾았다').toBeTruthy();
        expect(c.name, '&quot; 가 글자로 보인다').toBe('홍"길동');
        expect(c.name).not.toContain('&quot;');
    });

    // 툴팁·title은 화면에 안 보여서 놓치기 쉽다 — 여기도 텍스트 싱크다
    test('툴팁과 title에도 엔티티가 새지 않는다', async ({ page }) => {
        await seed(page, { ...baseLog, name: NAME, note: NOTE });
        const c = await cellsOf(page);
        expect(c, '행을 못 찾았다').toBeTruthy();

        expect(c.noteTooltip, '비고 툴팁에 엔티티가 남았다').toBe(NOTE);
        expect(c.nameTitle, '성명 title에 엔티티가 남았다').toContain(NAME);
    });

    // 🚨 텍스트 싱크라 이스케이프를 뺐다 — 그래도 스크립트가 실행되면 안 된다.
    //    textContent는 HTML을 파싱하지 않으므로 태그가 '글자'로 남아야 정상이다.
    test('태그 문자열이 실제 요소로 파싱되지 않는다', async ({ page }) => {
        await seed(page, { ...baseLog, name: '<img src=x onerror=alert(1)>', note: '-' });
        const injected = await page.evaluate(() =>
            document.querySelectorAll('#logTableBody img').length);
        expect(injected, 'textContent인데 태그가 파싱됐다 — 싱크가 바뀌었다').toBe(0);

        const c = await cellsOf(page);
        expect(c.name, '태그가 글자 그대로 남아야 한다').toBe('<img src=x onerror=alert(1)>');
    });
});
