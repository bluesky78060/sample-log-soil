// 흙토람 내보내기 — 실제 산출물 검증 (SLS-1-214)
//
// 🚨 세 번의 코드리뷰가 연속으로 남긴 간극을 닫는다.
//
// 유닛 테스트(heuktoram-soil-form.test.js)는 소스에서 뽑은 스타일 객체를
// XLSX.write에 통과시켜 **직렬화**를 확인한다. 하지만 내보내기 코드가 그 객체를
// **실제 셀에 붙이는지**는 문자열 검색에 기댔다.
//
// 여기서는 실제 페이지의 window.heuktoramManager로 exportToHeuktoram()을 부르고
// downloadBuffer가 만드는 <a download> 클릭을 잡아 **진짜 .xlsx 바이트**를 본다.
// injectDataValidations(JSZip 후처리)까지 지나온 최종 파일이라 검증 범위가 더 넓다.
//
// ⚠️ 이 spec은 docs/ 빌드 산출물을 대상으로 돈다 — `npm run build` 먼저.
// ⚠️ 스타일은 셀의 s= 인덱스를 cellXfs → fonts/borders로 **해석**해서 본다.
//    styles.xml에 <b/>가 있는지만 보면 다른 셀의 굵게에도 통과한다.
//
// 여전히 증명하지 않는 것: Electron 패키지 환경의 저장 경로, 실제 MS Excel의
// 수용 여부, 흙토람 서버의 업로드 수락. 기존 간극이지 이번에 생긴 것은 아니다.
const { test, expect } = require('@playwright/test');
const { readFile } = require('node:fs/promises');
const JSZip = require('jszip');

// golden spec과 같은 구조 — 3행이라 300건 확인창이 뜨지 않는다
const FIXTURE = {
    selectedYear: '2026',
    collectYear: '2026',
    collector: '홍길동',
    testResults: {},
    rows: [
    {
        key: 'k1', isSubLot: false, baseReceptionNumber: '501',
        parcel: { lotAddress: '경상북도 봉화군 봉화읍 문단리 699-2', category: '밭', purpose: '일반재배', note: '', isMountain: false },
        log: {
        name: '홍길동', date: '2026-05-01', landClass1: '농가의뢰', receptionNumber: '501',
        addressRoad: '', address: '경상북도 봉화군 봉화읍 문단리 699', addressDetail: '',
        subCategory: '밭', purpose: '일반재배', phoneNumber: '0541112222',
        },
        crop: { name: '고추', area: '300', unit: 'pyeong' },
    },
    ],
};

/** 실제 내보내기를 실행하고 받은 파일을 연다 */
async function exportAndOpen(page) {
    const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.evaluate((fx) => {
        const mgr = window.heuktoramManager;
        if (!mgr) throw new Error('heuktoramManager 없음');
        mgr.selectedYear = fx.selectedYear;
        mgr.testResults = fx.testResults;
        mgr.flatRows = fx.rows;        // exportToHeuktoram 진입부가 읽는다
        mgr.selectedKeys = new Set();   // 비면 전체
        // DOM 입력 stub — 실제 페이지에 요소가 없을 수 있다
        mgr.collectYearInput = { value: fx.collectYear };
        mgr.collectorInput = { value: fx.collector };
        mgr.bulkUsageCodeSelect = { value: '' };
        mgr.bulkBeforeAfterSelect = { value: 'N' };
        return mgr.exportToHeuktoram();
    }, FIXTURE),
    ]);
    const path = await download.path();
    expect(path, '다운로드 파일 경로를 받지 못했다').toBeTruthy();
    return JSZip.loadAsync(await readFile(path));
}

/** s= 인덱스를 실제 폰트/테두리/서식으로 해석한다 */
function makeStyleResolver(stylesXml) {
    const pick = (tag) => {
    const block = stylesXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    if (!block) return [];
    const inner = tag === 'cellXfs' ? /<xf [^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g
        : tag === 'fonts' ? /<font>[\s\S]*?<\/font>|<font\/>/g
        : /<border[^>]*>[\s\S]*?<\/border>|<border[^>]*\/>/g;
    return [...block[1].matchAll(inner)].map(m => m[0]);
    };
    const xfs = pick('cellXfs'), fonts = pick('fonts'), borders = pick('borders');
    return (sIndex) => {
    const xf = xfs[sIndex];
    expect(xf, `cellXfs[${sIndex}]가 없다`).toBeTruthy();
    const id = (attr) => Number((xf.match(new RegExp(`${attr}="(\\d+)"`)) || [])[1] ?? -1);
    return {
        xf,
        numFmtId: id('numFmtId'),
        font: fonts[id('fontId')] || '',
        border: borders[id('borderId')] || '',
    };
    };
}

/** 셀 주소의 s= 인덱스 */
const styleIndexOf = (sheetXml, ref) =>
    Number((sheetXml.match(new RegExp(`<c r="${ref}"[^>]*s="(\\d+)"`)) || [])[1] ?? -1);

// beforeAll에서 한 번 내보내 7건이 공유한다. fullyParallel이면 워커마다
// beforeAll이 따로 돌아 다운로드가 중복되므로 의도를 명시한다(CI는 workers:1이라 무관).
test.describe.configure({ mode: 'serial' });

test.describe('흙토람 내보내기 실제 산출물 (SLS-1-214)', () => {
    let sheetXml, stylesXml, workbookXml, resolve;

    test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const res = await page.goto('/heuktoram/');
    expect(res && res.status(), 'docs/heuktoram/ 없음 — `npm run build` 먼저')
        .toBeLessThan(400);
    await page.waitForFunction(() => !!window.heuktoramManager, { timeout: 10000 });

    const zip = await exportAndOpen(page);
    sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    stylesXml = await zip.file('xl/styles.xml').async('string');
    workbookXml = await zip.file('xl/workbook.xml').async('string');
    resolve = makeStyleResolver(stylesXml);
    await page.close();
    });

    test('1. 시트명이 흙토람 서식과 같다', () => {
        expect(workbookXml).toContain('검정정보일괄입력');
    });

    // 🚨 이 티켓의 핵심 — 안내문 스타일이 **그 셀에** 붙어 있는가
    test('2. A2 안내문이 굵은 빨강 + 아래 테두리다', () => {
        const s = resolve(styleIndexOf(sheetXml, 'A2'));
        expect(s.font, `A2 font: ${s.font}`).toContain('<b/>');
        expect(s.font).toContain('FFFF0000');
        expect(s.border, `A2 border: ${s.border}`).toContain('<bottom style="thin"');
    });

    test('3. A1 제목은 굵고 20pt이며 테두리가 없다', () => {
        const s = resolve(styleIndexOf(sheetXml, 'A1'));
        expect(s.font).toContain('<b/>');
        expect(s.font).toContain('val="20"');
        // A2와 달리 테두리가 없다 — 실물도 그렇다
        expect(s.border).not.toContain('<bottom style="thin"');
    });

    // 🚨 없으면 사용자가 고친 날짜가 숫자로 바뀐다
    test('4. 데이터 셀이 텍스트 서식이다', () => {
        const s = resolve(styleIndexOf(sheetXml, 'A5'));
        expect(s.numFmtId, `A5 xf: ${s.xf}`).toBe(49);
    });

    test('5. 행 높이가 실물과 같다', () => {
        expect(sheetXml).toMatch(/<row r="1"[^>]*ht="31\.5"/);
        expect(sheetXml).toMatch(/<row r="2"[^>]*ht="309\.75"/);
        expect(sheetXml).toMatch(/<row r="3"[^>]*ht="17\.45"/);
    });

    test('6. 범례·스페이서 열이 숨김이다', () => {
        // 1-based 35~41 = 인덱스 34~40
        // xlsx-js-style은 hidden="true"로 낸다(실물은 "1"). Excel은 둘 다 받는다.
        const HIDDEN = 'hidden="(?:1|true)"';
        for (let c = 35; c <= 41; c++) {
            expect(sheetXml, `${c}번째 열이 숨김이 아니다`)
                .toMatch(new RegExp(`<col min="${c}"[^>]*${HIDDEN}`));
        }
        // 데이터 열은 숨으면 안 된다
        expect(sheetXml, '1번째 열(필지구분)이 숨었다')
            .not.toMatch(new RegExp(`<col min="1" [^>]*${HIDDEN}`));
    });

    // 🚨 v1.14.0에서 여기가 어긋나 시료번호·암모니아태질소 입력이 막혔다
    test('7. 데이터 검증이 F·G·U에 걸린다', () => {
        const dv = [...sheetXml.matchAll(/<dataValidation [^>]*sqref="([A-Z]+)\d+/g)]
        .map(m => m[1]).sort();
        expect(dv, `실제 sqref: ${dv.join(',')}`).toEqual(['F', 'G', 'U']);
        expect(dv, 'H는 시료번호다').not.toContain('H');
        expect(dv, 'AH는 암모니아태질소다').not.toContain('AH');
    });
});
