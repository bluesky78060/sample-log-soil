const { chromium } = require('playwright');
(async () => { const b = await chromium.connectOverCDP('http://127.0.0.1:9341'); const p = b.contexts()[0].pages()[0];
  const r = await p.evaluate(async () => { const api = window.electronAPI; const k = Object.keys(api).filter(x => /feedback/i.test(x));
    return { keys: k, res: k.includes('readFeedbackConfig') ? await api.readFeedbackConfig() : null }; });
  console.log(JSON.stringify(r)); process.exit(0); })().catch(e => { console.error(e.message); process.exit(1); });
