// @ts-check
// SLS-1-225 / SLS-1-231: 가져오기 기본 서식 — 실제 화면·실제 파일·실제 왕복
//
// ⚠️ window.XLSX는 **모듈 네임스페이스 객체(frozen)** 라 프로퍼티 대입이 조용히 무시된다.
//    (194 퇴비 프로브가 침묵한 실제 원인 — tests/e2e/soil-export-sheets.spec.js:1-7)
//    반드시 window.XLSX **객체 자체를** 얕은 복사본으로 교체해야 한다.
//
// 유닛(soil-import-template.test.js)은 순수 함수 buildTemplateSheets()를 본다.
// 여기서는 **버튼 → 워크북 → 실제 파일 → 다시 가져오기**까지 이어지는지 본다.
//
// 🚨 왕복이 이 기능의 전부다. 내려준 서식을 우리 앱이 못 읽으면 서식이 아니다.
//    메모리 워크북만 검사하면 직렬화·헤더 행 인식·매핑이 깨져도 통과한다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const SHEET_NAMES = ['자체, 대표필지', '시료접수대장', '일괄등록양식'];

async function openImportModal(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.goto('/soil/');
    await page.waitForFunction(() => !!document.querySelector('#soilImportBtn'), { timeout: 15000 });
    await page.click('#soilImportBtn');
    await page.waitForSelector('[data-act="dlTemplate"]', { state: 'visible', timeout: 10000 });
}

/** 서식 버튼을 눌러 만들어지는 워크북을 가로채 바이트로 돌려준다 */
async function captureTemplateBytes(page) {
    return page.evaluate(() => {
        const orig = window.XLSX;
        let captured = null;
        window.XLSX = { ...orig, utils: orig.utils, writeFile: (w) => { captured = w; } };
        try {
            document.querySelector('[data-act="dlTemplate"]').click();
        } finally {
            window.XLSX = orig;
        }
        if (!captured) return null;
        // 실제 파일과 같은 바이트로 직렬화한다 — 메모리 객체만 보면 직렬화 손실을 놓친다
        const out = window.XLSX.write(captured, { type: 'array', bookType: 'xlsx' });
        return Array.from(new Uint8Array(out));
    });
}

test.describe('가져오기 기본 서식', () => {
    test('파일을 올리기 전에 서식 버튼이 보인다', async ({ page }) => {
        await openImportModal(page);
        const btn = page.locator('[data-act="dlTemplate"]');
        await expect(btn).toBeVisible();
        await expect(btn).toHaveText(/서식/);

        // 시트 선택(fileOpts)은 아직 숨어 있어야 한다 — 서식은 그보다 먼저 필요하다
        await expect(page.locator('[data-el="fileOpts"]'), '파일 전인데 시트 선택이 보인다')
            .toBeHidden();
    });

    test('누르면 3개 시트가 제목·안내문·헤더·예시 4행으로 만들어진다', async ({ page }) => {
        await openImportModal(page);

        const wb = await page.evaluate(() => {
            const orig = window.XLSX;
            let captured = null;
            window.XLSX = { ...orig, utils: orig.utils, writeFile: (w) => { captured = w; } };
            try {
                document.querySelector('[data-act="dlTemplate"]').click();
            } finally {
                window.XLSX = orig;
            }
            if (!captured) return null;
            const out = {};
            for (const name of captured.SheetNames) {
                const rows = window.XLSX.utils.sheet_to_json(captured.Sheets[name], { header: 1, defval: '' });
                out[name] = { title: rows[0]?.[0], guide: rows[1]?.[0], headers: rows[2], sample: rows[3], nRows: rows.length };
            }
            return { names: captured.SheetNames, sheets: out };
        });

        expect(wb, 'writeFile이 호출되지 않았다 — 가로채기 실패이거나 다운로드가 안 됨').toBeTruthy();
        expect(wb.names).toEqual(SHEET_NAMES);

        for (const n of SHEET_NAMES) {
            const s = wb.sheets[n];
            expect(s.nRows, `${n}: 4행 구조가 아니다`).toBe(4);
            expect(s.title, `${n}: 제목이 없다`).toBeTruthy();
            expect(s.guide, `${n}: 안내문이 없다`).toMatch(/4행/);
            // 헤더가 한 줄인가 — 2단 헤더로 되돌아가면 빈 칸이 생긴다
            for (const h of s.headers) expect(String(h).trim(), `${n}: 빈 헤더 칸`).not.toBe('');
        }

        // 개인정보 분리가 실제 파일에서도 지켜지는가
        for (const pii of ['성명', '전화번호', '농가 주소', '경작자명', '경작자 주소']) {
            expect(wb.sheets['자체, 대표필지'].headers, `자체·대표필지에 ${pii}가 있다`).not.toContain(pii);
        }
        expect(wb.sheets['시료접수대장'].headers).toContain('농가 주소');
        expect(wb.sheets['일괄등록양식'].headers).toContain('경영체등록번호');

        // 예시 행 — 식별 필드에 경고, 접수번호는 비움
        const s2 = wb.sheets['시료접수대장'];
        expect(s2.sample[s2.headers.indexOf('필지 주소')]).toMatch(/예시|삭제/);
        expect(s2.sample[s2.headers.indexOf('접수번호')]).toBe('');
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 이 기능의 핵심 — 내려준 서식을 우리 앱이 다시 읽는가
    // ══════════════════════════════════════════════════════════════
    test('내려받은 서식을 그대로 다시 올리면 헤더 행과 매핑이 자동으로 잡힌다', async ({ page }) => {
        await openImportModal(page);
        const bytes = await captureTemplateBytes(page);
        expect(bytes, '서식 바이트를 못 얻었다').toBeTruthy();

        await page.locator('.sri-overlay input[type="file"]').first().setInputFiles({
            name: '토양_가져오기_서식.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: Buffer.from(bytes),
        });
        await page.waitForFunction(
            () => !!document.querySelector('.sri-overlay [data-el="headerRow"]:not([disabled])'),
            { timeout: 15000 }
        );

        // 제목이 1행이므로 헤더 행은 3이어야 한다 — 사람이 안 바꿔도
        await expect(
            page.locator('.sri-overlay [data-el="headerRow"]'),
            '헤더 행을 자동으로 못 찾아 제목을 헤더로 썼다'
        ).toHaveValue('3');

        const state = await page.evaluate(() => ({
            sheet: window.SoilResultImporter._state.activeSheet,
            mapping: window.SoilResultImporter._state.fieldMapping,
            headers: window.SoilResultImporter._parseInput().headers,
        }));

        expect(state.sheet).toBe('자체, 대표필지');
        // 개수만 세면 엉뚱하게 붙어도 통과한다 — 어느 헤더에 붙었는지 본다
        expect(state.headers[state.mapping.lotAddress]).toBe('필지 주소');
        expect(state.headers[state.mapping.subCategory], '구분이 2차 열에 안 붙었다').toBe('경지구분 2차');
        expect(state.headers[state.mapping.area]).toBe('면적(㎡)');
        expect(state.headers[state.mapping.date]).toBe('채취년월일');
        // 붙으면 안 되는 열
        const used = Object.values(state.mapping);
        expect(used, '필지구분이 매핑됐다').not.toContain(state.headers.indexOf('필지구분'));
        expect(used, '경지구분 1차가 매핑됐다').not.toContain(state.headers.indexOf('경지구분 1차'));
        expect(used, '화학성분값이 매핑됐다').not.toContain(state.headers.indexOf('pH'));
    });

    test('다시 올린 서식의 예시 행이 경고와 함께 미리보기에 보인다', async ({ page }) => {
        await openImportModal(page);
        const bytes = await captureTemplateBytes(page);

        await page.locator('.sri-overlay input[type="file"]').first().setInputFiles({
            name: '토양_가져오기_서식.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: Buffer.from(bytes),
        });
        await expect
            .poll(() => page.locator('.sri-pv-table tbody tr').count(), { timeout: 10000 })
            .toBe(1);

        // 🚨 예시 행을 지우지 않고 가져오면 그대로 저장된다 —
        //    식별 필드의 경고가 미리보기에서 눈에 띄어야 걸린다
        const body = await page.locator('.sri-pv-table tbody').innerText();
        expect(body, '예시 행에 경고가 안 보인다 — 그냥 저장될 수 있다').toMatch(/예시|삭제/);
        // 제목·안내문이 데이터로 섞이지 않았는가
        expect(body, '제목이 데이터로 들어갔다').not.toContain('기본 서식');
    });
});
