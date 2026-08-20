// @ts-check
// SLS-1-265: 목록·내보내기·흙토람이 **같은 접수번호**를 내는가
//
// 접수번호는 성적서와 흙토람 업로드로 나가는 **대외 식별자**다. 화면마다 다르면
// 어느 것이 맞는지 알 수 없고, 흙토람에 올린 번호와 성적서 번호가 어긋난다.
//
// 하위 지번 번호는 원래 세 곳에서 각각 계산됐다. 이 티켓에서 계산을
// `SoilLogRecord.subLotDisplayNumber` 하나로 모았는데, **정말 한 곳만 남았는지**는
// 세 출력을 나란히 놓고 비교해야 알 수 있다 (codex 플랜 리뷰 지적).
//
// ⚠️ "문자열이 같다"로는 부족하다. **같은 지번에 같은 번호가 붙었는지**까지 본다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

/**
 * 작물 2개 + 하위 지번 2개를 등록했을 때 저장되는 모습.
 * `buildSoilLogRecord`가 만드는 형태 그대로다 — 주작물 레코드에만 하위 지번이 붙고,
 * 두 레코드 모두 `cropSplitCount: 2`를 갖는다.
 */
const SPLIT_WITH_SUBLOTS = [
    {
        id: 'a', receptionNumber: '503', name: '홍길동', landClass1: '농가의뢰',
        subCategory: '논', purpose: '일반', date: '2026-08-20',
        cropIndex: 1, cropSplitCount: 2, cropsDisplay: '벼', area: '500',
        lotAddress: '내성리 100',
        parcels: [{
            id: 'p', lotAddress: '내성리 100', isMountain: false,
            crops: [{ name: '벼', area: '500' }],
            subLots: [
                { lotAddress: '내성리 101', crops: [{ name: '보리', area: '100' }] },
                { lotAddress: '내성리 102', crops: [{ name: '밀', area: '200' }] },
            ],
            category: '논', purpose: '일반', note: '',
        }],
    },
    {
        id: 'b', receptionNumber: '503-1', name: '홍길동', landClass1: '농가의뢰',
        subCategory: '논', purpose: '일반', date: '2026-08-20',
        cropIndex: 2, cropSplitCount: 2, cropsDisplay: '콩', area: '700',
        lotAddress: '내성리 100',
        parcels: [{
            id: 'q', lotAddress: '내성리 100', isMountain: false,
            crops: [{ name: '콩', area: '700' }],
            subLots: [],
            category: '논', purpose: '일반', note: '',
        }],
    },
];

/** 이 티켓 이전에 만들어진 모습 — cropSplitCount가 없다 */
const LEGACY_NO_SPLIT = [{
    id: 'c', receptionNumber: '600', name: '김철수', landClass1: '농가의뢰',
    subCategory: '논', purpose: '일반', date: '2026-08-20',
    cropsDisplay: '벼', area: '500', lotAddress: '내성리 200',
    parcels: [{
        id: 'r', lotAddress: '내성리 200', isMountain: false,
        crops: [{ name: '벼', area: '500' }],
        subLots: [
            { lotAddress: '내성리 201', crops: [{ name: '보리', area: '100' }] },
            { lotAddress: '내성리 202', crops: [{ name: '밀', area: '200' }] },
        ],
        category: '논', purpose: '일반', note: '',
    }],
}];

async function seed(page, path, manager, logs) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto(path);
    expect(res && res.status(), `docs${path} 없음 — \`npm run build\` 먼저`).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction((m) => typeof window[m] !== 'undefined', manager);
    await page.evaluate(({ m, data }) => {
        localStorage.setItem(`soilSampleLogs_${window[m].selectedYear}`, JSON.stringify(data));
    }, { m: manager, data: logs });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction((m) => typeof window[m] !== 'undefined', manager);
}

/** 목록 화면의 (번호, 필지주소) 목록 — 화면에 보이는 순서 그대로 */
const listRows = async (page) => {
    await page.evaluate(() => window.soilManager.switchView('list'));
    await page.waitForFunction(() => !!document.querySelector('#listView tbody tr'));
    return page.evaluate(() => {
        const heads = [...document.querySelectorAll('#listView thead th')].map((t) => t.textContent.trim());
        const numIdx = heads.indexOf('접수번호');
        const lotIdx = heads.findIndex((h) => h.includes('필지'));
        return [...document.querySelectorAll('#listView tbody tr')].map((tr) => ({
            number: tr.children[numIdx]?.textContent.trim(),
            lot: tr.children[lotIdx]?.textContent.trim(),
        })).filter((r) => r.number);
    });
};

/** 흙토람 화면의 (번호, 필지주소) 목록 */
const heuktoramRows = (page) => page.evaluate(() => {
    const m = window.heuktoramManager;
    if (!m || !m.flatRows) throw new Error('흙토람 화면이 준비되지 않았다');
    return m.flatRows.map((r) => ({
        number: r.displayNumber,
        lot: (r.subLot ? r.subLot.lotAddress : r.parcel.lotAddress) || '',
    }));
});

test.describe('하위 지번 번호가 화면마다 같은가 (SLS-1-265)', () => {
    test('작물 2개 + 하위 지번 2개: 목록이 503, 503-1, 503-2, 503-3', async ({ page }) => {
        await seed(page, '/soil/', 'soilManager', SPLIT_WITH_SUBLOTS);
        const rows = await listRows(page);

        expect(rows.map((r) => r.number),
            '번호가 겹치거나 순서가 뒤집혔다').toEqual(['503', '503-1', '503-2', '503-3']);

        // 번호만 맞고 엉뚱한 지번에 붙으면 소용없다
        const byNumber = Object.fromEntries(rows.map((r) => [r.number, r.lot]));
        expect(byNumber['503-2']).toContain('101');
        expect(byNumber['503-3']).toContain('102');
    });

    test('옛 레코드(cropSplitCount 없음)는 600, 600-1, 600-2 그대로', async ({ page }) => {
        // 이 티켓 이전 대장이 전부 여기에 해당한다. 번호가 바뀌면 안 된다.
        await seed(page, '/soil/', 'soilManager', LEGACY_NO_SPLIT);
        const rows = await listRows(page);
        expect(rows.map((r) => r.number)).toEqual(['600', '600-1', '600-2']);
    });

    test('흙토람 화면이 목록과 같은 번호를 낸다', async ({ page }) => {
        await seed(page, '/soil/', 'soilManager', SPLIT_WITH_SUBLOTS);
        const list = await listRows(page);

        await seed(page, '/heuktoram/', 'heuktoramManager', SPLIT_WITH_SUBLOTS);
        await page.waitForFunction(() => (window.heuktoramManager?.flatRows || []).length > 0);
        const heuk = await heuktoramRows(page);

        // 흙토람은 작물마다 행을 만들어 목록보다 행이 많을 수 있다.
        // **번호 집합**과 **번호→지번 대응**이 같은지를 본다.
        const listMap = Object.fromEntries(list.map((r) => [r.number, r.lot]));
        const heukMap = {};
        for (const r of heuk) heukMap[r.number] = r.lot;

        expect(Object.keys(heukMap).sort(), '흙토람과 목록의 접수번호 집합이 다르다')
            .toEqual(Object.keys(listMap).sort());

        for (const num of Object.keys(listMap)) {
            const lot = listMap[num].replace(/\s*\(산\)\s*$/, '');
            if (lot && lot !== '-') {
                expect(heukMap[num], `${num}: 목록은 "${lot}", 흙토람은 "${heukMap[num]}"`)
                    .toContain(lot.split(' ').pop());
            }
        }
    });

    test('흙토람에도 중복 번호가 없다', async ({ page }) => {
        await seed(page, '/heuktoram/', 'heuktoramManager', SPLIT_WITH_SUBLOTS);
        await page.waitForFunction(() => (window.heuktoramManager?.flatRows || []).length > 0);
        const nums = (await heuktoramRows(page)).map((r) => r.number);
        const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
        expect(dup, `같은 번호가 여러 번 나온다: ${dup.join(', ')}`).toEqual([]);
    });
    // ⚠️ 위 시험들은 **이미 저장된 모습**을 넣고 읽는다. 그래서 폼에서 레코드를
    //    만드는 배선(`cropSplitCount`를 넘기는 곳)이 빠져도 통과한다 — 실제로
    //    변이 시험에서 그 인자를 지웠더니 전부 통과했다.
    //    여기서는 **레코드를 만드는 실제 경로**를 태운다.
    test('등록 경로가 cropSplitCount를 실제로 남긴다', async ({ page }) => {
        await seed(page, '/soil/', 'soilManager', []);

        const built = await page.evaluate(() => {
            const parcel = {
                lotAddress: '내성리 100', isMountain: false,
                crops: [{ name: '벼', area: '500' }, { name: '콩', area: '700' }],
                subLots: [
                    { lotAddress: '내성리 101', crops: [{ name: '보리', area: '100' }] },
                    { lotAddress: '내성리 102', crops: [{ name: '밀', area: '200' }] },
                ],
                category: '논', purpose: '일반', note: '',
            };
            const logs = window.soilManager._buildLogsForParcels([parcel], {
                baseNumber: 503, isFillNumber: false,
                commonData: { name: '홍길동', date: '2026-08-20', subCategory: '논' },
                groupId: 'g1',
            });
            const R = window.SoilLogRecord;
            const numbers = [];
            for (const log of logs) {
                numbers.push(log.receptionNumber);
                (log.parcels[0].subLots || []).forEach((_, i) =>
                    numbers.push(R.subLotDisplayNumber(log, i)));
            }
            return {
                numbers,
                splitCounts: logs.map((l) => l.cropSplitCount),
                keptSubLots: logs.flatMap((l) => (l.parcels[0].subLots || []).map((s) => s.lotAddress)),
            };
        });

        expect(built.splitCounts, '등록 경로가 cropSplitCount를 안 넘겼다 — '
            + '하위 지번이 형제 레코드 번호와 겹친다').toEqual([2, 2]);
        expect(built.keptSubLots, '등록 경로에서 하위 지번이 사라졌다')
            .toEqual(['내성리 101', '내성리 102']);
        expect([...built.numbers].sort(), '등록 경로가 만든 번호가 겹치거나 빠졌다')
            .toEqual(['503', '503-1', '503-2', '503-3']);
    });
    // codex 코드 리뷰가 CRITICAL로 지적한 것: offset을 필지 루프 **안**에서 조건 없이
    // 더하면 레코드에 필지가 여럿일 때 필지마다 반복 적용돼 번호가 계속 밀린다.
    // 지금 저장 경로는 레코드당 필지 1개만 만들지만, 예전·외부 유입 레코드는 다를 수 있다.
    test('레코드에 필지가 여럿이어도 번호 보정이 한 번만 적용된다', async ({ page }) => {
        const twoParcels = [{
            id: 'm', receptionNumber: '700', name: '박영희', landClass1: '농가의뢰',
            subCategory: '논', purpose: '일반', date: '2026-08-20',
            cropSplitCount: 2, cropsDisplay: '벼', area: '500', lotAddress: '내성리 300',
            parcels: [
                {
                    id: 'm1', lotAddress: '내성리 300', isMountain: false,
                    crops: [{ name: '벼', area: '500' }],
                    subLots: [{ lotAddress: '내성리 301', crops: [{ name: '보리', area: '100' }] }],
                    category: '논', purpose: '일반', note: '',
                },
                {
                    id: 'm2', lotAddress: '내성리 400', isMountain: false,
                    crops: [{ name: '콩', area: '600' }],
                    subLots: [{ lotAddress: '내성리 401', crops: [{ name: '밀', area: '200' }] }],
                    category: '논', purpose: '일반', note: '',
                },
            ],
        }];
        await seed(page, '/heuktoram/', 'heuktoramManager', twoParcels);
        await page.waitForFunction(() => (window.heuktoramManager?.flatRows || []).length > 0);
        const nums = (await heuktoramRows(page)).map((r) => r.number);

        const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
        expect(dup, `번호가 겹쳤다: ${nums.join(', ')}`).toEqual([]);

        // `700-1`이 비는 것은 **맞다** — cropSplitCount가 2라 형제 레코드가 그 번호를 쓴다.
        // 보정이 필지마다 반복되면 뒤 필지가 한 칸 더 밀려 `700-5`가 나온다.
        expect(nums, '보정이 필지마다 반복돼 번호가 밀렸다')
            .toEqual(['700', '700-2', '700-3', '700-4']);
    });

    test('접수대장 내보내기도 같은 번호를 쓴다', async ({ page }) => {
        await seed(page, '/soil/', 'soilManager', SPLIT_WITH_SUBLOTS);
        const list = await listRows(page);

        // 내보내기는 파일을 만들지만, 번호를 만드는 함수는 목록과 같아야 한다.
        const exported = await page.evaluate(() => {
            const R = window.SoilLogRecord;
            const logs = window.soilManager.sampleLogs;
            const out = [];
            for (const log of logs) {
                out.push(log.receptionNumber);
                (log.parcels[0].subLots || []).forEach((_, i) => out.push(R.subLotDisplayNumber(log, i)));
            }
            return out;
        });
        expect([...exported].sort(), '내보내기 번호가 목록과 다르다')
            .toEqual([...list.map((r) => r.number)].sort());
    });
});
