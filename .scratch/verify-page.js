/* Page-level verification for the assembled draft page.
 * Tests at captured breakpoints (375/768/1440) UNION project CSS
 * breakpoints (600/900/1200).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.PAGE_URL || 'http://localhost:3000/drafts/home/nyl-home';
const WIDTHS = [375, 600, 768, 900, 1200, 1440];
const CAPTURED = new Set([375, 768, 1440]);
const OUT = path.resolve(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const results = [];

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('requestfailed', (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));
    page.on('response', (r) => {
      if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
    });

    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    // let the lazy + delayed phases settle
    await page.waitForTimeout(4000);
    // dismiss the OneTrust consent dialog the same way the capture did
    // (meta.json: consent_banner.selector = #onetrust-accept-btn-handler)
    try {
      await page.click('#onetrust-accept-btn-handler', { timeout: 4000 });
      await page.waitForTimeout(1000);
    } catch { /* not shown */ }
    await page.evaluate(() => {
      document.querySelector('#onetrust-consent-sdk')?.remove();
      document.body.classList.remove('ot-overflow-hidden');
      document.body.style.overflow = '';
    });
    // step through the page a viewport at a time so every lazy image
    // actually intersects the viewport — jumping to the bottom does not
    // load the cards in between.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 250));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 800));
    });
    await page.waitForFunction(
      () => [...document.images].every((i) => i.complete),
      null,
      { timeout: 20000 },
    ).catch(() => {});
    await page.waitForTimeout(1000);

    const data = await page.evaluate(() => {
      const de = document.documentElement;
      const blocks = [...document.querySelectorAll('[data-block-name]')].map((b) => ({
        name: b.dataset.blockName,
        status: b.dataset.blockStatus,
      }));
      // widest element check, to name the overflow culprit if there is one
      let widest = null;
      if (de.scrollWidth > de.clientWidth) {
        let max = 0;
        document.querySelectorAll('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          const right = r.right + window.scrollX;
          if (right > max) {
            max = right;
            widest = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').filter(Boolean).join('.')} right=${Math.round(right)}`;
          }
        });
      }
      return {
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        height: Math.max(document.body.scrollHeight, de.scrollHeight),
        blocks,
        widest,
        headings: [...document.querySelectorAll('main h1,main h2,main h3,main h4,main h5,main h6')]
          .map((h) => `${h.tagName} ${h.textContent.trim().slice(0, 50)}`),
        imagesNoAlt: [...document.querySelectorAll('main img')]
          .filter((i) => i.getAttribute('alt') === null).length,
        brokenImages: [...document.querySelectorAll('img')]
          .filter((i) => i.complete && i.naturalWidth === 0)
          .map((i) => i.currentSrc || i.src),
      };
    });

    await page.screenshot({ path: path.join(OUT, `page-${width}.png`), fullPage: true });

    results.push({
      width,
      captured: CAPTURED.has(width),
      overflow: data.scrollWidth > data.clientWidth ? `${data.scrollWidth} > ${data.clientWidth} (${data.widest})` : null,
      height: data.height,
      blocks: data.blocks,
      notLoaded: data.blocks.filter((b) => b.status !== 'loaded'),
      consoleErrors,
      pageErrors,
      failedRequests: [...new Set(failedRequests)],
      brokenImages: data.brokenImages,
      imagesNoAlt: data.imagesNoAlt,
      headings: data.headings,
    });
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));

  const SRC = { 375: 12736, 768: 8269, 1440: 7065 };
  console.log('\n=== PAGE VERIFICATION ===\n');
  for (const r of results) {
    console.log(`--- ${r.width}px ${r.captured ? '(captured)' : '(project breakpoint)'}`);
    console.log(`    overflow      : ${r.overflow || 'none'}`);
    const src = SRC[r.width];
    console.log(`    page height   : ${r.height}${src ? `  (source ${src}, delta ${r.height - src >= 0 ? '+' : ''}${r.height - src}, ${((r.height / src - 1) * 100).toFixed(1)}%)` : ''}`);
    console.log(`    blocks loaded : ${r.blocks.filter((b) => b.status === 'loaded').length}/${r.blocks.length}  [${r.blocks.map((b) => b.name).join(', ')}]`);
    if (r.notLoaded.length) console.log(`    NOT LOADED    : ${JSON.stringify(r.notLoaded)}`);
    if (r.consoleErrors.length) console.log(`    console errors: ${r.consoleErrors.join(' | ')}`);
    if (r.pageErrors.length) console.log(`    page errors   : ${r.pageErrors.join(' | ')}`);
    if (r.failedRequests.length) console.log(`    failed reqs   : ${r.failedRequests.join('\n                    ')}`);
    if (r.brokenImages.length) console.log(`    broken images : ${r.brokenImages.join(', ')}`);
    if (r.imagesNoAlt) console.log(`    imgs w/o alt  : ${r.imagesNoAlt}`);
    console.log();
  }
  console.log('heading outline @1440:');
  results.find((r) => r.width === 1440).headings.forEach((h) => console.log('   ', h));
})();
