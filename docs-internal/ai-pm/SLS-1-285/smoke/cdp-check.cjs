// 사용: node cdp-check.cjs <port> — 패키징 앱 메인 창에 붙어 런타임 신호(①의 UA·③④⑤)를 확인한다
const { chromium } = require(process.env.PW_PATH || 'playwright');
const probe = async () => {
  const v = [];
  const h = e => v.push({ directive: e.violatedDirective, policyTail: e.originalPolicy.slice(-40) });
  document.addEventListener('securitypolicyviolation', h);
  // CDP Runtime.evaluate 안의 eval은 allowUnsafeEvalBlockedByCSP(기본 true)로 CSP를 우회한다 → 평가가 끝난 뒤 타이머에서 실행
  let ev;
  await new Promise(r => setTimeout(() => { try { eval('1'); ev = 'EVAL_ALLOWED'; } catch (e) { ev = e.name; } r(); }, 0));
  await new Promise(r => setTimeout(r, 500));
  document.removeEventListener('securitypolicyviolation', h);
  const fp = document.featurePolicy ? document.featurePolicy.allowsFeature('camera') : 'n/a';
  return { url: location.href, ua: navigator.userAgent, ev, violations: v,
           headerCsp: v.length === 2 && v.some(x => x.policyTail.trim().endsWith('upgrade-insecure-requests;')),
           cameraAllowed: fp, hasApi: typeof window.electronAPI === 'object' };
};
(async () => {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${process.argv[2]}`);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];
  const errs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(`${m.type()}: ${m.text()}`); });
  await page.waitForLoadState('load');
  const main = await page.evaluate(probe);
  main.ipc = await page.evaluate(async () => ({
    version: await window.electronAPI.getVersion(),
    appPath: await window.electronAPI.getAppPath() }));
  // ⑤ will-navigate: soil 링크로 이동
  const link = await page.$('a[href*="soil/"]');
  let nav = null;
  if (link) {
    await Promise.all([page.waitForNavigation({ timeout: 20000 }), link.click()]);
    await page.waitForLoadState('load');
    nav = await page.evaluate(probe);
  }
  // ⑤ 팝업: openHeuktoram IPC
  const popupP = ctx.waitForEvent('page', { timeout: 20000 }).catch(e => null);
  await page.evaluate(() => window.electronAPI.openHeuktoram());
  const popup = await popupP;
  let pop = null;
  if (popup) { await popup.waitForLoadState('load'); pop = await popup.evaluate(probe); }
  await page.waitForTimeout(1500);
  console.log(JSON.stringify({ main, nav, popup: pop, consoleErrors: errs }, null, 2));
  process.exit(nav && pop ? 0 : 2);
})().catch(e => { console.error('CDP_FAIL', e); process.exit(1); });
