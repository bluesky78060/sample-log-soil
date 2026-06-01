// tests/e2e/helpers/annotate.js
// @ts-check

/**
 * 대상 요소들 위에 번호 배지/강조 테두리/라벨을 그린다.
 * @param {import('@playwright/test').Page} page
 * @param {Array<{selector:string, number:number, label?:string, box?:boolean}>} steps
 */
async function annotate(page, steps) {
  await page.evaluate((steps) => {
    const layer = document.createElement('div');
    layer.setAttribute('data-annotation-layer', 'true');
    Object.assign(layer.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none',
    });
    document.body.appendChild(layer);

    for (const s of steps) {
      const el = document.querySelector(s.selector);
      if (!el) { console.warn('annotate: selector 미발견 →', s.selector); continue; }
      const r = el.getBoundingClientRect();

      if (s.box !== false) {
        const box = document.createElement('div');
        Object.assign(box.style, {
          position: 'fixed', left: `${r.left - 4}px`, top: `${r.top - 4}px`,
          width: `${r.width + 8}px`, height: `${r.height + 8}px`,
          border: '3px solid #ef4444', borderRadius: '8px',
          boxShadow: '0 0 0 3px rgba(239,68,68,0.25)', boxSizing: 'border-box',
        });
        layer.appendChild(box);
      }

      const badge = document.createElement('div');
      badge.textContent = String(s.number);
      Object.assign(badge.style, {
        position: 'fixed', left: `${r.left - 16}px`, top: `${r.top - 16}px`,
        width: '30px', height: '30px', borderRadius: '50%',
        background: '#ef4444', color: '#fff', fontWeight: '700',
        fontFamily: 'sans-serif', fontSize: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      });
      layer.appendChild(badge);

      if (s.label) {
        const tag = document.createElement('div');
        tag.textContent = s.label;
        Object.assign(tag.style, {
          position: 'fixed', left: `${r.left}px`, top: `${r.top + r.height + 6}px`,
          background: '#1e293b', color: '#fff', padding: '4px 10px',
          borderRadius: '6px', fontFamily: 'sans-serif', fontSize: '13px',
          maxWidth: '320px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        });
        layer.appendChild(tag);
      }
    }
  }, steps);
}

/** 주석 레이어 제거 (연속 캡처용) */
async function clearAnnotations(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-annotation-layer]').forEach((n) => n.remove());
  });
}

module.exports = { annotate, clearAnnotations };
