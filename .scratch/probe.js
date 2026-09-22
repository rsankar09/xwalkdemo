const { chromium } = require('playwright');
(async()=>{
 const w=+(process.argv[2]||375);
 const b=await chromium.launch();
 const p=await b.newPage({viewport:{width:w,height:900}});
 await p.goto('http://localhost:3000/drafts/home/nyl-home',{waitUntil:'networkidle'});
 await p.waitForTimeout(3500);
 try{await p.click('#onetrust-accept-btn-handler',{timeout:3000})}catch{}
 await p.evaluate(async()=>{window.scrollTo(0,document.body.scrollHeight);await new Promise(r=>setTimeout(r,1500));window.scrollTo(0,0);});
 await p.waitForTimeout(1500);
 const out=await p.evaluate(()=>{
   const r=[];
   document.querySelectorAll('.feature-card img, .hero-billboard img, .feature-highlight-band img').forEach(img=>{
     const cs=getComputedStyle(img);
     const rect=img.getBoundingClientRect();
     const pic=img.closest('picture');
     r.push({
       block: img.closest('[data-block-name]')?.dataset.blockName,
       src:(img.currentSrc||img.src).split('/').pop().slice(0,50),
       natural: img.naturalWidth+'x'+img.naturalHeight,
       rect: Math.round(rect.width)+'x'+Math.round(rect.height),
       display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
       objectFit: cs.objectFit, position: cs.position,
       picRect: pic? Math.round(pic.getBoundingClientRect().width)+'x'+Math.round(pic.getBoundingClientRect().height):'-',
       picDisplay: pic? getComputedStyle(pic).display : '-',
       parentClass: img.parentElement.className,
       gpClass: img.parentElement.parentElement.className,
       gpRect: (()=>{const g=img.parentElement.parentElement.getBoundingClientRect();return Math.round(g.width)+'x'+Math.round(g.height)})(),
     });
   });
   return r;
 });
 console.table(out);
 await b.close();
})();
