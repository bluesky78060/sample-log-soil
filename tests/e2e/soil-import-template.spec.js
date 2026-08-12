// @ts-check
// SLS-1-225: 가져오기 기본 서식 다운로드 — 실제 화면·실제 파일
//
// ⚠️ window.XLSX는 **모듈 네임스페이스 객체(frozen)** 라 프로퍼티 대입이 조용히 무시된다.
//    (194 퇴비 프로브가 침묵한 실제 원인 — tests/e2e/soil-export-sheets.spec.js:1-7)
//    반드시 window.XLSX **객체 자체를** 얕은 복사본으로 교체해야 한다.
//
// 유닛(soil-import-template.test.js)은 순수 함수 buildTemplateSheets()를 본다.
// 여기서는 버튼이 실제로 보이고, 눌렀을 때 그 구성이 워크북까지 실려 나가는지 본다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

async function openImportModal(page) {
    await page.goto('/soil/');
    await page.waitForFunction(() => !!document.querySelector('#soilImportBtn'), { timeout: 15000 });
    await page.click('#soilImportBtn');
    await page.waitForSelector('[data-act="dlTemplate"]', { state: 'visible', timeout: 10000 });
}

test.describe('가져오기 기본 서식 (SLS-1-225)', () => {
    test('파일을 올리기 전에 서식 버튼이 보인다', async ({ page }) => {
        await openImportModal(page);
        const btn = page.locator('[data-act="dlTemplate"]');
        await expect(btn).toBeVisible();
        await expect(btn).toHaveText(/서식/);

        // 시트 선택(fileOpts)은 아직 숨어 있어야 한다 — 서식은 그보다 먼저 필요하다
        await expect(page.locator('[data-el="fileOpts"]'), '파일 전인데 시트 선택이 보인다')
            .toBeHidden();
    });

    test('누르면 시트 4개짜리 워크북이 만들어진다', async ({ page }) => {
        await openImportModal(page);

        const wb = await page.evaluate(() => {
            const orig = window.XLSX;
            let captured = null;
            // frozen 네임스페이스라 프로퍼티 대입 불가 → 객체 교체
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
                out[name] = { headers: rows[0], sample: rows[1] };
            }
            return { names: captured.SheetNames, sheets: out };
        });

        expect(wb, 'writeFile이 호출되지 않았다 — 가로채기 실패이거나 다운로드가 안 됨').toBeTruthy();
        expect(wb.names).toEqual(['자체', '대표필지', '농가의뢰', '공익직불제']);

        // 개인정보 분리가 실제 파일에서도 지켜지는가
        for (const n of ['자체', '대표필지']) {
            for (const pii of ['성명', '연락처', '농가주소(경작자)']) {
                expect(wb.sheets[n].headers, `${n} 시트에 ${pii}가 있다`).not.toContain(pii);
            }
        }
        expect(wb.sheets['농가의뢰'].headers).toContain('농가주소(경작자)');
        expect(wb.sheets['공익직불제'].headers).toContain('경영체등록번호');

        // 예시 행 — 식별 필드에 경고, 접수번호는 비움
        const s = wb.sheets['자체'];
        expect(s.sample[s.headers.indexOf('지번주소')]).toMatch(/예시|삭제/);
        expect(s.sample[s.headers.indexOf('접수번호')]).toBe('');
    });
});
