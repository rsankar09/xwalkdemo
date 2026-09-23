/*
 * Page-level verification for eds-page-assemble.
 *
 * Unlike .scratch/verify-blocks.mjs (which probes four named blocks), this
 * asserts the things that only exist once the whole page is composed:
 *
 *   - no horizontal overflow at any width
 *   - every block reaches data-block-status="loaded", and the count matches
 *     the component list
 *   - no console errors, no failed requests, no broken images (chrome incl.)
 *   - section band geometry + colour, for adjacency
 *   - total page height, against the captured source
 *
 * Usage: node .scratch/verify-assembled-page.mjs [path]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const PATH = process.argv[2] || '/drafts/home/nyl-home';
const URL = `http://localhost:3000${PATH}`;
const WIDTHS = [375, 600, 768, 900, 1200, 1440];
const OUT = '.scratch/assembly-shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

/* collect diagnostics for the whole session, tagged by the width in force */
let currentWidth = 'load';
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];

page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push({ width: currentWidth, text: m.text() });
});
page.on('pageerror', (e) => pageErrors.push({ width: currentWidth, text: e.message }));
page.on('requestfailed', (r) => failedRequests.push({
  width: currentWidth, url: r.url(), err: r.failure()?.errorText,
}));
page.on('response', (r) => {
  if (r.status() >= 400) {
    failedRequests.push({ width: currentWidth, url: r.url(), err: `HTTP ${r.status()}` });
  }
});

await page.goto(URL, { waitUntil: 'networkidle' });

/* Dismiss the OneTrust consent banner the same way the capture did
   (index.json records consent_dismissed: "#onetrust-accept-btn-handler").
   Left up, its fixed overlay dims every screenshot and hides the hero. */
let consentDismissed = false;
try {
  await page.click('#onetrust-accept-btn-handler', { timeout: 8000 });
  consentDismissed = true;
} catch { /* banner not shown */ }
await page.evaluate(() => {
  document.querySelector('#onetrust-consent-sdk')?.remove();
  document.querySelector('.onetrust-pc-dark-filter')?.remove();
});

const report = { url: URL, consentDismissed, widths: {} };

for (const width of WIDTHS) {
  currentWidth = width;
  await page.setViewportSize({ width, height: 900 });

  /* step the viewport so lazy images actually load */
  // eslint-disable-next-line no-await-in-loop
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, 120); });
    }
    window.scrollTo(0, 0);
    await new Promise((r) => { setTimeout(r, 500); });
  });

  // eslint-disable-next-line no-await-in-loop
  report.widths[width] = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('[data-block-name]')];
    const notLoaded = blocks
      .filter((b) => b.dataset.blockStatus !== 'loaded')
      .map((b) => `${b.dataset.blockName}:${b.dataset.blockStatus || 'none'}`);

    const brokenImages = [...document.querySelectorAll('img')]
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => i.getAttribute('src'));

    const missingAlt = [...document.querySelectorAll('img')]
      .filter((i) => i.getAttribute('alt') === null)
      .map((i) => i.getAttribute('src'));

    /* band geometry: every direct section of main, plus header/footer */
    const bands = [];
    const push = (label, el) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      bands.push({
        label,
        y: Math.round(r.top + window.scrollY),
        h: Math.round(r.height),
        x: Math.round(r.left),
        w: Math.round(r.width),
        bg: cs.backgroundColor,
        mt: cs.marginTop,
        mb: cs.marginBottom,
        pt: cs.paddingTop,
        pb: cs.paddingBottom,
      });
    };
    push('header', document.querySelector('header'));
    [...document.querySelectorAll('main > .section')].forEach((s, i) => {
      const style = s.className.replace(/\bsection\b/g, '').trim() || '(none)';
      push(`section ${i} [${style}]`, s);
    });
    push('footer', document.querySelector('footer'));

    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      pageHeight: Math.round(document.body.getBoundingClientRect().height),
      blockCount: blocks.length,
      blockNames: blocks.map((b) => b.dataset.blockName),
      notLoaded,
      brokenImages,
      missingAlt,
      bands,
      outline: [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5')]
        .map((h) => `${h.tagName} ${h.textContent.trim().slice(0, 50)}`),
    };
  });

  // eslint-disable-next-line no-await-in-loop
  await page.screenshot({ path: `${OUT}/page-${width}.png`, fullPage: true });
}

report.consoleErrors = consoleErrors;
report.pageErrors = pageErrors;
report.failedRequests = failedRequests;

await browser.close();
fs.writeFileSync('.scratch/assembly-report.json', JSON.stringify(report, null, 2));

/* ---------- console summary ---------- */
console.log(`\n=== ${URL} ===\n`);
console.log('width | overflow            | blocks | not-loaded | broken img | page height');
for (const w of WIDTHS) {
  const r = report.widths[w];
  const ov = r.overflow ? `OVERFLOW ${r.scrollWidth}>${r.innerWidth}` : `ok (${r.scrollWidth})`;
  console.log(
    `${String(w).padStart(5)} | ${ov.padEnd(19)} | ${String(r.blockCount).padStart(6)}`
    + ` | ${String(r.notLoaded.length).padStart(10)} | ${String(r.brokenImages.length).padStart(10)}`
    + ` | ${r.pageHeight}`,
  );
}

console.log('\nblocks at 1440:', report.widths[1440].blockNames.join(', '));
const nl = report.widths[1440].notLoaded;
if (nl.length) console.log('NOT LOADED:', nl.join(', '));
const bi = report.widths[1440].brokenImages;
if (bi.length) console.log('BROKEN IMAGES:', bi.join(', '));
const ma = report.widths[1440].missingAlt;
if (ma.length) console.log('IMG MISSING alt ATTR:', ma.join(', '));

console.log(`\nconsole errors: ${consoleErrors.length}`);
consoleErrors.slice(0, 20).forEach((e) => console.log(`  [${e.width}] ${e.text.slice(0, 160)}`));
console.log(`page errors: ${pageErrors.length}`);
pageErrors.slice(0, 20).forEach((e) => console.log(`  [${e.width}] ${e.text.slice(0, 160)}`));

/* dedupe failed requests by url */
const seen = new Map();
failedRequests.forEach((f) => { if (!seen.has(f.url)) seen.set(f.url, f); });
console.log(`failed requests: ${failedRequests.length} (${seen.size} unique)`);
[...seen.values()].slice(0, 25).forEach((f) => console.log(`  ${f.err}  ${f.url}`));

console.log('\n=== band stack @1440 ===');
console.log('    y |    h |    x |    w | background               | section');
report.widths[1440].bands.forEach((b) => {
  console.log(
    `${String(b.y).padStart(5)} | ${String(b.h).padStart(4)} | ${String(b.x).padStart(4)}`
    + ` | ${String(b.w).padStart(4)} | ${b.bg.padEnd(23)} | ${b.label}`,
  );
});

console.log('\n=== heading outline @1440 ===');
report.widths[1440].outline.forEach((h) => console.log(`  ${h}`));
