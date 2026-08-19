// @ts-check
// SLS-1-257: 결과 가져오기 미리보기를 가로 표로
//
// 🚨 예전엔 **셀 하나가 한 줄**이었다. 분석항목이 10개라 시료 하나가 10줄을 먹었고,
//    상한 50이 **시료 5건이면 꽉 찼다** — 6건째부터는 접혀서 확인할 수 없었다.
//    지금은 시료 하나가 한 줄이고 항목이 가로 열이며, 상한은 **100시료**다.
//
// ⚠️ 엑셀 업로드·필드 매핑 전 과정을 태우지 않는다. 바뀐 것은 **렌더**이므로
//    _state를 직접 세우고 _renderPreview()를 부른다. 그래야 무엇을 검증하는지 분명하다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const FIELDS = ['pH', 'organicMatter', 'availableP', 'exK', 'exCa'];

/**
 * 미리보기 상태를 만들어 렌더시킨다.
 * @param {object} o
 *   samples: [[시료번호, {field: 값}], ...]
 *   conflicts / warns / skips: ['시료번호|field', ...]
 *   fields: 매핑할 필드 (기본 FIELDS)
 *   unmatched: 미매칭 키 배열
 */
const render = (page, o) => page.evaluate((opt) => {
    const imp = window.heuktoramManager.resultImporter;
    const has = (arr, s, f) => (arr || []).includes(`${s}|${f}`);
    const matched = [];
    for (const [sn, vals] of opt.samples) {
        for (const [field, v] of Object.entries(vals)) {
            const conflict = has(opt.conflicts, sn, field);
            matched.push({
                rowKey: `row-${sn}`, sampleNumber: sn, field,
                oldValue: conflict ? '9.9' : '',
                newValue: String(v),
                hasConflict: conflict,
                willApply: !has(opt.skips, sn, field),
                rangeWarning: has(opt.warns, sn, field) ? '권장 범위를 벗어납니다' : null,
            });
        }
    }
    imp._state.fieldMapping = {};
    (opt.fields || ['pH','organicMatter','availableP','exK','exCa']).forEach((f, i) => {
        imp._state.fieldMapping[f] = i + 1;
    });
    imp._state.preview = {
        matched,
        unmatched: (opt.unmatched || []).map((k, i) => ({ excelRowIdx: i, key: k, rawRow: [] })),
        warnings: [],
        stats: { totalRows: opt.samples.length, unmatchedRows: (opt.unmatched || []).length,
                 conflicts: (opt.conflicts || []).length, rangeWarnings: (opt.warns || []).length },
    };
    imp._renderPreview();
}, o);

const grid = (page) => page.evaluate(() => {
    const t = document.querySelector('#importerPreviewList .importer-pv-table');
    if (!t) return null;
    return {
        head: [...t.querySelectorAll('thead th')].map(e => e.textContent.trim()),
        rows: [...t.querySelectorAll('tbody tr')].map(tr => ({
            key: tr.querySelector('th').textContent.trim(),
            cells: [...tr.querySelectorAll('td')].map(td => ({
                v: td.textContent.trim(), cls: td.className, title: td.getAttribute('title') || '',
            })),
        })),
    };
});

async function open(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/heuktoram/');
    expect(res && res.status(), 'docs/heuktoram/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => window.heuktoramManager?.resultImporter, { timeout: 15000 });
}

const S3 = [['1', { pH: '5.3', organicMatter: '29', availableP: '234', exK: '0.45', exCa: '4.20' }],
            ['2', { pH: '6.1', organicMatter: '31', availableP: '198', exK: '0.52', exCa: '5.10' }],
            ['3', { pH: '4.8', organicMatter: '18', availableP: '512', exK: '0.28', exCa: '2.90' }]];

test.describe('결과 미리보기 가로 표 (SLS-1-257)', () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 이 티켓의 핵심 — 행 수는 시료 수다 (셀 수가 아니다)
    // ══════════════════════════════════════════════════════════════
    test('행 수가 시료 수와 같다', async ({ page }) => {
        await open(page);
        await render(page, { samples: S3 });
        const g = await grid(page);
        expect(g, '표가 그려지지 않았다').toBeTruthy();
        expect(g.rows.length, `시료 3건인데 ${g.rows.length}줄 — 셀마다 줄을 만들고 있다`).toBe(3);
        expect(g.rows.map(r => r.key)).toEqual(['1', '2', '3']);
    });

    test('한 시료의 값들이 같은 행에 있다', async ({ page }) => {
        await open(page);
        await render(page, { samples: S3 });
        const g = await grid(page);
        expect(g.rows[0].cells.map(c => c.v), '1번 시료의 값이 한 줄에 모이지 않았다')
            .toEqual(['5.3', '29', '234', '0.45', '4.20']);
    });

    test('열은 매핑한 항목만, 순서는 resultFields 기준', async ({ page }) => {
        await open(page);
        await render(page, { samples: [['1', { pH: '5.3', exK: '0.45' }]], fields: ['exK', 'pH'] });
        const g = await grid(page);
        // 매핑 순서가 exK,pH여도 화면은 앱의 항목 순서(pH 먼저)를 따른다
        expect(g.head, '매핑 안 한 항목이 열로 나왔거나 순서가 틀렸다').toEqual(['시료번호', 'pH', '치환성칼륨(K)']);
    });

    test('값이 없는 항목은 빈 칸으로 남고 행이 밀리지 않는다', async ({ page }) => {
        await open(page);
        await render(page, { samples: [['1', { pH: '5.3', exCa: '4.20' }]] });
        const g = await grid(page);
        expect(g.rows[0].cells.length, '열 수가 맞지 않는다').toBe(5);
        expect(g.rows[0].cells.map(c => c.v), '빈 칸이 채워지지 않아 값이 밀렸다')
            .toEqual(['5.3', '', '', '', '4.20']);
        expect(g.rows[0].cells[1].cls).toContain('is-empty');
    });

    // ── 표시가 하나도 사라지지 않았는가 ──
    test('충돌 칸에 표시가 남고 기존값을 알려준다', async ({ page }) => {
        await open(page);
        await render(page, { samples: S3, conflicts: ['2|pH'] });
        const g = await grid(page);
        const cell = g.rows.find(r => r.key === '2').cells[0];
        expect(cell.cls, '충돌 표시가 없다').toContain('is-conflict');
        expect(cell.title, '기존값을 알려주지 않는다').toContain('9.9');
    });

    test('건너뛴 칸은 취소선으로도 구분된다', async ({ page }) => {
        await open(page);
        await render(page, { samples: S3, skips: ['3|exK'] });
        const g = await grid(page);
        const cell = g.rows.find(r => r.key === '3').cells[3];
        expect(cell.cls, '건너뜀 표시가 없다').toContain('is-skip');
        const deco = await page.evaluate(() => {
            const tr = [...document.querySelectorAll('.importer-pv-table tbody tr')]
                .find(r => r.querySelector('th').textContent.trim() === '3');
            return getComputedStyle(tr.querySelectorAll('td')[3]).textDecorationLine;
        });
        // 🚨 색만으로 구분하면 색약·흑백에서 안 보인다
        expect(deco, '색 말고 다른 구분이 없다').toContain('line-through');
    });

    test('범위 초과 칸에 표시와 사유가 남는다', async ({ page }) => {
        await open(page);
        await render(page, { samples: S3, warns: ['3|availableP'] });
        const g = await grid(page);
        const cell = g.rows.find(r => r.key === '3').cells[2];
        expect(cell.cls).toContain('is-warn');
        expect(cell.title).toContain('범위');
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 상한 100 — 단위가 '셀'이 아니라 '시료'다
    // ══════════════════════════════════════════════════════════════
    test('시료 100건까지 보이고 넘치면 시료 기준으로 알린다', async ({ page }) => {
        await open(page);
        const many = Array.from({ length: 120 }, (_, i) =>
            [String(i + 1), { pH: '5.0', organicMatter: '20', availableP: '100', exK: '0.4', exCa: '4.0' }]);
        await render(page, { samples: many });
        const g = await grid(page);
        expect(g.rows.length, '상한이 시료 단위가 아니다').toBe(100);
        const txt = await page.locator('#importerPreviewList').textContent();
        expect(txt, '넘쳤는데 안내가 없다').toContain('120');
        expect(txt, '셀 기준으로 읽히는 문구다').toContain('시료');
    });

    test('100건 이하면 넘침 안내가 없다', async ({ page }) => {
        await open(page);
        await render(page, { samples: S3 });
        expect(await page.locator('#importerPreviewList .importer-preview-overflow').count()).toBe(0);
    });

    // 미매칭은 시료번호를 못 찾은 것이라 표에 자리가 없다
    test('미매칭은 표 밖에 따로 나열된다', async ({ page }) => {
        await open(page);
        await render(page, { samples: S3, unmatched: ['999', '없는번호'] });
        const n = await page.locator('#importerPreviewList .importer-preview-item.is-unmatched').count();
        expect(n, '미매칭이 표시되지 않았다').toBe(2);
        const g = await grid(page);
        expect(g.rows.map(r => r.key), '미매칭이 표 안으로 들어갔다').not.toContain('999');
    });

    // 확인이 필요한 시료를 먼저 보여준다
    test('충돌·범위초과가 있는 시료가 위로 온다', async ({ page }) => {
        await open(page);
        await render(page, { samples: S3, conflicts: ['3|pH'] });
        const g = await grid(page);
        expect(g.rows[0].key, '확인이 필요한 시료가 아래에 묻혔다').toBe('3');
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 코드리뷰가 잡은 것 — 겹친 셀의 옛 점수가 정렬에 남으면
    //    화면엔 멀쩡한 시료가 "확인 필요"로 맨 위에 온다 (표시와 정렬 불일치)
    // ══════════════════════════════════════════════════════════════
    test('겹쳐서 사라진 충돌은 정렬에 영향을 주지 않는다', async ({ page }) => {
        await open(page);
        await page.evaluate(() => {
            const imp = window.heuktoramManager.resultImporter;
            imp._state.fieldMapping = { pH: 1 };
            const mk = (sn, v, conflict) => ({
                rowKey: `r${sn}`, sampleNumber: sn, field: 'pH', oldValue: conflict ? '9.9' : '',
                newValue: v, hasConflict: conflict, willApply: true, rangeWarning: null,
            });
            imp._state.preview = {
                matched: [
                    mk('1', '7.7', false),   // 깨끗한 시료
                    // 🚨 겹치는 쪽을 **2번**으로 둔다. 1번에 두면 버그가 있어도 어차피
                    //    시료번호 순으로 맨 위라 순서가 같아 구분이 안 된다 (실제로 그랬다).
                    mk('2', '5.0', true),    // 겹쳐서 아래 값에 덮인다 — 충돌은 사라진다
                    mk('2', '6.6', false),
                ],
                unmatched: [], warnings: [],
                stats: { totalRows: 3, unmatchedRows: 0, conflicts: 1, rangeWarnings: 0 },
            };
            imp._renderPreview();
        });
        const g = await grid(page);
        const row2 = g.rows.find(r => r.key === '2');
        expect(row2.cells[0].v, '마지막 값이 아니다').toBe('6.6');
        expect(row2.cells[0].cls, '표시는 충돌이 아닌데').not.toContain('is-conflict');
        expect(g.rows.map(r => r.key), '사라진 충돌 점수가 정렬에 남아 2번이 위로 올라왔다')
            .toEqual(['1', '2']);   // 둘 다 점수 0 → 시료번호 순
    });

    test('건너뛸 항목이 있는 시료도 위로 온다', async ({ page }) => {
        await open(page);
        await render(page, { samples: S3, skips: ['3|pH'] });
        const g = await grid(page);
        expect(g.rows[0].key, '건너뜀이 정렬에 반영되지 않는다').toBe('3');
    });

    // 열에 없는 항목만 가진 시료가 빈 줄로 남으면 "값이 없는 시료"처럼 보인다
    test('보이는 칸이 하나도 없는 시료는 표에 넣지 않는다', async ({ page }) => {
        await open(page);
        await page.evaluate(() => {
            const imp = window.heuktoramManager.resultImporter;
            imp._state.fieldMapping = { pH: 1 };
            imp._state.preview = {
                matched: [
                    { rowKey:'r1', sampleNumber:'1', field:'pH', oldValue:'', newValue:'5.3',
                      hasConflict:false, willApply:true, rangeWarning:null },
                    { rowKey:'r2', sampleNumber:'2', field:'cec', oldValue:'', newValue:'13',
                      hasConflict:false, willApply:true, rangeWarning:null },   // 열에 없다
                ],
                unmatched: [], warnings: [],
                stats: { totalRows: 2, unmatchedRows: 0, conflicts: 0, rangeWarnings: 0 },
            };
            imp._renderPreview();
        });
        const g = await grid(page);
        expect(g.rows.map(r => r.key), '보일 칸이 없는 시료가 빈 줄로 남았다').toEqual(['1']);
    });

    // 표에 100건만 보이면 100건만 저장된다고 오해한다
    test('넘침 안내가 저장은 전체임을 밝힌다', async ({ page }) => {
        await open(page);
        const many = Array.from({ length: 120 }, (_, i) => [String(i + 1), { pH: '5.0' }]);
        await render(page, { samples: many, fields: ['pH'] });
        const txt = await page.locator('#importerPreviewList .importer-preview-overflow').textContent();
        expect(txt, '저장 범위를 안 알려준다 — 100건만 저장된다고 오해한다').toContain('저장은 전체');
    });

    // 🚨 같은 시료번호가 엑셀에 두 번 나오면, 저장 루프는 **마지막 값**을 쓴다.
    //    화면이 다른 값을 보여주면 사용자가 저장 결과를 오해한다.
    test('같은 시료번호가 겹치면 마지막 값을 보여준다 (저장과 일치)', async ({ page }) => {
        await open(page);
        await page.evaluate(() => {
            const imp = window.heuktoramManager.resultImporter;
            imp._state.fieldMapping = { pH: 1 };
            imp._state.preview = {
                matched: [
                    { rowKey: 'r1', sampleNumber: '1', field: 'pH', oldValue: '', newValue: '5.0',
                      hasConflict: false, willApply: true, rangeWarning: null },
                    { rowKey: 'r1', sampleNumber: '1', field: 'pH', oldValue: '', newValue: '6.6',
                      hasConflict: false, willApply: true, rangeWarning: null },
                ],
                unmatched: [], warnings: [],
                stats: { totalRows: 2, unmatchedRows: 0, conflicts: 0, rangeWarnings: 0 },
            };
            imp._renderPreview();
        });
        const g = await grid(page);
        expect(g.rows.length, '같은 시료가 두 줄로 나왔다').toBe(1);
        expect(g.rows[0].cells[0].v, '저장되는 값(마지막)과 화면이 다르다').toBe('6.6');
    });
});
