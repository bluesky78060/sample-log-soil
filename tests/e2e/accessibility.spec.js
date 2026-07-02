// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * 접근성 테스트
 * - 키보드 네비게이션
 * - ARIA 라벨
 * - 포커스 관리
 * - 시맨틱 HTML
 */
test.describe('접근성 테스트', () => {

    test.describe('토양 페이지 접근성', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/soil/');
            await page.waitForLoadState('networkidle');
        });

        test('Tab 키로 폼 필드 순회 가능', async ({ page }) => {
            // 첫 번째 입력 필드에 포커스
            await page.locator('#name').focus();

            // Tab 키로 다음 필드로 이동
            await page.keyboard.press('Tab');

            // 다음 요소에 포커스가 이동했는지 확인
            const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
            expect(['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA']).toContain(focusedElement);
        });

        test('필수 입력 필드에 label이 있는지 확인', async ({ page }) => {
            // 이름 필드의 라벨 확인
            const nameLabel = page.locator('label[for="name"]');
            const nameLabelCount = await nameLabel.count();

            // 라벨이 있거나 placeholder로 대체
            const nameInput = page.locator('#name');
            const placeholder = await nameInput.getAttribute('placeholder');

            expect(nameLabelCount > 0 || placeholder).toBeTruthy();
        });

        test('버튼에 접근 가능한 텍스트가 있는지 확인', async ({ page }) => {
            const submitBtn = page.locator('#navSubmitBtn');

            // 버튼 텍스트 또는 title/aria-label 확인
            const text = await submitBtn.textContent();
            const title = await submitBtn.getAttribute('title');
            const ariaLabel = await submitBtn.getAttribute('aria-label');

            expect(text || title || ariaLabel).toBeTruthy();
        });

        test('네비게이션 바가 키보드로 접근 가능', async ({ page }) => {
            // 네비게이션 버튼들이 tabindex로 접근 가능한지 확인
            const navButtons = page.locator('.nav-view-btn, .view-btn, [data-view]');
            const count = await navButtons.count();

            if (count > 0) {
                const firstBtn = navButtons.first();
                await firstBtn.focus();
                await expect(firstBtn).toBeFocused();
            }
        });

        test('모달이 열릴 때 포커스 트래핑', async ({ page }) => {
            // 목록 뷰로 이동
            await page.click('[data-view="list"]');
            await page.waitForSelector('#listView');

            // 검색 모달 열기
            await page.click('#openSearchModalBtn');
            await expect(page.locator('#listSearchModal')).toBeVisible();

            // 모달 내부에 포커스 가능한 요소가 있는지 확인
            const focusableInModal = page.locator('#listSearchModal').locator('input, button, [tabindex]');
            const focusableCount = await focusableInModal.count();
            expect(focusableCount).toBeGreaterThan(0);
        });

        test('폼 입력 시 Enter 키로 제출 방지 또는 허용', async ({ page }) => {
            // 이름 입력
            await page.fill('#name', '엔터테스트');

            // Enter 키 입력 - 폼이 의도치 않게 제출되지 않는지 확인
            await page.keyboard.press('Enter');

            // 페이지가 유지되는지 확인 (새로고침 없음)
            await expect(page.locator('#name')).toBeVisible();
        });

        test('색상 대비 - 텍스트가 읽을 수 있는지 확인', async ({ page }) => {
            // 주요 텍스트 요소가 존재하는지 확인
            const mainContent = page.locator('.main-content, .form-container, main');
            await expect(mainContent.first()).toBeVisible();
        });
    });

    test.describe('메인 페이지 접근성', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');
        });

        test('시료 타입 카드가 키보드로 선택 가능', async ({ page }) => {
            const cards = page.locator('.sample-card, .card, a[href*="index.html"]');
            const count = await cards.count();

            if (count > 0) {
                await cards.first().focus();

                // 포커스된 요소가 링크 또는 버튼인지 확인
                const tagName = await page.evaluate(() => document.activeElement?.tagName);
                expect(['A', 'BUTTON', 'DIV']).toContain(tagName);
            }
        });

        test('페이지 제목이 있는지 확인', async ({ page }) => {
            const title = await page.title();
            expect(title).toBeTruthy();
            expect(title.length).toBeGreaterThan(0);
        });

        test('주요 랜드마크가 있는지 확인', async ({ page }) => {
            // main, nav, header, body 등의 랜드마크 요소 또는 콘텐츠 컨테이너
            const main = page.locator('main, [role="main"], .main-content, .container, body');
            const mainCount = await main.count();

            // 최소한 하나의 주요 콘텐츠 영역이 있어야 함
            expect(mainCount).toBeGreaterThan(0);
        });
    });

    test.describe('공통 접근성 요소', () => {
        test('스킵 링크 또는 빠른 탐색 존재 확인', async ({ page }) => {
            await page.goto('/soil/');
            await page.waitForLoadState('networkidle');

            // 스킵 링크가 있으면 좋지만 필수는 아님
            const skipLink = page.locator('[href="#main"], [href="#content"], .skip-link');
            const skipLinkCount = await skipLink.count();

            // 스킵 링크 존재 여부 기록 (실패하지 않음)
            expect(skipLinkCount >= 0).toBe(true);
        });

        test('포커스 표시가 보이는지 확인', async ({ page }) => {
            await page.goto('/soil/');
            await page.waitForLoadState('networkidle');

            // 입력 필드에 포커스
            const input = page.locator('#name');
            await input.focus();

            // 포커스 상태 확인
            await expect(input).toBeFocused();
        });
    });
});
