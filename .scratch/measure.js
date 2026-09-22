/* Per-component geometry at 1440, compared with the capture's inventory rects. */
const { chromium } = require('playwright');
const inv = require('../capture/home/inventory.json');

const MAP = {
  'cmp-001': 'header',
  'cmp-002': '.hero-billboard',
  'cmp-003': '.icon-list-card',
  'cmp-004': '.announcement-banner',
  'cmp-005': '.product-card',
  'cmp-006': 'main .section:nth-of-type(5) .feature-card',
  'cmp-007': '.icon-link-card',
  'cmp-008': '.feature-highlight-band',
  'cmp-009': 'main .section:nth-of-type(8) .feature-card',
  'cmp-010': '.cta-banner',
  'cmp-011': '.email-subscribe',
  'cmp-012': 'footer',
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/drafts/home/nyl-home', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  try { await page.click('#onetrust-accept-btn-handler', { timeout: 4000 }); } catch { /* */ }
  await page.evaluate(() => document.querySelector('#onetrust-consent-sdk')?.remove());
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 1500));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);

  const ours = await page.evaluate((map) => {
    const out = {};
    for (const [id, sel] of Object.entries(map)) {
      const el = document.querySelector(sel);
      if (!el) { out[id] = null; continue; }
      const r = el.getBoundingClientRect();
      out[id] = { y: Math.round(r.top + window.scrollY), h: Math.round(r.height) };
    }
    return out;
  }, MAP);

  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  await browser.close();

  console.log('component             source y/h        ours y/h          Δheight');
  console.log('-'.repeat(72));
  let acc = 0;
  for (const c of inv) {
    const s = c.bounding_rect;
    const o = ours[c.id];
    if (!o) { console.log(`${(c.id + ' ' + c.component_key).padEnd(22)}${(s.y + '/' + s.h).padEnd(18)}MISSING`); continue; }
    const d = o.h - s.h;
    acc += d;
    console.log(
      `${(c.id + ' ' + c.component_key).padEnd(22)}${(s.y + '/' + s.h).padEnd(18)}${(o.y + '/' + o.h).padEnd(18)}${d >= 0 ? '+' : ''}${d}`,
    );
  }
  console.log('-'.repeat(72));
  console.log(`sum of component deltas: ${acc >= 0 ? '+' : ''}${acc}`);
  console.log(`source page 7065  |  ours ${total}  |  total delta ${total - 7065}`);
})();
