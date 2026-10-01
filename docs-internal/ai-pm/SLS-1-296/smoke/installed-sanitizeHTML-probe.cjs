// 설치본에서 앱의 실제 sanitizeHTML 래퍼(window.sanitizeHTML)가 동봉된 DOMPurify 로 동작하는지 —
// 래퍼의 afterSanitizeAttributes 훅(target=_blank → rel="noopener noreferrer")과 XSS 제거
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${process.argv[2]}`);
  const p = b.contexts()[0].pages()[0];
  await p.goto(p.url().replace(/\/docs\/.*$/, '/docs/soil/index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => ({
    version: window.DOMPurify?.version,
    wrapper: typeof window.sanitizeHTML,
    out: typeof window.sanitizeHTML === 'function'
      ? window.sanitizeHTML('<a href="https://x.test" target="_blank">l</a><img src=x onerror=alert(1)><script>alert(2)</script>')
      : null,
  }));
  console.log(JSON.stringify(r));
  const ok = r.version === '3.4.16' && r.wrapper === 'function' && /rel="noopener noreferrer"/.test(r.out) && !/onerror|<script/i.test(r.out);
  console.log(ok ? 'PROBE_OK' : 'PROBE_FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('PROBE_ERR', e.message); process.exit(2); });
