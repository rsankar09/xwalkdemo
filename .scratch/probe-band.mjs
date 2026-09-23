import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:3000/drafts/home/nyl-home', { waitUntil: 'networkidle' });
await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=800){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,80));} window.scrollTo(0,0); await new Promise(r=>setTimeout(r,400)); });
const out = await p.evaluate(() => {
  const q = (s) => { const e=document.querySelector(s); if(!e) return `ABSENT ${s}`;
    const r=e.getBoundingClientRect(), cs=getComputedStyle(e);
    return {sel:s, y:Math.round(r.top+scrollY), h:Math.round(r.height), x:Math.round(r.left), w:Math.round(r.width),
      bg:cs.backgroundColor, bgImg:cs.backgroundImage.slice(0,60), clip:cs.clipPath.slice(0,60), radius:cs.borderRadius}; };
  return [
    q('.feature-highlight-band-container'),
    q('.feature-highlight-band'),
    q('.feature-highlight-band-wrapper'),
    q('.announcement-banner'),
    q('.cta-banner'),
    q('.section.navy'),
    q('.section.green'),
  ];
});
console.log(JSON.stringify(out,null,1));
// section vertical padding survey
const pad = await p.evaluate(() => [...document.querySelectorAll('main > .section')].map((s,i)=>{
  const cs=getComputedStyle(s); return `${i} [${s.className.replace(/\bsection\b/g,'').trim()}] pt=${cs.paddingTop} pb=${cs.paddingBottom} mt=${cs.marginTop} mb=${cs.marginBottom}`;
}));
console.log(pad.join('\n'));
await b.close();
