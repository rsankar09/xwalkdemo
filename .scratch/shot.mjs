import puppeteer from 'puppeteer-core';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b=await puppeteer.launch({headless:true,args:['--no-sandbox'],executablePath:CHROME});
const targets=[['home-1440','/drafts/home/nyl-home',1440],['home-375','/drafts/home/nyl-home',375],['ue-1440','/drafts/ue-instrumented',1440]];
await targets.reduce(async (prev,[name,path,w])=>{
  await prev;
  const p=await b.newPage();
  await p.setViewport({width:w,height:1000});
  await p.goto('http://localhost:3000'+path,{waitUntil:'networkidle0'});
  await p.evaluate(async()=>{await new Promise(res=>{let y=0;const t=setInterval(()=>{window.scrollBy(0,600);y+=600;
    if(y>=document.body.scrollHeight){clearInterval(t);res();}},40);});});
  await new Promise(r=>setTimeout(r,2000));
  await p.evaluate(()=>window.scrollTo(0,0));
  await new Promise(r=>setTimeout(r,400));
  await p.screenshot({path:`.scratch/validation-shots/${name}.png`,fullPage:true});
  console.log('shot',name);
  return p.close();
},Promise.resolve());
await b.close();
