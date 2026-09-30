// 사용: node pages.cjs <cdpPort> — 패키징 앱에서 주요 페이지를 file:// 로 열어 콘솔 오류·CSP 위반·빈 화면을 본다
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${process.argv[2]}`);
  const ctx = b.contexts()[0]; let page = ctx.pages()[0];
  for (let i = 0; i < 40 && !page; i++) { await new Promise(r => setTimeout(r, 250)); page = ctx.pages()[0]; }
  await page.waitForLoadState('load');
  const base = page.url().replace(/\/docs\/.*$/, '/docs/');
  const out = [];
  // 로드 중 발생하는 CSP 위반도 잡도록 문서 시작 전에 리스너를 붙인다
  await ctx.addInitScript(() => { window.__v = []; document.addEventListener('securitypolicyviolation', e => window.__v.push(e.violatedDirective)); });
  for (const p of ['index.html', 'soil/index.html', 'compost/index.html', 'settings/index.html', 'manual/index.html', 'release/index.html', 'label-print/index.html', 'heuktoram/index.html', 'compost-analysis/index.html', 'feedback/index.html', 'feedback-admin/index.html', 'landing/index.html', 'manual/firebase-setup.html']) {
    const errs = [], viol = [];
    const onC = m => { if (['error'].includes(m.type())) errs.push(m.text().slice(0, 160)); };
    const onE = e => errs.push('pageerror: ' + String(e.message).slice(0, 160));
    page.on('console', onC); page.on('pageerror', onE);
    await page.exposeFunction?.('__noop', () => {}).catch(() => {});
    await page.goto(base + p, { waitUntil: 'load' }).catch(e => errs.push('goto: ' + e.message.slice(0, 120)));
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => ({ title: document.title, bodyText: document.body?.innerText?.length ?? 0, viol: window.__v || [], api: typeof window.electronAPI, xlsx: typeof window.XLSX, dompurify: typeof window.DOMPurify })).catch(e => ({ err: e.message }));
    page.off('console', onC); page.off('pageerror', onE);
    out.push({ p, title: info.title, textLen: info.bodyText, api: info.api, XLSX: info.xlsx, DOMPurify: info.dompurify, csp: info.viol, errors: errs });
  }
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch(e => { console.error('PAGES_FAIL', e.message); process.exit(1); });
