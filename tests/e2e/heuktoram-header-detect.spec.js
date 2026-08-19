// @ts-check
// SLS-1-258: 머리글 행 자동 인식 + 두 줄 합치기
//
// 🚨 앱 기본 서식은 머리글이 **두 줄**이다.
//      3행: … 접수번호 …            화학성분값
//      4행:                 점토함량  pH  유기물 …
//    한 줄만 읽으면 매칭 키와 결과 항목을 **동시에 얻을 수 없다.**
//    예전엔 1행(제목) 고정이라 항목이 데이터처럼 보였다.
//
// ⚠️ 화면 문구만 보지 않는다 (계획 리뷰 지적). 실제로
//      · 합쳐진 **머리글 내용**
//      · **첫 데이터 행**
//    을 확인해야 "4행을 그냥 건너뛴 구현"과 구분된다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');
const { readFileSync, existsSync } = require('fs');

/** 기본 서식과 같은 2단 머리글 (3행 주 / 4행 부 / 5행부터 데이터) */
// ⚠️ 실제 서식과 같은 모양이어야 한다. 처음엔 `화학성분값`과 `pH`를 **같은 열**에 뒀는데,
//    실물은 그룹 이름이 **자기 열에만** 있고(병합의 첫 칸) 항목은 그 옆 열부터다.
//    잘못된 픽스처로는 합친 머리글이 `화학성분값 pH`가 되어 사전에 안 걸린다.
const TWO_ROW = [
    ['농가의뢰 입력 서식', '', '', '', '', ''],
    ['1. 안내문…', '', '', '', '', ''],
    ['필지구분', '접수번호', '접수일자', '화학성분값', '', ''],
    ['', '', '', '점토함량', 'pH', '유기물'],
    ['예) 필지', '1', '2026-05-11', '20', '6.5', '30'],
    ['필지', '153', '2026-05-11', '18', '5.8', '22'],
];

/** 한 줄 머리글 — 합치면 안 된다 */
const ONE_ROW = [
    ['시료번호', 'pH', '유기물', '유효인산'],
    ['153', '5.8', '22', '224'],
    ['154', '5.9', '38', '222'],
];

/** 사전에 아무것도 안 걸리는 시트 — 지금 동작(1행) 유지 */
const NO_MATCH = [
    ['가', '나', '다'],
    ['1', '2', '3'],
];

const setup = (page, sheets, active) => page.evaluate(({ sheets, active }) => {
    const imp = window.heuktoramManager.resultImporter;
    imp._state.mode = 'file';
    imp._state.sheets = {};
    imp._state.sheetNames = [];
    for (const [name, rows] of Object.entries(sheets)) {
        imp._state.sheets[name] = { rows, maxCol: Math.max(...rows.map(r => r.length)) };
        imp._state.sheetNames.push(name);
    }
    imp._state.activeSheet = active;
    imp._state.headerRowIdx = 0;
    imp._state.headerMerge = false;
    imp._state.headerAuto = false;
    imp._state.headerManualSheets = new Set();
    imp._applyHeaderDetection();
    const p = imp._parseInput();
    return {
        idx: imp._state.headerRowIdx, merge: imp._state.headerMerge, auto: imp._state.headerAuto,
        headers: p.headers, firstRow: p.rows[0], rowCount: p.rows.length,
    };
}, { sheets, active });

async function open(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/heuktoram/');
    expect(res && res.status(), 'docs/heuktoram/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => window.heuktoramManager?.resultImporter, { timeout: 15000 });
}

test.describe('머리글 자동 인식 (SLS-1-258)', () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 **실제 파일 선택 경로**를 탄다 (코드리뷰가 잡은 결함).
    //
    //    아래 다른 테스트들은 _applyHeaderDetection()을 직접 부른다. 그래서
    //    "판정 직후 headerRowIdx를 0으로 덮어쓰는" 버그를 통째로 놓쳤다 —
    //    파일을 처음 열 때는 자동 인식이 무효였고 시트를 바꿔야만 동작했다.
    //    진입 경로(파일 input에 파일을 넣는 것)로 한 번은 반드시 확인해야 한다.
    // ══════════════════════════════════════════════════════════════
    test('파일을 선택하면 그 자리에서 자동 인식된다', async ({ page }) => {
        await open(page);

        // 2단 머리글 엑셀을 브라우저 안에서 만들어 파일 input에 넣는다
        await page.evaluate(() => {
            const XLSX = window.XLSX;
            const rows = [
                ['농가의뢰 입력 서식', '', '', '', '', ''],
                ['1. 안내문…', '', '', '', '', ''],
                ['필지구분', '접수번호', '접수일자', '화학성분값', '', ''],
                ['', '', '', '점토함량', 'pH', '유기물'],
                ['필지', '153', '2026-05-11', '18', '5.8', '22'],
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
            const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            window.__xlsxBytes = Array.from(new Uint8Array(out));
        });
        const bytes = await page.evaluate(() => window.__xlsxBytes);

        await page.locator('#importerFileInput').setInputFiles({
            name: '2단머리글.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: Buffer.from(bytes),
        });

        await expect.poll(async () => page.evaluate(
            () => window.heuktoramManager.resultImporter._state.headerRowIdx
        ), { timeout: 10000 }).toBe(2);

        const r = await page.evaluate(() => {
            const imp = window.heuktoramManager.resultImporter;
            const p = imp._parseInput();
            return { merge: imp._state.headerMerge, auto: imp._state.headerAuto,
                     headers: p.headers, first: p.rows[0]?.[1] };
        });
        expect(r.merge, '파일 로드 경로에서 합치기가 안 걸렸다').toBe(true);
        expect(r.auto).toBe(true);
        expect(r.headers[1], '매칭 키가 안 잡혔다').toBe('접수번호');
        expect(r.headers[4], 'pH가 안 잡혔다').toBe('pH');
        expect(r.first, '데이터 시작이 밀렸다').toBe('153');
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 이 티켓의 핵심 — 두 줄을 합쳐 잡는다
    // ══════════════════════════════════════════════════════════════
    test('2단 머리글은 3~4행을 합쳐 잡는다', async ({ page }) => {
        await open(page);
        const r = await setup(page, { s: TWO_ROW }, 's');
        expect(r.idx, '1행(제목)을 그대로 쓰고 있다').toBe(2);
        expect(r.merge, '합치지 않았다').toBe(true);
        expect(r.auto, '자동 판정 표식이 없다').toBe(true);
    });

    // 🚨 머리글 '내용'을 본다 — 건너뛰기만 한 구현과 구분된다
    test('합친 머리글에 키와 항목이 함께 들어온다', async ({ page }) => {
        await open(page);
        const r = await setup(page, { s: TWO_ROW }, 's');
        expect(r.headers, '접수번호와 pH가 한 줄에 안 잡혔다')
            .toEqual(['필지구분', '접수번호', '접수일자', '화학성분값 점토함량', 'pH', '유기물']);
    });

    // 🚨 데이터 시작이 hIdx+2 — +1이면 부 머리글이 데이터로 섞인다
    test('합치면 데이터가 5행부터다', async ({ page }) => {
        await open(page);
        const r = await setup(page, { s: TWO_ROW }, 's');
        expect(r.rowCount, '행 수가 맞지 않는다 — 부 머리글이 섞였다').toBe(2);
        expect(r.firstRow?.[0], '4행(부 머리글)이 데이터로 들어왔다').toBe('예) 필지');
    });

    // 한 줄 서식을 괜히 두 줄로 읽으면 데이터 한 줄을 먹는다
    test('한 줄 머리글은 합치지 않는다', async ({ page }) => {
        await open(page);
        const r = await setup(page, { s: ONE_ROW }, 's');
        expect(r.merge, '한 줄인데 합쳤다 — 데이터를 먹는다').toBe(false);
        expect(r.idx).toBe(0);
        expect(r.rowCount, '데이터 행을 잃었다').toBe(2);
        expect(r.firstRow?.[0]).toBe('153');
    });

    test('사전에 안 걸리면 1행 그대로 (지금 동작 유지)', async ({ page }) => {
        await open(page);
        const r = await setup(page, { s: NO_MATCH }, 's');
        expect(r.idx).toBe(0);
        expect(r.merge).toBe(false);
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 사용자가 손으로 고른 값을 자동이 덮으면 안 된다
    // ══════════════════════════════════════════════════════════════
    test('헤더 행을 직접 바꾸면 자동이 덮지 않는다', async ({ page }) => {
        await open(page);
        await setup(page, { s: TWO_ROW }, 's');
        const r = await page.evaluate(() => {
            const imp = window.heuktoramManager.resultImporter;
            // 사용자가 손으로 2행을 고른 상황
            imp._state.headerManualSheets.add('s');
            imp._state.headerRowIdx = 1;
            imp._state.headerMerge = false;
            imp._state.headerAuto = false;
            imp._applyHeaderDetection();                    // 다시 불려도
            return { idx: imp._state.headerRowIdx, merge: imp._state.headerMerge, auto: imp._state.headerAuto };
        });
        expect(r.idx, '손으로 고른 값을 자동이 덮었다').toBe(1);
        expect(r.merge).toBe(false);
        expect(r.auto, '수동인데 자동으로 표시된다').toBe(false);
    });

    test("'헤더 없음'이면 자동 판정을 걸지 않는다", async ({ page }) => {
        await open(page);
        await setup(page, { s: TWO_ROW }, 's');
        const idx = await page.evaluate(() => {
            const imp = window.heuktoramManager.resultImporter;
            imp._state.headerRowIdx = -1;
            imp._state.headerManualSheets = new Set();
            imp._applyHeaderDetection();
            return imp._state.headerRowIdx;
        });
        expect(idx, "'헤더 없음'을 자동이 뒤집었다").toBe(-1);
    });

    test('시트를 바꾸면 그 시트로 다시 판정한다', async ({ page }) => {
        await open(page);
        const two = await setup(page, { a: TWO_ROW, b: ONE_ROW }, 'a');
        expect(two.merge).toBe(true);
        const one = await page.evaluate(() => {
            const imp = window.heuktoramManager.resultImporter;
            imp._state.activeSheet = 'b';
            imp._state.headerRowIdx = 0; imp._state.headerMerge = false;
            imp._applyHeaderDetection();
            return { idx: imp._state.headerRowIdx, merge: imp._state.headerMerge };
        });
        expect(one.merge, '앞 시트의 판정이 남았다').toBe(false);
        expect(one.idx).toBe(0);
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 판정과 매핑이 갈리면 "자동으로 고른 행인데 매핑이 안 붙는" 일이 생긴다
    // ══════════════════════════════════════════════════════════════
    test('자동 선택된 머리글에서 자동 매핑이 실제로 붙는다', async ({ page }) => {
        await open(page);
        await setup(page, { s: TWO_ROW }, 's');
        const r = await page.evaluate(() => {
            const imp = window.heuktoramManager.resultImporter;
            imp._autoMap();
            const p = imp._parseInput();
            return {
                keyCol: imp._state.matchKeyCol,
                keyName: p.headers[imp._state.matchKeyCol],
                mapped: Object.keys(imp._state.fieldMapping),
                phCol: imp._state.fieldMapping.pH,
            };
        });
        expect(r.keyName, '매칭 키를 못 찾았다').toBe('접수번호');
        expect(r.mapped, 'pH·유기물이 안 붙었다').toEqual(expect.arrayContaining(['pH', 'organicMatter']));
        expect(r.phCol, 'pH가 합친 머리글 기준 열이 아니다').toBe(4);
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 사전 확장 (SLS-1-258) — 현장 표기가 제각각이라 넓혀 뒀다.
    //    ⚠️ 넓힌 만큼 **오탐**이 무섭다. 접수 항목(성명·주소·작물명)이 결과 항목으로
    //       잡히면 엉뚱한 값이 저장된다. 두 방향을 함께 못박는다.
    // ══════════════════════════════════════════════════════════════
    const mapOne = (page, header) => page.evaluate((h) => {
        const imp = window.heuktoramManager.resultImporter;
        imp._state.mode = 'file';
        imp._state.sheets = { s: { rows: [['시료번호', h], ['153', '1']], maxCol: 2 } };
        imp._state.sheetNames = ['s'];
        imp._state.activeSheet = 's';
        imp._state.headerRowIdx = 0; imp._state.headerMerge = false;
        imp._state.headerManualSheets = new Set();
        imp._autoMap();
        const e = Object.entries(imp._state.fieldMapping).find(([, v]) => v === 1);
        return e ? e[0] : null;
    }, header);

    const SHOULD_MATCH = [
        ['산도', 'pH'], ['토양산도', 'pH'],
        ['유기물함량', 'organicMatter'], ['OM(g/kg)', 'organicMatter'],
        ['유효인산(P2O5)', 'availableP'], ['인산', 'availableP'],
        ['규산함량', 'silica'],
        ['교환성칼륨', 'exK'], ['치환성칼륨', 'exK'], ['칼륨', 'exK'], ['교환성 K', 'exK'],
        ['교환성칼슘', 'exCa'], ['칼슘', 'exCa'],
        ['교환성마그네슘', 'exMg'], ['마그네슘', 'exMg'],
        ['전기전도도', 'ec'], ['전기전도도(EC)', 'ec'], ['염농도', 'ec'],
        ['석회소요량', 'limeReq'], ['석회시용량', 'limeReq'],
        ['양이온치환용량', 'cec'], ['양이온교환용량', 'cec'], ['CEC', 'cec'],
    ];
    for (const [header, field] of SHOULD_MATCH) {
        test(`표기 '${header}' → ${field}`, async ({ page }) => {
            await open(page);
            expect(await mapOne(page, header), `'${header}'를 못 알아본다`).toBe(field);
        });
    }

    // 🚨 접수 항목이 결과 항목으로 잡히면 엉뚱한 값이 저장된다
    const SHOULD_NOT_MATCH = ['성명', '전화번호', '필지 주소', '작물명', '면적(㎡)',
                              '접수일자', '비고', '수령 방법', '경지구분', '농가 주소'];
    for (const header of SHOULD_NOT_MATCH) {
        test(`접수 항목 '${header}'는 결과로 잡히지 않는다`, async ({ page }) => {
            await open(page);
            expect(await mapOne(page, header), `'${header}'가 결과 항목으로 잡혔다`).toBeNull();
        });
    }

    // 🚨 앱의 기본 서식은 '교환성'을 쓰는데 사전엔 '치환성'만 있었다
    test("'교환성' 표기도 사전이 알아본다", async ({ page }) => {
        await open(page);
        const sheet = [
            ['시료번호', '교환성칼륨', '교환성칼슘', '교환성마그네슘', '전기전도도', '양이온치환용량'],
            ['153', '0.45', '4.20', '1.05', '0.25', '13'],
        ];
        await setup(page, { s: sheet }, 's');
        const mapped = await page.evaluate(() => {
            const imp = window.heuktoramManager.resultImporter;
            imp._autoMap();
            return Object.keys(imp._state.fieldMapping);
        });
        expect(mapped, "'교환성'·'전기전도도'·'양이온치환용량'을 못 알아본다")
            .toEqual(expect.arrayContaining(['exK', 'exCa', 'exMg', 'ec', 'cec']));
    });
});
