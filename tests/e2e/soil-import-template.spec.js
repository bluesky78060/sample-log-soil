// @ts-check
// SLS-1-232: 기본 서식 다운로드 — **원본 .xlsx를 바이트 그대로**
//
// 🚨 앞선 시도(SLS-1-231)는 서식을 코드로 생성했다. 셀 색·테두리·병합이 하나도 없었다.
//    이제는 원본 파일을 그대로 내려준다. 그래서 이 스펙이 지키는 것은
//    "시트가 몇 개인가"가 아니라 **내려받은 파일이 원본과 같은 바이트인가**다.
//
// ⚠️ Blob을 가로채는 대신 **실제 다운로드 이벤트**를 받는다. 그래야 a.click()·파일명·
//    브라우저 저장까지 함께 검증된다. Blob만 보면 다운로드가 안 되어도 통과한다.
//
// ⚠️ 이 스펙은 웹(Chromium)에서 돈다. Electron(file://) 다운로드는 여기서 검증되지 않는다 —
//    같은 Blob 패턴이 앱 곳곳(soil-result-importer.js:1997 등)에서 이미 쓰이고 있다는 것이
//    근거이며, 실기 확인은 별도로 필요하다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');

const SRC_XLSX = resolve(__dirname, '../../src/assets/soil-import-template.xlsx');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function openImportModal(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.goto('/soil/');
    await page.waitForFunction(() => !!document.querySelector('#soilImportBtn'), { timeout: 15000 });
    await page.click('#soilImportBtn');
    await page.waitForSelector('[data-act="dlTemplate"]', { state: 'visible', timeout: 10000 });
}

test.describe('기본 서식 다운로드 (SLS-1-232)', () => {
    test('파일을 올리기 전에 서식 버튼이 보인다', async ({ page }) => {
        await openImportModal(page);
        const btn = page.locator('[data-act="dlTemplate"]');
        await expect(btn).toBeVisible();
        await expect(btn).toHaveText(/서식/);

        // 시트 선택(fileOpts)은 아직 숨어 있어야 한다 — 서식은 그보다 먼저 필요하다
        await expect(page.locator('[data-el="fileOpts"]'), '파일 전인데 시트 선택이 보인다')
            .toBeHidden();
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 이 기능의 핵심 — 내려받은 파일이 원본과 같은 바이트인가
    // ══════════════════════════════════════════════════════════════
    test('내려받은 파일이 원본 서식과 바이트까지 같다', async ({ page }) => {
        await openImportModal(page);

        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            page.click('[data-act="dlTemplate"]'),
        ]);

        expect(download.suggestedFilename(), '다운로드 파일명이 다르다').toBe('토양_기본서식.xlsx');

        const savedPath = await download.path();
        expect(savedPath, '다운로드된 파일 경로를 못 얻었다').toBeTruthy();

        const got = readFileSync(savedPath);
        const original = readFileSync(SRC_XLSX);

        expect(got.length, '바이트 수가 다르다 — XLSX로 다시 쓰면 이렇게 된다').toBe(original.length);
        expect(sha256(got), '내려받은 파일이 원본과 다르다 — 스타일이 날아갔을 수 있다')
            .toBe(sha256(original));
    });

    test('내려받은 파일에 서식 정의가 살아 있다 (색·테두리)', async ({ page }) => {
        await openImportModal(page);
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            page.click('[data-act="dlTemplate"]'),
        ]);
        const raw = readFileSync(await download.path()).toString('latin1');
        // 코드로 생성하면 styles.xml이 사실상 비거나 사라진다
        expect(raw, 'styles.xml이 없다 — 꾸밈 없는 파일이 나갔다').toContain('styles.xml');
    });

    test('내려받은 서식을 그대로 다시 올리면 헤더 행을 자동으로 찾는다', async ({ page }) => {
        await openImportModal(page);
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            page.click('[data-act="dlTemplate"]'),
        ]);

        await page.locator('.sri-overlay input[type="file"]').first().setInputFiles({
            name: '토양_기본서식.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: readFileSync(await download.path()),
        });
        await page.waitForFunction(
            () => !!document.querySelector('.sri-overlay [data-el="headerRow"]:not([disabled])'),
            { timeout: 15000 }
        );

        // 제목·안내문이 위에 있으므로 헤더는 3행 — 사람이 안 바꿔도
        await expect(
            page.locator('.sri-overlay [data-el="headerRow"]'),
            '헤더 행을 자동으로 못 찾아 제목을 헤더로 썼다'
        ).toHaveValue('3');

        const state = await page.evaluate(() => ({
            mapping: window.SoilResultImporter._state.fieldMapping,
            headers: window.SoilResultImporter._parseInput().headers,
        }));
        // 개수만 세면 엉뚱하게 붙어도 통과한다 — 어느 헤더에 붙었는지 본다
        expect(state.headers[state.mapping.lotAddress]).toBe('필지 주소');
        expect(state.headers[state.mapping.area]).toBe('면적(㎡)');
    });

    // 🚨 안내문에 "지우고 입력"이라 적혀 있어도 잊는 사람이 있다.
    //    막지 않으면 '홍길동 / 경기도 시흥시 포동 389'가 정상 접수로 저장된다.
    test('예시 행을 지우지 않고 올려도 저장 대상이 되지 않는다', async ({ page }) => {
        await openImportModal(page);
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            page.click('[data-act="dlTemplate"]'),
        ]);
        await page.locator('.sri-overlay input[type="file"]').first().setInputFiles({
            name: '토양_기본서식.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: readFileSync(await download.path()),
        });

        // 두 번째 시트(농가의뢰)에 사람 이름이 든 예시 행이 있다
        await page.locator('.sri-overlay [data-el="sheetSelect"]').selectOption({ index: 1 });
        await expect
            .poll(() => page.locator('.sri-pv-table tbody tr').count(), { timeout: 10000 })
            .toBeGreaterThan(0);

        const body = await page.locator('.sri-pv-table tbody').innerText();
        expect(body, '예시 행이 오류로 표시되지 않았다').toMatch(/오류|예시/);

        await expect(
            page.locator('.sri-overlay [data-act="import"]'),
            '예시 행만 있는데 가져오기가 활성화됐다'
        ).toBeDisabled();
    });
});
