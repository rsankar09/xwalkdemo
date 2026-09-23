import puppeteer from 'puppeteer-core';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b=await puppeteer.launch({headless:true,args:['--no-sandbox'],executablePath:CHROME});
for (const [name,w] of [['pq-teaser-1440',1440],['pq-teaser-375',375]]) {
  const p=await b.newPage();
  await p.setViewport({width:w,height:1000});
  const errs=[];
  p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await p.goto('http://localhost:3000/drafts/pull-quote-teaser',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,1500));
  await p.screenshot({path:`.scratch/validation-shots/${name}.png`,fullPage:true});
  const dom=await p.evaluate(()=>[...document.querySelectorAll('.pull-quote,.teaser')].map(b=>({
    cls:b.className,
    html:b.innerHTML.replace(/\s+/g,' ').slice(0,150),
  })));
  console.log('--- '+name+' errors: '+(errs.length?errs.join(' | '):'none'));
  if(w===1440) dom.forEach(d=>console.log('  ['+d.cls+']\n     '+d.html));
  await p.close();
}
await b.close();
