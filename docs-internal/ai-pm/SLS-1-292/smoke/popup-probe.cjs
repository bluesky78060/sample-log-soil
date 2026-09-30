// 사용: node probe.cjs <cdpPort> — 메인 창과 흙토람 팝업이 무엇을 로드했는지 본다
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${process.argv[2]}`);
  const ctx = browser.contexts()[0];
  let page = ctx.pages()[0];
  for (let i = 0; i < 40 && !page; i++) { await new Promise(r => setTimeout(r, 250)); page = ctx.pages()[0]; }
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  const main = { url: page.url(), title: await page.title() };
  let popup = null;
  const hasOpen = await page.evaluate(() => typeof window.electronAPI?.openHeuktoram === 'function').catch(() => false);
  if (hasOpen) {
    const p = ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null);
    await page.evaluate(() => window.electronAPI.openHeuktoram()).catch(() => {});
    const pg = await p;
    if (pg) { await pg.waitForLoadState('load'); await pg.waitForTimeout(1000); popup = { url: pg.url(), title: await pg.title() };
      await pg.evaluate(() => { location.href = 'http://localhost:3000/'; }).catch(() => {});
      await pg.waitForTimeout(2000);
      popup.afterNavigateAttempt = pg.url(); }
  }
  console.log(JSON.stringify({ main, popup, mainHasOpenApi: hasOpen }));
  process.exit(0);
})().catch(e => { console.error('PROBE_FAIL', e.message); process.exit(1); });
