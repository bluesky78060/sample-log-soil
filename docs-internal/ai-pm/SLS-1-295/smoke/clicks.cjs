// 사용: node clicks.cjs <cdpPort> — 패키징 앱에서 두 페이지의 버튼을 실제로 클릭해 효과와 CSP 위반을 본다 (SLS-1-295)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${process.argv[2]}`);
  const ctx = b.contexts()[0]; let page = ctx.pages()[0];
  for (let i = 0; i < 40 && !page; i++) { await new Promise(r => setTimeout(r, 250)); page = ctx.pages()[0]; }
  await page.waitForLoadState('load');
  const base = page.url().replace(/\/docs\/.*$/, '/docs/');
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective)); });
  await page.bringToFront();                                   // 클립보드는 포커스가 없으면 거부된다
  const out = { release: {}, firebaseSetup: {} };

  // --- release: 다크 모드 토글 ---
  await page.goto(base + 'release/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.removeItem('theme-preference')); await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.click('#themeToggleBtn').catch(e => { out.release.clickError = e.message.slice(0, 80); });
  await page.waitForTimeout(400);
  out.release = { ...out.release, themeBefore: before,
    themeAfter: await page.evaluate(() => document.documentElement.getAttribute('data-theme')),
    stored: await page.evaluate(() => localStorage.getItem('theme-preference')),
    csp: await page.evaluate(() => window.__csp) };

  // --- firebase-setup: 탭 · FAQ · 체크리스트 · 복사 ---
  await page.goto(base + 'manual/firebase-setup.html', { waitUntil: 'load' }); await page.waitForTimeout(500);
  const fs = out.firebaseSetup;
  await page.click('.tab:nth-child(2)'); await page.waitForTimeout(250);
  fs.tabWebActive = await page.evaluate(() => document.getElementById('tab-web').classList.contains('active'));
  await page.click('.faq-item .faq-question'); await page.waitForTimeout(250);
  fs.faqOpen = await page.evaluate(() => document.querySelector('.faq-item').classList.contains('open'));
  const li = page.locator('#section-checklist .checklist li').first(); await li.scrollIntoViewIfNeeded(); await li.click(); await page.waitForTimeout(250);
  fs.checked = await li.evaluate(e => e.classList.contains('checked'));
  const btn = page.locator('.copy-btn:visible').first(); await btn.scrollIntoViewIfNeeded(); await btn.click(); await page.waitForTimeout(500);
  fs.copyText = await btn.textContent();
  fs.csp = await page.evaluate(() => window.__csp);
  console.log(JSON.stringify(out));
  const ok = out.release.themeAfter === 'dark' && out.release.csp.length === 0 && fs.tabWebActive && fs.faqOpen && fs.checked && fs.copyText === '복사됨!' && fs.csp.length === 0;
  console.log(ok ? 'CLICKS_OK' : 'CLICKS_FAIL'); process.exit(0);
})().catch(e => { console.error('CLICKS_ERR', e.message); process.exit(2); });
