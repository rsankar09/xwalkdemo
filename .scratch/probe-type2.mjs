import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3000/drafts/home/nyl-home', { waitUntil: 'networkidle' });
const out = await p.evaluate(() => {
  const res = [];
  const add = (label, e) => { if (!e) { res.push(`${label.padEnd(30)} ABSENT`); return; }
    const c = getComputedStyle(e);
    res.push(`${label.padEnd(30)} size=${c.fontSize.padEnd(6)} weight=${c.fontWeight.padEnd(4)} lh=${c.lineHeight.padEnd(7)} | ${e.textContent.trim().slice(0,38)}`); };
  // the guidance intro paragraph = default content directly in a section
  const sec1 = document.querySelectorAll('main > .section')[1];
  add('guidance intro p', [...sec1.querySelectorAll(':scope > .default-content-wrapper > p')].pop());
  add('guidance eyebrow p', sec1.querySelector(':scope > .default-content-wrapper > p'));
  add('icon-list card body', document.querySelector('.icon-list-card p'));
  add('feature-card eyebrow', document.querySelector('.feature-card p'));
  add('product-card body', [...document.querySelectorAll('.product-card p')].pop());
  add('highlight band body', [...document.querySelectorAll('.feature-highlight-band p')].pop());
  add('footnote p', document.querySelector('.section.footnotes p'));
  return res;
});
console.log(out.join('\n'));
await b.close();
