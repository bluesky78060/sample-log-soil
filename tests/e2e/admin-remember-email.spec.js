// @ts-check
// SLS-1-254: 관리자 로그인 이메일 기억하기
//
// 🚨 **순수 함수만 테스트하지 않는다** (계획 리뷰 지적).
//    저장 함수가 맞아도 onLogin이 안 부르면 기능은 죽어 있다.
//    그래서 `signInAdmin`을 가짜로 세우고 **실제 폼 submit**을 돌린다 —
//    onLogin → 저장까지 진짜 경로가 실행된다.
//
// 🚨 그리고 **비밀번호가 어디에도 남지 않는가**. 이메일 키만 보면 다른 키에
//    저장하는 버그를 놓치므로 localStorage 전 키를 훑는다.
//
// ⚠️ docs/ 빌드 산출물 대상 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');

const EMAIL = 'admin@korea.kr';
const PW = 'SuperSecret!234';
const KEY = 'feedbackAdminEmail';

/** signInAdmin을 가짜로 세운다. mode: 'ok' | 'fail' | 'throw' */
const stubAuth = (page, mode) => page.evaluate((m) => {
    window.feedbackFirebase = window.feedbackFirebase || {};
    window.feedbackFirebase.signInAdmin = async () => {
        if (m === 'throw') throw new Error('네트워크 오류');
        return m === 'ok' ? { ok: true } : { ok: false, error: '비밀번호가 틀렸습니다.' };
    };
    window.feedbackFirebase.getDb = () => ({
        collection: () => ({ get: async () => ({ forEach: () => {} }), orderBy() { return this; } }),
    });
}, mode);

async function openLogin(page) {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const res = await page.goto('/feedback-admin/');
    expect(res && res.status(), 'docs/feedback-admin/ 없음 — `npm run build` 먼저').toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.__adminAuth, { timeout: 15000 });
}

/** 실제 폼에 입력하고 submit 한다 */
async function submitLogin(page, { email = EMAIL, pw = PW } = {}) {
    await page.locator('#adminEmail').fill(email);
    await page.locator('#adminPassword').fill(pw);
    await page.locator('#loginBtn').click();
    await page.waitForTimeout(400);
}

const saved = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);

test.describe('관리자 이메일 기억 (SLS-1-254)', () => {
    test('로그인에 성공하면 이메일이 저장된다', async ({ page }) => {
        await openLogin(page);
        await stubAuth(page, 'ok');
        await submitLogin(page);
        expect(await saved(page), '성공했는데 저장되지 않았다 — 배선이 없다').toBe(EMAIL);
    });

    // 🚨 복원 함수를 부르지 않는다. **실제 reload** 후 폼을 본다.
    test('다시 열면 폼에 채워져 있다', async ({ page }) => {
        await openLogin(page);
        await stubAuth(page, 'ok');
        await submitLogin(page);

        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => !!window.__adminAuth);
        await expect(page.locator('#adminEmail'), '다시 열었는데 비어 있다').toHaveValue(EMAIL);
        await expect(page.locator('#rememberEmail')).toBeChecked();
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 sentinel을 미리 넣는다 (계획 리뷰 지적).
    //    빈 저장소에서 "여전히 비었다"만 보면 stub 문제로 잘못 통과할 수 있다.
    // ══════════════════════════════════════════════════════════════
    test('로그인에 실패하면 저장하지 않고 기존 값도 건드리지 않는다', async ({ page }) => {
        await openLogin(page);
        await page.evaluate((k) => localStorage.setItem(k, 'keep@me.kr'), KEY);
        await stubAuth(page, 'fail');
        await submitLogin(page, { email: 'wrong@x.kr' });
        expect(await saved(page), '실패한 주소로 덮어썼다').toBe('keep@me.kr');
    });

    test('예외가 나도 저장하지 않고 버튼이 살아난다', async ({ page }) => {
        await openLogin(page);
        await page.evaluate((k) => localStorage.setItem(k, 'keep@me.kr'), KEY);
        await stubAuth(page, 'throw');
        await submitLogin(page, { email: 'wrong@x.kr' });
        expect(await saved(page), '예외인데 저장했다').toBe('keep@me.kr');
        await expect(page.locator('#loginBtn'), '버튼이 disabled로 굳었다 — 재시도 불가')
            .toBeEnabled();
    });

    // 🚨 .checked 대입이 아니라 실제 click — change 배선 누락을 잡는다.
    //    ⚠️ 로그인에 성공하면 로그인 화면이 숨겨져 체크박스를 누를 수 없다.
    //       실제 사용 흐름대로 **로그아웃한 뒤** 해제한다.
    test('체크를 풀면 즉시 지워진다', async ({ page }) => {
        await openLogin(page);
        await stubAuth(page, 'ok');
        await submitLogin(page);
        expect(await saved(page)).toBe(EMAIL);

        await page.evaluate(() => { window.feedbackFirebase.signOutAdmin = async () => {}; });
        await page.locator('#logoutBtn').click();
        await expect(page.locator('#loginSection')).toBeVisible();

        await page.locator('#rememberEmail').click();
        await expect(page.locator('#rememberEmail')).not.toBeChecked();
        expect(await saved(page), '체크를 풀었는데 남아 있다 — 다시 로그인해야 잊는 건 이상하다')
            .toBeNull();
    });

    test('체크가 풀린 채로 성공하면 저장하지 않는다', async ({ page }) => {
        await openLogin(page);
        await stubAuth(page, 'ok');
        await page.locator('#rememberEmail').click();
        await submitLogin(page);
        expect(await saved(page), '체크가 꺼졌는데 저장했다').toBeNull();
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 비밀번호는 **어느 키에도** 없어야 한다
    // ══════════════════════════════════════════════════════════════
    test('비밀번호는 저장소 어디에도 남지 않는다', async ({ page }) => {
        await openLogin(page);
        await stubAuth(page, 'ok');
        await submitLogin(page);

        const hit = await page.evaluate((pw) => {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (String(localStorage.getItem(k) ?? '').includes(pw)) return k;
            }
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (String(sessionStorage.getItem(k) ?? '').includes(pw)) return `session:${k}`;
            }
            return null;
        }, PW);
        expect(hit, `비밀번호가 ${hit}에 저장됐다`).toBeNull();
    });

    // 🚨 setItem만 막는다 — 페이지의 다른 코드가 먼저 죽으면 원인을 구분 못 한다.
    //    ⚠️ 로그인 성공만 보면 **저장을 아예 시도하지 않아도** 통과한다(코드리뷰 지적).
    //       저장을 시도했는데 던졌고, 그래도 로그인이 끝났다 — 셋을 함께 본다.
    test('저장소가 막혀도 로그인이 진행된다', async ({ page }) => {
        await openLogin(page);
        await stubAuth(page, 'ok');
        await page.evaluate(() => {
            window.__setItemTries = 0;
            localStorage.setItem = () => { window.__setItemTries += 1; throw new Error('QuotaExceeded'); };
        });
        await submitLogin(page);
        expect(await page.evaluate(() => window.__setItemTries),
            '저장을 시도조차 하지 않았다 — 이 테스트가 지키는 게 없다').toBeGreaterThan(0);
        await expect(page.locator('#adminSection'), '저장 실패가 로그인을 막았다').toBeVisible();
    });

    // ══════════════════════════════════════════════════════════════
    // 🚨 코드리뷰 MAJOR — '기억 안 함' 선택이 새로고침에도 남아야 한다.
    //    안 그러면 해제 → 새로고침 → 체크박스가 다시 켜짐 → 모른 채 로그인 → 또 저장.
    // ══════════════════════════════════════════════════════════════
    test('해제한 상태가 새로고침 뒤에도 유지된다', async ({ page }) => {
        await openLogin(page);
        await page.locator('#rememberEmail').click();
        await expect(page.locator('#rememberEmail')).not.toBeChecked();

        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => !!window.__adminAuth);
        await expect(page.locator('#rememberEmail'),
            '해제했는데 다시 켜졌다 — 선택이 지속되지 않는다').not.toBeChecked();
    });

    test('해제 상태로 새로고침한 뒤 로그인해도 저장하지 않는다', async ({ page }) => {
        await openLogin(page);
        await page.locator('#rememberEmail').click();
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => !!window.__adminAuth);

        await stubAuth(page, 'ok');
        await submitLogin(page);
        expect(await saved(page), '해제 선택이 무시돼 저장됐다').toBeNull();
    });

    test('다시 켜면 그 상태도 유지된다', async ({ page }) => {
        await openLogin(page);
        await page.locator('#rememberEmail').click();     // 끈다
        await page.locator('#rememberEmail').click();     // 다시 켠다
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => !!window.__adminAuth);
        await expect(page.locator('#rememberEmail'), '다시 켠 상태가 유지되지 않는다').toBeChecked();
    });

    // 🚨 다른 탭에서 해제하면 이 탭도 따라가야 한다 — 안 그러면 낡은 상태로 되살린다
    test('다른 탭에서 해제하면 이 탭의 체크도 풀린다', async ({ page }) => {
        await openLogin(page);
        await expect(page.locator('#rememberEmail')).toBeChecked();

        // 다른 탭의 해제를 흉내낸다 (storage 이벤트는 다른 탭에서만 발생한다)
        await page.evaluate((k) => {
            localStorage.setItem(k, '0');
            window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: '0' }));
        }, 'feedbackAdminRemember');

        await expect(page.locator('#rememberEmail'),
            '다른 탭의 해제를 따라가지 않았다 — 낡은 상태로 이메일을 되살린다').not.toBeChecked();
    });

    // 로그아웃해도 남아야 한다 — 그게 이 기능의 목적이다
    test('로그아웃해도 이메일은 남는다', async ({ page }) => {
        await openLogin(page);
        await stubAuth(page, 'ok');
        await submitLogin(page);
        await page.evaluate(() => {
            window.feedbackFirebase.signOutAdmin = async () => {};
        });
        await page.locator('#logoutBtn').click();
        await page.waitForTimeout(300);
        expect(await saved(page), '로그아웃이 이메일까지 지웠다').toBe(EMAIL);
    });
});
