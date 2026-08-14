// @ts-check
// SLS-1-243: 문의게시판을 탭으로 나누고 공지를 접는다
//
// 🚨 고치려는 증상: 공지가 본문까지 전부 펼쳐져 있어, 공지가 늘어날수록
//    이 화면에 온 주된 이유인 **문의 작성**이 아래로 밀렸다.
//
// ⚠️ 이 스펙은 웹(로컬 폴백)에서 돈다. Playwright는 docs/를 서빙하고 웹에는
//    게시판 Firebase 설정이 없어 localStorage 어댑터가 쓰인다.
//    키: 공지 soilFeedbackNotices / 본 것 seenNoticeIds
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const NOTICE_KEY = 'soilFeedbackNotices';
const SEEN_KEY = 'seenNoticeIds';

const NOTICES = [
    { id: 'n1', title: '엑셀 기본서식과 작물 검색 사용 안내', body: '접수 화면에서 [엑셀 가져오기]를 누르시면…', createdAt: '2026-08-14T09:00:00.000Z' },
    { id: 'n2', title: '흙토람 개인정보 항목 변경 안내', body: '2026년 7월 14일부터 열 구성이 바뀌었습니다.', createdAt: '2026-07-15T09:00:00.000Z' },
    { id: 'n3', title: '2026년 시료 접수 일정 안내', body: '상반기 접수는 6월 30일까지입니다.', createdAt: '2026-06-02T09:00:00.000Z' },
];

/**
 * goto 전에 저장소를 심는다 — 페이지 스크립트가 읽기 전에 있어야 한다.
 *
 * ⚠️ addInitScript는 **새로고침에도 다시 실행**된다. 본 공지 기록까지 매번 덮으면
 *    "새로고침해도 남는가"를 검증할 수 없다(처음에 그렇게 썼다가 통과할 수 없었다).
 *    seen은 **비어 있을 때만** 심는다.
 */
async function openBoard(page, { seen = [] } = {}) {
    await page.addInitScript(
        ({ nk, sk, notices, seenIds }) => {
            localStorage.setItem(nk, JSON.stringify(notices));
            if (localStorage.getItem(sk) === null) {
                localStorage.setItem(sk, JSON.stringify(seenIds));
            }
        },
        { nk: NOTICE_KEY, sk: SEEN_KEY, notices: NOTICES, seenIds: seen }
    );
    const res = await page.goto('/feedback/');
    expect(res && res.status(), 'docs/feedback/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.querySelectorAll('.notice-item').length > 0, { timeout: 15000 });
}

const noticeTab = (page) => page.locator('#tabNotice');
const inquiryTab = (page) => page.locator('#tabInquiry');
const firstNotice = (page) => page.locator('.notice-item').first();

test.describe('문의게시판 탭 구조 (SLS-1-243)', () => {
    // ══════════════════════════════════════════════════════════════
    // 🚨 이 티켓의 증상 — 공지 본문이 처음부터 보이면 안 된다
    // ══════════════════════════════════════════════════════════════
    test('공지 본문이 처음에는 접혀 있다', async ({ page }) => {
        await openBoard(page);
        await noticeTab(page).click();

        const bodies = page.locator('.notice-item .notice-body');
        await expect(bodies).toHaveCount(3);
        for (let i = 0; i < 3; i++) {
            await expect(bodies.nth(i), `${i + 1}번째 공지 본문이 펼쳐져 있다`).toBeHidden();
        }
        // 제목은 보인다 — 접혔다고 목록까지 사라지면 안 된다
        await expect(page.locator('.notice-item .notice-title').first()).toBeVisible();
    });

    test('제목을 누르면 펼쳐지고, 다시 누르면 접힌다', async ({ page }) => {
        await openBoard(page);
        await noticeTab(page).click();

        const item = firstNotice(page);
        const head = item.locator('.notice-head');
        const body = item.locator('.notice-body');

        await expect(head).toHaveAttribute('aria-expanded', 'false');
        await head.click();
        await expect(body, '펼쳐지지 않았다').toBeVisible();
        await expect(head).toHaveAttribute('aria-expanded', 'true');

        await head.click();
        await expect(body, '다시 접히지 않았다').toBeHidden();
        await expect(head).toHaveAttribute('aria-expanded', 'false');
    });

    // 🚨 알릴 것이 있을 때만 공지가 앞에 나선다
    test('안 본 공지가 있으면 공지 탭이 먼저 열린다', async ({ page }) => {
        await openBoard(page, { seen: [] });
        await expect(noticeTab(page)).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#panelNotice')).toBeVisible();
        await expect(page.locator('#noticeBadge'), '안 본 건수가 안 보인다').toHaveText('3');
    });

    test('전부 읽었으면 문의 탭이 먼저 열린다', async ({ page }) => {
        await openBoard(page, { seen: ['n1', 'n2', 'n3'] });
        await expect(inquiryTab(page), '공지를 다 봤는데 공지 탭이 열렸다')
            .toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#panelInquiry')).toBeVisible();
        await expect(page.locator('#noticeBadge')).toBeHidden();
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 기록이 남는가 — 새로고침해도 다시 "안 읽음"이 되면 안 된다
    // ══════════════════════════════════════════════════════════════
    test('펼쳐 본 공지는 새로고침해도 읽은 것으로 남는다', async ({ page }) => {
        await openBoard(page, { seen: [] });
        await noticeTab(page).click();

        const item = firstNotice(page);
        await expect(item.locator('.notice-new'), 'N 표시가 없다').toBeVisible();
        await item.locator('.notice-head').click();
        await expect(item.locator('.notice-new'), '펼쳤는데 N이 남아 있다').toHaveCount(0);
        await expect(page.locator('#noticeBadge'), '배지가 안 줄었다').toHaveText('2');

        // localStorage에 실제로 기록됐는가 (화면 상태만 바꾸면 새로고침에 사라진다)
        const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), SEEN_KEY);
        expect(stored, '본 공지가 저장되지 않았다').toContain('n1');

        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => document.querySelectorAll('.notice-item').length > 0);
        await noticeTab(page).click();
        await expect(
            page.locator('.notice-item[data-id="n1"] .notice-new'),
            '새로고침하니 다시 안 읽음이 됐다'
        ).toHaveCount(0);
    });

    // 🚨 팝업이 기록한 것을 게시판이 알아봐야 한다 (같은 저장소 공유)
    test('팝업으로 이미 본 공지는 N 표시가 없다', async ({ page }) => {
        await openBoard(page, { seen: ['n2'] });
        await noticeTab(page).click();
        await expect(
            page.locator('.notice-item[data-id="n2"] .notice-new'),
            '팝업 기록을 게시판이 못 읽는다'
        ).toHaveCount(0);
        await expect(page.locator('.notice-item[data-id="n1"] .notice-new')).toBeVisible();
        await expect(page.locator('#noticeBadge')).toHaveText('2');
    });

    // 🚨 이 화면에 오는 주된 이유 — 공지 길이와 무관하게 폼에 닿아야 한다
    test('문의 탭에 작성 폼과 내 문의 목록이 함께 있다', async ({ page }) => {
        await openBoard(page, { seen: ['n1', 'n2', 'n3'] });
        await expect(page.locator('#inquiryForm')).toBeVisible();
        await expect(page.locator('#inquiryTitle')).toBeVisible();
        await expect(page.locator('#inquiryList')).toBeVisible();
        // 공지 패널은 감춰져 있어야 한다
        await expect(page.locator('#panelNotice')).toBeHidden();
    });

    test('탭을 오가면 패널이 바뀐다', async ({ page }) => {
        await openBoard(page, { seen: ['n1', 'n2', 'n3'] });
        await noticeTab(page).click();
        await expect(page.locator('#panelNotice')).toBeVisible();
        await expect(page.locator('#panelInquiry')).toBeHidden();
        await expect(noticeTab(page)).toHaveAttribute('aria-selected', 'true');
        await expect(inquiryTab(page)).toHaveAttribute('aria-selected', 'false');

        await inquiryTab(page).click();
        await expect(page.locator('#panelInquiry')).toBeVisible();
        await expect(page.locator('#panelNotice')).toBeHidden();
    });

    // 헤더가 <button>이라 키보드로 열려야 한다 — <div onclick>이면 여기서 죽는다
    test('키보드로 탭과 공지를 열 수 있다', async ({ page }) => {
        await openBoard(page, { seen: [] });
        await noticeTab(page).focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#panelNotice')).toBeVisible();

        const head = firstNotice(page).locator('.notice-head');
        await head.focus();
        await page.keyboard.press('Enter');
        await expect(firstNotice(page).locator('.notice-body'), '키보드로 안 열린다').toBeVisible();
    });

    // 🚨 공지는 관리자가 쓰지만 렌더 경로는 XSS 통로다. 특히 data-id는
    //    속성 자리에 들어가므로 따옴표가 섞이면 마크업이 깨진다.
    //
    // ⚠️ 이 테스트가 지키는 것은 **최종 렌더 결과의 안전성**이지 escapeHTML 호출 자체가
    //    아니다. 실측해 보니 escapeHTML을 빼도 통과한다 — setInnerHTML의 DOMPurify가
    //    막기 때문이다. 이중 방어가 실제로 동작한다는 뜻이므로 그대로 두되,
    //    "이 테스트가 escapeHTML을 지킨다"고 오해하지 않도록 적어 둔다.
    test('공지에 스크립트·따옴표가 섞여도 실행되지 않고 마크업이 깨지지 않는다', async ({ page }) => {
        const evil = [{
            id: 'x" onload="alert(1)',
            title: '<img src=x onerror="window.__pwned=1">제목',
            body: '<script>window.__pwned2=1<\/script>본문',
            createdAt: '2026-08-14T09:00:00.000Z',
        }];
        await page.addInitScript(({ nk, sk, notices }) => {
            localStorage.setItem(nk, JSON.stringify(notices));
            localStorage.setItem(sk, '[]');
        }, { nk: NOTICE_KEY, sk: SEEN_KEY, notices: evil });

        const errs = [];
        page.on('pageerror', (e) => errs.push(e.message));
        await page.goto('/feedback/');
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => document.querySelectorAll('.notice-item').length > 0);
        await noticeTab(page).click();

        expect(await page.evaluate(() => window.__pwned), '이미지 onerror가 실행됐다').toBeUndefined();
        expect(await page.evaluate(() => window.__pwned2), '스크립트가 실행됐다').toBeUndefined();
        expect(errs, `페이지 오류: ${errs.join(' / ')}`).toEqual([]);

        // 마크업이 깨지지 않아 정상 동작한다 — 따옴표 든 id로도 펼쳐진다
        const item = firstNotice(page);
        await expect(item.locator('.notice-body')).toBeHidden();
        await item.locator('.notice-head').click();
        await expect(item.locator('.notice-body'), 'data-id 따옴표로 마크업이 깨졌다').toBeVisible();
        // 태그가 텍스트로 보여야 한다 (실행도 제거도 아닌 이스케이프)
        await expect(item.locator('.notice-title')).toContainText('제목');
    });

    test('공지가 없으면 안내가 나오고 문의 탭이 열린다', async ({ page }) => {
        await page.addInitScript(({ nk, sk }) => {
            localStorage.setItem(nk, JSON.stringify([]));
            localStorage.setItem(sk, JSON.stringify([]));
        }, { nk: NOTICE_KEY, sk: SEEN_KEY });
        await page.goto('/feedback/');
        await page.waitForLoadState('networkidle');
        await expect(inquiryTab(page)).toHaveAttribute('aria-selected', 'true');
        await noticeTab(page).click();
        await expect(page.locator('#noticeList')).toContainText('등록된 공지가 없습니다');
    });
});
