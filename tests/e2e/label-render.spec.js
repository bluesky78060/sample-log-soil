// 라벨 인쇄 렌더 검증 (SLS-1-194)
//
// ⚠️ 1차 리뷰 반려 사유 — 이 파일의 이전 버전은 라벨을 전혀 렌더하지 않았다.
//    label-app.js의 checkForPassedData()는 showLabelDataPreview()(가져오기 미리보기 **표**)만
//    호출하고, 실제 라벨 HTML을 만드는 generateLabels()는 사용자가 「라벨 생성」을 눌러야 돈다.
//    클릭 없이 본문 텍스트만 확인하면 #labelDataTable의 <td>에 매치되어 통과하므로,
//    주소·우편번호 누락이나 필드 매핑 오류를 하나도 잡지 못한다.
//    → 반드시 #btnGenerateLabels를 누르고 #labelModalSheet .label-item 안을 단언한다.
//
// 전제: `npm run build` 후 docs/ 산출물 필요.
const { test, expect } = require('@playwright/test');

/**
 * labelPrintData를 주입하고 라벨 생성까지 수행한 뒤, 렌더된 라벨 셀들을 돌려준다.
 */
async function renderLabels(page, labelData) {
    // label-app.js가 로드 직후 alert를 띄운다. Playwright 기본 동작도 dismiss지만
    // 의도를 명시하고 다른 dialog(confirm 등)까지 함께 처리하기 위해 등록한다.
    page.on('dialog', (d) => d.dismiss().catch(() => {}));

    await page.addInitScript((data) => {
        localStorage.setItem('labelPrintData', JSON.stringify(data));
    }, labelData);

    const res = await page.goto('/label-print/');
    expect(res && res.status(), 'docs/label-print/ 없음 — `npm run build && npm test` 순서로 실행할 것')
        .toBeLessThan(400);

    // 데이터가 실제로 소비됐는지 먼저 고정한다 (early return으로 인한 공허한 통과 방지).
    // 주의: #labelPreview는 이 경로에서 hidden으로 남는다(실측). 소비 신호는 데이터 표다.
    await page.waitForFunction(
        () => document.querySelectorAll('#labelDataTable tr').length > 1,
        { timeout: 10000 }
    );

    await page.locator('#btnGenerateLabels').click();
    // 라벨 셀이 실제로 생성될 때까지 대기 — 0개면 여기서 실패한다
    await page.waitForFunction(
        () => document.querySelectorAll('#labelModalSheet .label-item').length > 0,
        { timeout: 10000 }
    );

    return await page.evaluate(() => {
        const items = [...document.querySelectorAll('#labelModalSheet .label-item')];
        return {
            count: items.length,
            texts: items.map((el) => el.innerText),
            remaining: localStorage.getItem('labelPrintData')
        };
    });
}

test.describe('라벨 인쇄 렌더 (SLS-1-194)', () => {
    test('퇴비 스키마(분리 필드 조립 결과)가 라벨 셀에 렌더된다', async ({ page }) => {
        // BaseSampleManager.getLabelAddressParts 기본 구현이 addressRoad + addressDetail을
        // 조립해 넘긴 결과 형태
        const out = await renderLabels(page, [
            { name: '홍길동', address: '경상북도 봉화군 봉화읍 행복로 12 101호', postalCode: '36231' }
        ]);
        expect(out.count).toBeGreaterThan(0);
        const first = out.texts[0];
        expect(first).toContain('홍길동');
        expect(first).toContain('행복로 12');
        expect(first).toContain('101호');
        expect(first).toContain('36231');
    });

    test('토양 스키마(address 재파싱 결과)가 라벨 셀에 렌더된다', async ({ page }) => {
        // soil-script의 getLabelAddressParts 오버라이드가 넘기는 형태(지번 주소 단일 문자열)
        const out = await renderLabels(page, [
            { name: '김철수', address: '경상북도 봉화군 물야면 오전리 123-4', postalCode: '36200' }
        ]);
        const first = out.texts[0];
        expect(first).toContain('김철수');
        expect(first).toContain('오전리 123-4');
        expect(first).toContain('36200');
    });

    test('여러 건이 각각 별도 라벨 셀로 렌더된다', async ({ page }) => {
        const out = await renderLabels(page, [
            { name: '홍길동', address: '경상북도 봉화군 봉화읍 행복로 12', postalCode: '36231' },
            { name: '김철수', address: '경상북도 봉화군 물야면 오전리 123-4', postalCode: '36200' }
        ]);
        const joined = out.texts.join('\n');
        expect(joined).toContain('홍길동');
        expect(joined).toContain('김철수');
        // 두 사람이 한 셀에 뭉치지 않았는지 — 셀 단위 분리 확인
        const withHong = out.texts.filter((t) => t.includes('홍길동'));
        const withKim = out.texts.filter((t) => t.includes('김철수'));
        expect(withHong).toHaveLength(1);
        expect(withKim).toHaveLength(1);
        expect(withHong[0]).not.toContain('김철수');
    });

    test('데이터 소비 후 labelPrintData 키가 비워진다', async ({ page }) => {
        const out = await renderLabels(page, [
            { name: '홍길동', address: '경상북도 봉화군 봉화읍 행복로 12', postalCode: '36231' }
        ]);
        // 남아 있으면 다음 진입 때 같은 데이터가 다시 로드된다
        expect(out.remaining).toBeNull();
    });

    test('우편번호가 비어 있어도 성명·주소는 렌더된다', async ({ page }) => {
        const out = await renderLabels(page, [
            { name: '홍길동', address: '경상북도 봉화군 봉화읍 행복로 12', postalCode: '' }
        ]);
        const first = out.texts[0];
        expect(first).toContain('홍길동');
        expect(first).toContain('행복로 12');
    });
});
