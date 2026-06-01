// tests/e2e/manual-capture.spec.js
// @ts-check
const { test } = require('@playwright/test');
const path = require('path');
const { seedSoilDemoData } = require('./helpers/seed-demo-data');
const { annotate, clearAnnotations } = require('./helpers/annotate');

const OUT = path.join(__dirname, '../../src/manual/images');
test.use({ viewport: { width: 1280, height: 800 } });

async function gotoAndWait(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

test.describe('설명서 캡처', () => {
  test.beforeEach(async ({ page }) => {
    await seedSoilDemoData(page);
  });

  test('섹션1: 메인 화면', async ({ page }) => {
    await gotoAndWait(page, '/');
    await page.screenshot({ path: path.join(OUT, 'step-01-main.png') });
  });

  test('섹션2-a: 접수 입력 화면 + 핵심 필드 번호 안내', async ({ page }) => {
    await gotoAndWait(page, '/soil/');
    await annotate(page, [
      { selector: '#receptionNumber', number: 1, label: '접수번호' },
      { selector: '#date', number: 2, label: '접수일자' },
      { selector: '.reception-method-btn', number: 3, label: '접수방법 선택' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-02-register-fields.png') });
    await clearAnnotations(page);
  });

  test('섹션2-b: 등록 버튼 위치 안내', async ({ page }) => {
    await gotoAndWait(page, '/soil/');
    await annotate(page, [
      { selector: '#navSubmitBtn', number: 1, label: '여기를 누르면 접수 등록' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-03-submit.png') });
    await clearAnnotations(page);
  });

  test('섹션3: 접수 목록', async ({ page }) => {
    await gotoAndWait(page, '/soil/');
    await page.click('[data-view="list"]');
    await page.waitForTimeout(400);
    // 기본 필터(미완료) 해제 — 전체 목록 노출
    await page.selectOption('#completedFilter', '');
    await page.waitForTimeout(400);
    await annotate(page, [
      { selector: '[data-view="list"]', number: 1, label: '목록 보기 탭' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-04-list.png') });
    await clearAnnotations(page);
  });

  test('섹션4: 흙토람 결과 가져오기', async ({ page }) => {
    await gotoAndWait(page, '/soil/');
    await annotate(page, [
      { selector: '#heuktoramBtn', number: 1, label: '흙토람 결과 입력/내보내기' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-05-heuktoram.png') });
    await clearAnnotations(page);
  });

  test('섹션5: 데이터 관리(엑셀/서식)', async ({ page }) => {
    await gotoAndWait(page, '/soil/');
    await annotate(page, [
      { selector: '#exportBtn', number: 1, label: '엑셀 내보내기' },
      { selector: '#downloadTemplateNavBtn', number: 2, label: '엑셀 서식 다운로드' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-06-data-mgmt.png') });
    await clearAnnotations(page);
  });

  test('섹션6: 라벨 인쇄', async ({ page }) => {
    await gotoAndWait(page, '/label-print/');
    await page.screenshot({ path: path.join(OUT, 'step-07-label.png') });
  });

  test('섹션8: 설정', async ({ page }) => {
    await gotoAndWait(page, '/settings/');
    await page.screenshot({ path: path.join(OUT, 'step-08-settings.png') });
  });

  test('섹션4-b: 흙토람 리스트 화면', async ({ page }) => {
    await gotoAndWait(page, '/heuktoram/');
    await page.waitForTimeout(500); // 표 렌더 대기
    await page.waitForSelector('#tableBody tr', { timeout: 5000 });
    await annotate(page, [
      { selector: '#collectYear', number: 1, label: '채취년도·시료채취자·토양검정일 입력' },
      { selector: '#applyBulkBtn', number: 2, label: '일괄적용' },
      { selector: '#exportBtn', number: 3, label: '흙토람 서식 내보내기' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-09-heuktoram-list.png') });
    await clearAnnotations(page);
  });

  test('섹션4-c: 흙토람 결과 입력 창', async ({ page }) => {
    await gotoAndWait(page, '/heuktoram/');
    await page.waitForTimeout(500);
    await page.click('#importResultBtn');
    await page.waitForSelector('#resultImporterModal:not(.hidden)', { timeout: 5000 });
    await page.waitForTimeout(400);
    await annotate(page, [
      { selector: 'input[name="importerMode"]', number: 1, label: '엑셀 파일 업로드 / 텍스트 붙여넣기 선택' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-10-heuktoram-input.png') });
    await clearAnnotations(page);
  });
});
