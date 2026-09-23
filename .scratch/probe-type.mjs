import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3000/drafts/home/nyl-home', { waitUntil: 'networkidle' });
const out = await p.evaluate(() => {
  const pick = (sel, label) => { const e = document.querySelector(sel); if (!e) return `${label}: ABSENT`;
    const c = getComputedStyle(e);
    return `${label.padEnd(26)} size=${c.fontSize.padEnd(6)} weight=${c.fontWeight.padEnd(4)} lh=${c.lineHeight.padEnd(7)} radius=${c.borderRadius.padEnd(8)} font=${c.fontFamily.slice(0,34)}`; };
  return [
    pick('main h1', 'h1 (hero)'),
    pick('main h2', 'h2 (section heading)'),
    pick('.feature-card h3', 'h3 (card title)'),
    pick('.announcement-banner h2', 'h2 (announcement)'),
    pick('main p', 'p (body)'),
    pick('.hero-billboard-cta a', 'a.button (hero cta)'),
    pick('.cta-banner a', 'a.button (cta banner)'),
    pick('footer a', 'a (footer link)'),
    pick('.section.footnotes p', 'p (footnote)'),
  ];
});
console.log(out.join('\n'));
const fonts = await p.evaluate(() => ({
  bodyFont: getComputedStyle(document.body).fontFamily,
  headingFont: getComputedStyle(document.querySelector('main h2')).fontFamily,
  loaded: [...document.fonts].map(f=>`${f.family} ${f.weight} ${f.status}`),
}));
console.log('\nbody font :', fonts.bodyFont);
console.log('heading   :', fonts.headingFont);
console.log('font faces:', [...new Set(fonts.loaded)].join(' | '));
await b.close();
