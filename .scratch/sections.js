/* Band-by-band geometry of our page, plus the type scale, at a given width. */
const { chromium } = require('playwright');

(async () => {
  const width = +(process.argv[2] || 1440);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: 900 } });
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

  const data = await page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { y: Math.round(r.top + window.scrollY), h: Math.round(r.height) };
    };
    const bands = [];
    const header = document.querySelector('header');
    if (header) bands.push({ label: 'header', ...rect(header), bg: getComputedStyle(header).backgroundColor });
    document.querySelectorAll('main > .section').forEach((s, i) => {
      const cs = getComputedStyle(s);
      const label = (s.querySelector('h1,h2,h3')?.textContent
        || s.querySelector('[data-block-name]')?.dataset.blockName
        || 'section').trim().slice(0, 34);
      bands.push({
        label: `${i}. ${label}`,
        ...rect(s),
        bg: cs.backgroundColor,
        pad: `${cs.paddingTop}/${cs.paddingBottom}`,
        mar: `${cs.marginTop}/${cs.marginBottom}`,
        style: s.className.replace('section', '').trim(),
      });
    });
    const footer = document.querySelector('footer');
    if (footer) bands.push({ label: 'footer', ...rect(footer), bg: getComputedStyle(footer).backgroundColor });

    const type = {};
    ['h1', 'h2', 'h3', 'h4'].forEach((t) => {
      const el = document.querySelector(`main ${t}`);
      if (el) {
        const cs = getComputedStyle(el);
        type[t] = `${cs.fontSize} / ${cs.lineHeight} ${cs.fontWeight} ${cs.fontFamily.split(',')[0]}`;
      }
    });
    const body = getComputedStyle(document.querySelector('main p'));
    type.p = `${body.fontSize} / ${body.lineHeight} ${body.fontFamily.split(',')[0]}`;
    return { bands, type, total: document.documentElement.scrollHeight };
  });

  await browser.close();
  console.log(`\n=== our bands @ ${width} ===`);
  console.log('y      h     pad         margin      style            label');
  data.bands.forEach((b) => {
    console.log(
      `${String(b.y).padEnd(7)}${String(b.h).padEnd(6)}${(b.pad || '-').padEnd(12)}${(b.mar || '-').padEnd(12)}${(b.style || '-').padEnd(17)}${b.label}`,
    );
  });
  console.log(`total ${data.total}`);
  console.log('\ntype scale:');
  Object.entries(data.type).forEach(([k, v]) => console.log(`  ${k.padEnd(3)} ${v}`));
})();
