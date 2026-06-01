// tests/e2e/manual-capture.spec.js
// @ts-check
const { test } = require('@playwright/test');
const path = require('path');
const { seedSoilDemoData } = require('./helpers/seed-demo-data');
const { annotate, clearAnnotations } = require('./helpers/annotate');

const OUT = path.join(__dirname, '../../src/manual/images');
test.use({ viewport: { width: 1280, height: 800 } });

test.describe('설명서 캡처', () => {
  test.beforeEach(async ({ page }) => {
    await seedSoilDemoData(page);
  });

  test('섹션1: 메인 화면', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(OUT, 'step-01-main.png') });
  });

  test('섹션2-a: 접수 입력 화면 + 핵심 필드 번호 안내', async ({ page }) => {
    await page.goto('/soil/');
    await page.waitForLoadState('networkidle');
    await annotate(page, [
      { selector: '#receptionNumber', number: 1, label: '접수번호' },
      { selector: '#date', number: 2, label: '접수일자' },
      { selector: '.reception-method-btn', number: 3, label: '접수방법 선택' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-02-register-fields.png') });
    await clearAnnotations(page);
  });

  test('섹션2-b: 등록 버튼 위치 안내', async ({ page }) => {
    await page.goto('/soil/');
    await page.waitForLoadState('networkidle');
    await annotate(page, [
      { selector: '#navSubmitBtn', number: 1, label: '여기를 누르면 접수 등록' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-03-submit.png') });
    await clearAnnotations(page);
  });
});
