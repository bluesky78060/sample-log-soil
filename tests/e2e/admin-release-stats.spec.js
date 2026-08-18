// @ts-check
// SLS-1-250: 관리자 화면 릴리스 배포 현황
//
// 🚨 이 카드에서 가장 중요한 산출물은 숫자가 아니라 **경고 상자**다.
//    과거에 setup.exe 다운로드 수를 "수동 설치"로 읽고 "자동 업데이트가 동작하지 않는다"고
//    잘못 결론 낸 적이 있다(CLAUDE.md 정정 기록). 숫자만 크게 띄우면 또 그렇게 된다.
//    그래서 "경고 상자가 있는가"를 테스트로 못박는다.
//
// 🚨 그리고 **실패를 0으로 렌더하지 않는가**. "0회"로 보이면 배포가 안 나간 것으로 오해한다.
//
// ⚠️ 실제 GitHub을 부르지 않는다 — page.route로 가로채 고정 응답을 준다.
//    안 그러면 네트워크·한도에 따라 결과가 흔들리고, 60회/시간 한도를 테스트가 소모한다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const API = '**/api.github.com/repos/**';

const rel = (tag, pub, setup, extra = {}) => ({
    tag_name: tag, published_at: pub, prerelease: false, draft: false,
    assets: [
        { name: 'latest.yml', download_count: 99 },
        { name: 'RELEASES', download_count: 99 },
        { name: `soil-sample-log-${tag}-full.nupkg`, download_count: 99 },
        { name: 'soil-sample-log-setup.exe', download_count: setup },
    ],
    ...extra,
});

const FIXTURE = [
    rel('v1.14.4', '2026-07-30T00:00:00Z', 20),
    rel('v1.14.3', '2026-07-29T00:00:00Z', 11),
    rel('v1.10.14', '2026-07-22T00:00:00Z', 9),
    rel('v1.0.0', '2026-05-08T00:00:00Z', 1),
];

/**
 * 관리자 화면을 열고 통계 카드를 드러낸다.
 * 로그인은 Firebase가 필요해 E2E로 못 한다 — 섹션을 직접 노출하고
 * 노출된 함수(window.__adminStats.loadReleaseStats)를 호출한다.
 */
async function openStats(page, route) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route(API, route);
    const res = await page.goto('/feedback-admin/');
    expect(res && res.status(), 'docs/feedback-admin/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.__adminStats, { timeout: 15000 });
    await page.evaluate(() => {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('adminSection').style.display = 'block';
        // ⚠️ SLS-1-252에서 패널이 탭 뒤로 들어갔다. 드러내지 않으면 hidden이라
        //    toBeVisible() 단언이 전부 실패한다.
        //    🚨 activateAdminTab('stats')를 쓰지 않는다 — 그건 첫 열람 조회를 **함께** 태워서
        //       아래 조회 호출과 겹친다. 조회 횟수를 세는 테스트가 흔들린다.
        //       이 스펙의 대상은 탭이 아니라 통계 렌더이므로 패널만 연다.
        document.getElementById('panelStatsAdmin').hidden = false;
    });
    await page.evaluate(() => window.__adminStats.loadReleaseStats({ force: true }));
}

/**
 * 🚨 실제 GitHub이 보내는 CORS 노출 헤더를 그대로 흉내낸다.
 *
 *    브라우저는 `Access-Control-Expose-Headers`에 없는 응답 헤더를 **읽지 못한다.**
 *    이걸 빼고 모의하면 `Link`(페이지네이션)와 `X-RateLimit-*`(한도 판정)이
 *    전부 null이 되어, 구현이 멀쩡한데 테스트만 실패한다 — 처음에 실제로 그랬다.
 *
 *    거꾸로 이 상수는 **의존성 기록**이기도 하다. GitHub이 이 헤더 노출을 끊으면
 *    뒷페이지 합산과 한도 안내가 조용히 죽는다.
 *    (2026-08-18 실측: 실제 응답에 Link·X-RateLimit-Remaining·X-RateLimit-Reset·Retry-After 포함)
 */
const CORS = {
    'access-control-allow-origin': '*',
    'access-control-expose-headers':
        'ETag, Link, Location, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
};

const ok = (body, headers = {}) => (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    headers: { ...CORS, ...headers },
    body: JSON.stringify(body),
});

const figures = (page) => page.evaluate(() =>
    [...document.querySelectorAll('#releaseStats .fig')].map((f) => ({
        k: f.querySelector('.k')?.textContent?.trim(),
        v: f.querySelector('.v')?.textContent?.trim(),
    })));

test.describe('릴리스 배포 현황 (SLS-1-250)', () => {
    test('요약 수치가 계산값대로 표시된다', async ({ page }) => {
        await openStats(page, ok(FIXTURE));
        const f = await figures(page);
        expect(f.length, '요약 칸이 4개가 아니다').toBe(4);
        // 20+11+9+1 = 41 (latest.yml·RELEASES·nupkg가 섞이면 훨씬 커진다)
        expect(f[0].v, 'setup.exe 외 자산이 섞였다').toBe('41회');
        expect(f[1].v, '최신 버전이 틀렸다').toBe('v1.14.4');
        expect(f[2].v).toBe('4개');
        expect(f[3].v, '최다 배포 버전이 틀렸다').toBe('v1.14.4');
    });

    test('버전별 막대가 내림차순으로 그려진다', async ({ page }) => {
        await openStats(page, ok(FIXTURE));
        const rows = await page.evaluate(() =>
            [...document.querySelectorAll('#releaseStats .stat-bar')]
                .map((b) => ({ lab: b.querySelector('.lab').textContent, num: Number(b.querySelector('.num').textContent) })));
        const vers = rows.filter((r) => r.lab.startsWith('v'));
        expect(vers.map((v) => v.num), '내림차순이 아니다').toEqual([20, 11, 9, 1]);
        expect(vers[0].lab).toBe('v1.14.4');
    });

    test('월별 막대는 릴리스 공개 월로 묶인다', async ({ page }) => {
        await openStats(page, ok(FIXTURE));
        const months = await page.evaluate(() =>
            [...document.querySelectorAll('#releaseStats .stat-bar')]
                .map((b) => ({ lab: b.querySelector('.lab').textContent, num: Number(b.querySelector('.num').textContent) }))
                .filter((r) => /^\d{4}-\d{2}$/.test(r.lab)));
        expect(months).toEqual([
            { lab: '2026-05', num: 1 },
            { lab: '2026-07', num: 40 },
        ]);
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 이 스펙에서 가장 중요한 테스트
    // ══════════════════════════════════════════════════════════════
    test('숫자와 함께 경고 상자가 반드시 보인다', async ({ page }) => {
        await openStats(page, ok(FIXTURE));
        const note = page.locator('#releaseStatsNote');
        await expect(note, '경고 상자가 없다 — 숫자만 보면 또 오해한다').toBeVisible();

        const txt = await note.textContent();
        expect(txt, '자동/수동 구분 불가를 안 알린다').toMatch(/자동 업데이트/);
        expect(txt, '기관 수가 아님을 안 알린다').toMatch(/기관 수가 아닙니다/);
        expect(txt, '월별 기준을 안 알린다').toMatch(/릴리스가 공개된 달/);
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 실패를 0으로 렌더하면 "배포가 안 나갔다"로 오해한다
    // ══════════════════════════════════════════════════════════════
    test('한도 초과는 전용 문구로 알리고 0을 표시하지 않는다', async ({ page }) => {
        await openStats(page, (r) => r.fulfill({
            status: 403,
            headers: { ...CORS, 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1787012917' },
            contentType: 'application/json', body: '{}',
        }));
        const box = page.locator('#releaseStats');
        await expect(box.locator('.stats-fail')).toBeVisible();
        await expect(box).toContainText('한도');
        expect(await box.locator('.fig').count(), '실패인데 수치를 그렸다 — 0회로 보인다').toBe(0);
    });

    test('네트워크 실패도 0을 표시하지 않는다', async ({ page }) => {
        await openStats(page, (r) => r.abort('failed'));
        const box = page.locator('#releaseStats');
        await expect(box.locator('.stats-fail')).toBeVisible();
        expect(await box.locator('.fig').count(), '실패인데 수치를 그렸다').toBe(0);
    });

    test('403이어도 한도가 남았으면 한도라 하지 않는다', async ({ page }) => {
        await openStats(page, (r) => r.fulfill({
            status: 403, headers: { ...CORS, 'x-ratelimit-remaining': '55' },
            contentType: 'application/json', body: '{}',
        }));
        const box = page.locator('#releaseStats');
        await expect(box).toContainText('403');
        await expect(box, '다른 사유의 403을 한도로 오진했다').not.toContainText('한도');
    });

    test('릴리스가 없으면 그렇게 말한다', async ({ page }) => {
        await openStats(page, ok([]));
        await expect(page.locator('#releaseStats')).toContainText('릴리스가 없습니다');
    });

    // 🚨 태그명은 GitHub에서 오는 외부 문자열이다
    test('태그명이 실제 요소로 파싱되지 않는다', async ({ page }) => {
        await openStats(page, ok([rel('<img src=x onerror=alert(1)>', '2026-07-30T00:00:00Z', 5)]));
        expect(await page.locator('#releaseStats img').count(), '태그명이 마크업으로 파싱됐다').toBe(0);
        await expect(page.locator('#releaseStats')).toContainText('<img src=x');
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 적대적 검증이 잡은 것들 — 전부 "조용히 잘못 보이는" 경우다
    // ══════════════════════════════════════════════════════════════

    test('상한에 걸려 잘렸으면 그 사실을 알린다', async ({ page }) => {
        // 매 응답이 next를 주면 상한(5페이지)에 걸린다
        await openStats(page, (r) => r.fulfill({
            status: 200, contentType: 'application/json',
            headers: { ...CORS, link: '<https://api.github.com/repos/x/y/releases?page=9>; rel="next"' },
            body: JSON.stringify([rel('v1.0.0', '2026-05-01T00:00:00Z', 1)]),
        }));
        await expect(page.locator('#releaseStats .stats-partial'),
            '조용히 잘랐다 — 사용자는 합계가 전부인 줄 안다').toBeVisible();
    });

    test('다 받았으면 잘림 안내를 띄우지 않는다', async ({ page }) => {
        await openStats(page, ok(FIXTURE));
        expect(await page.locator('#releaseStats .stats-partial').count(),
            '멀쩡한데 잘렸다고 했다').toBe(0);
    });

    // 🚨 새로고침을 눌렀는데 캐시가 나오면 고장으로 보인다
    test('새로고침은 캐시를 건너뛰고 다시 받는다', async ({ page }) => {
        let hits = 0;
        let setup = 20;
        await openStats(page, (r) => {
            hits += 1;
            return r.fulfill({
                status: 200, contentType: 'application/json', headers: { ...CORS },
                body: JSON.stringify([rel('v1.14.4', '2026-07-30T00:00:00Z', setup)]),
            });
        });
        expect(hits).toBe(1);

        // 캐시 창(60초) 안에서 force 없이 부르면 다시 받지 않는다
        await page.evaluate(() => window.__adminStats.loadReleaseStats());
        expect(hits, '캐시가 동작하지 않았다').toBe(1);

        setup = 33;
        await page.evaluate(() => window.__adminStats.loadReleaseStats({ force: true }));
        expect(hits, '새로고침인데 캐시를 줬다').toBe(2);
        const f = await figures(page);
        expect(f[0].v, '새 값이 화면에 반영되지 않았다').toBe('33회');
    });

    // 🚨 로그아웃했는데 이전 요청 결과가 뒤늦게 그려지면, 어느 시점 값인지 알 수 없다
    test('로그아웃 뒤 도착한 이전 요청 결과는 버린다', async ({ page }) => {
        await openStats(page, ok(FIXTURE));
        const before = (await figures(page))[0].v;
        expect(before).toBe('41회');

        // 캐시를 무효화하고(=로그아웃) 곧바로 화면을 비운 뒤, 낡은 세대의 렌더가 오는지 본다
        const after = await page.evaluate(async () => {
            const S = window.__adminStats;
            const box = document.getElementById('releaseStats');
            const p = S.loadReleaseStats({ force: true });   // 세대 N
            S.clearReleaseStatsCache();                      // 로그아웃 → 세대 N+1
            box.innerHTML = '<div class="hint">로그아웃됨</div>';
            await p;
            return box.textContent.trim();
        });
        expect(after, '낡은 요청 결과가 현재 화면에 그려졌다').toContain('로그아웃됨');
    });

    // Link 헤더를 따라가지 않으면 100개 넘는 순간 숫자가 조용히 줄어든다
    test('여러 페이지를 모두 합산한다', async ({ page }) => {
        let hit = 0;
        await openStats(page, (r) => {
            hit += 1;
            const isFirst = !r.request().url().includes('page=2');
            return r.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: isFirst
                    ? { ...CORS, link: '<https://api.github.com/repos/x/y/releases?page=2>; rel="next"' }
                    : { ...CORS },
                body: JSON.stringify(isFirst
                    ? [rel('v2.0.0', '2026-08-01T00:00:00Z', 10)]
                    : [rel('v1.0.0', '2026-05-01T00:00:00Z', 7)]),
            });
        });
        expect(hit, '두 번째 페이지를 안 받았다').toBe(2);
        const f = await figures(page);
        expect(f[0].v, '뒷페이지가 합산되지 않았다').toBe('17회');
        expect(f[2].v).toBe('2개');
    });
});
