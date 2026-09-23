/*
 * Block-level geometry verification for the four blocks returned from page
 * assembly. Reports x, y, w, h for every probe at the union of the captured
 * breakpoints (375/768/1440) and the project's own CSS breakpoints
 * (600/900/1200), plus the computed properties each fix is about, plus a
 * horizontal-overflow assertion at every width.
 *
 * Usage: node .scratch/verify-blocks.mjs [doc|ue]
 *   doc = document-authored surface  (drafts/home/nyl-home)
 *   ue  = editor-shaped surface      (drafts/components-ue)
 */
import { chromium } from 'playwright';

const SURFACE = process.argv[2] === 'ue' ? 'ue' : 'doc';
const URL = SURFACE === 'ue'
  ? 'http://localhost:3000/drafts/components-ue'
  : 'http://localhost:3000/drafts/home/nyl-home';

const WIDTHS = [375, 600, 768, 900, 1200, 1440];

/* selector -> computed properties worth reading back at each width */
const PROBES = [
  ['announcement strip', '.announcement-banner', ['background-color', 'border-radius', 'padding', 'margin-left']],
  ['announcement inner', '.announcement-banner-inner', ['max-width']],
  ['hero block', '.hero-billboard', ['min-height']],
  ['hero card', '.hero-billboard-content', ['clip-path', 'padding', 'width', 'text-align']],
  ['hero cta', '.hero-billboard-cta', ['text-align', 'margin-left', 'align-self']],
  ['hero cta anchor', '.hero-billboard-cta a', ['border-radius']],
  ['feature card item', '.feature-card .feature-card-item', ['border-radius', 'box-shadow', 'border', 'overflow']],
  ['feature card media img', '.feature-card .feature-card-media img', ['border-radius', 'aspect-ratio']],
  ['band block', '.feature-highlight-band', ['background-color']],
  ['band item title', '.feature-highlight-band-item-title', ['font-size', 'font-weight', 'line-height']],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle' });
try { await page.click('#onetrust-accept-btn-handler', { timeout: 4000 }); } catch { /* not shown */ }
await page.evaluate(() => document.querySelector('#onetrust-consent-sdk')?.remove());

const results = {};
const overflow = {};
const tags = {};

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  /* step the viewport so lazy images actually load; jumping to the bottom
     skips everything in between and leaves blank frames */
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, 120); });
    }
    window.scrollTo(0, 0);
    await new Promise((r) => { setTimeout(r, 400); });
  });

  results[width] = await page.evaluate((probes) => {
    const out = {};
    probes.forEach(([label, sel, props]) => {
      const el = document.querySelector(sel);
      if (!el) { out[label] = null; return; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const computed = {};
      props.forEach((p) => { computed[p] = cs.getPropertyValue(p); });
      out[label] = {
        x: Math.round(r.left),
        y: Math.round(r.top + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
        computed,
      };
    });
    return out;
  }, PROBES);

  overflow[width] = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
}

/* heading outline + per-cell class assertions, surface-independent */
tags.outline = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3, main h4')]
  .map((h) => `${h.tagName} ${h.textContent.trim().slice(0, 44)}`));
tags.unclassified = await page.evaluate(() => {
  const names = ['announcement-banner', 'hero-billboard', 'feature-card', 'feature-highlight-band'];
  const out = {};
  names.forEach((n) => {
    const block = document.querySelector(`.${n}`);
    if (!block) { out[n] = 'BLOCK ABSENT'; return; }
    /* a cell still shaped `div > div` with no block class means classification
       missed it on this surface — the quiet half-decorated failure */
    const stray = [...block.querySelectorAll(':scope > div > div')]
      .filter((d) => ![...d.classList].some((c) => c.startsWith(n)));
    out[n] = stray.length ? `${stray.length} UNCLASSIFIED CELL(S)` : 'ok';
  });
  return out;
});

await browser.close();

console.log(`\n=== surface: ${SURFACE}  (${URL}) ===\n`);
for (const [label] of PROBES) {
  console.log(label);
  console.log('  width |    x |    y |    w |    h | computed');
  for (const width of WIDTHS) {
    const r = results[width][label];
    if (!r) { console.log(`  ${String(width).padStart(5)} | ABSENT`); continue; }
    const c = Object.entries(r.computed).map(([k, v]) => `${k}: ${v}`).join('; ');
    console.log(
      `  ${String(width).padStart(5)} | ${String(r.x).padStart(4)} | ${String(r.y).padStart(4)}`
      + ` | ${String(r.w).padStart(4)} | ${String(r.h).padStart(4)} | ${c}`,
    );
  }
  console.log('');
}

console.log('overflow check (scrollWidth must equal innerWidth)');
for (const width of WIDTHS) {
  const o = overflow[width];
  console.log(`  ${String(width).padStart(5)} | scrollWidth ${o.scrollWidth} vs inner ${o.inner} | ${o.scrollWidth === o.inner ? 'ok' : 'OVERFLOW'}`);
}

console.log('\ncell classification');
Object.entries(tags.unclassified).forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${v}`));

console.log('\nheading outline');
tags.outline.forEach((h) => console.log(`  ${h}`));
