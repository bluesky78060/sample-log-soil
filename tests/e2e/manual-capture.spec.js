// tests/e2e/manual-capture.spec.js
// @ts-check
const { test, expect } = require('@playwright/test');
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

  test('섹션v160-a: 경지구분 1차 필드 (접수 폼)', async ({ page }) => {
    await gotoAndWait(page, '/soil/');
    // 폼이 보이는 상태(기본 register 뷰)에서 경지구분 1차 필드가 포함된 폼 영역 캡처
    await page.waitForSelector('#landClass1', { timeout: 5000 });
    await annotate(page, [
      { selector: '#landClass1', number: 1, label: '경지구분 1차 (11종 선택)' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-11-landclass1-field.png') });
    await clearAnnotations(page);
  });

  test('섹션v160-b: 경지구분 1차 탭 (목록 뷰)', async ({ page }) => {
    await gotoAndWait(page, '/soil/');
    await page.click('[data-view="list"]');
    await page.waitForTimeout(400);
    // 전체 목록 표시 (완료 필터 해제)
    await page.selectOption('#completedFilter', '');
    await page.waitForTimeout(400);
    await page.waitForSelector('#landClass1Tab', { timeout: 5000 });
    await annotate(page, [
      { selector: '#landClass1Tab', number: 1, label: '경지구분 1차 탭 (탭별 독립번호)' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-12-landclass1-tab.png') });
    await clearAnnotations(page);
  });

  test('섹션v160-c: 엑셀 가져오기 모달', async ({ page }) => {
    await gotoAndWait(page, '/soil/');
    await page.waitForSelector('#soilImportBtn', { timeout: 5000 });
    await page.click('#soilImportBtn');
    // 동적 생성 모달 대기
    await page.waitForSelector('#soilImporterModal:not([hidden])', { timeout: 5000 });
    await page.waitForTimeout(500);
    // 경지구분 1차 일괄선택이 보이도록 .sri-body 스크롤 (파일 업로드 라디오도 함께 보이게)
    await page.evaluate(() => {
      const body = document.querySelector('#soilImporterModal .sri-body');
      const el = document.querySelector('[data-el="bulkLandClass"]');
      if (body && el) {
        // bulkLandClass가 스크롤 영역 중간에 오도록 조정
        const elTop = el.getBoundingClientRect().top;
        const bodyTop = body.getBoundingClientRect().top;
        const offset = elTop - bodyTop - body.clientHeight / 2;
        body.scrollTop += offset;
      }
    });
    await page.waitForTimeout(200);
    await annotate(page, [
      { selector: '[data-el="bulkLandClass"]', number: 1, label: '경지구분 1차 일괄선택 (전체 행 일괄 적용)' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-13-import-modal.png') });
    await clearAnnotations(page);
  });

  // SLS-1-194: 퇴비 섹션용 캡처.
  // 이 매뉴얼은 "화면을 보면서 그대로 따라 하면"을 표방하므로 신규 기능 섹션만
  // 이미지가 없으면 대상 독자(비숙련 사용자)에게 가장 불친절해진다.
  test('섹션10-a: 퇴비 접수 입력 화면', async ({ page }) => {
    await gotoAndWait(page, '/compost/');
    await annotate(page, [
      { selector: '#receptionNumber', number: 1, label: '접수번호 (자동)' },
      { selector: '#date', number: 2, label: '접수일자' },
      { selector: '#applicantType', number: 3, label: '개인 / 법인 구분' },
    ]);
    await page.screenshot({ path: path.join(OUT, 'step-14-compost-register.png') });
    await clearAnnotations(page);
  });

  test('섹션10-b: 퇴비 접수 목록', async ({ page }) => {
    const year = new Date().getFullYear();
    await page.addInitScript((y) => {
      localStorage.setItem(`compostSampleLogs_${y}`, JSON.stringify([
        { id: 'demo-1', receptionNumber: '101', date: `${y}-07-10`, name: '홍길동',
          phoneNumber: '010-1234-5678', addressRoad: '경상북도 봉화군 봉화읍 행복로 12',
          animalType: '소', applicantType: '개인', isComplete: false },
        { id: 'demo-2', receptionNumber: '102', date: `${y}-07-12`, name: '김철수',
          phoneNumber: '010-2345-6789', addressRoad: '경상북도 봉화군 물야면 오전리 45',
          animalType: '돼지', applicantType: '개인', isComplete: false },
      ]));
    }, year);
    await gotoAndWait(page, '/compost/');
    // 🚨 조건부 클릭이면 안 된다 (SLS-1-197 m-2 / SLS-1-267).
    //    `if (await listBtn.count()) await listBtn.click()`은 셀렉터가 깨져도 **통과한 채**
    //    접수 화면을 '목록' 이미지로 저장해 배포한다 — 초록불인데 산출물이 틀린 유형이다.
    //    폴백이던 `#navListBtn`은 compost·soil 어디에도 없는 죽은 셀렉터라 함께 지운다.
    const listBtn = page.locator('[data-view="list"]');
    await expect(listBtn).toBeVisible();
    await listBtn.click();
    await expect(page.locator('#listView')).toBeVisible();   // 목록이 실제로 떴는가
    // 렌더 애니메이션이 끝난 뒤를 찍는다 — toBeVisible()은 '보인다'까지만 보장한다
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'step-15-compost-list.png') });
  });
});
