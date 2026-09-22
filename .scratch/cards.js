const {parseHTML}=require('linkedom');const path=require('path');
const d=require(path.resolve(__dirname,'../capture/home/dom.json'));
const {document}=parseHTML(d.html);
const root=document.querySelector('.root.container.responsivegrid');
let node=root; while(node&&node.children.length===1)node=node.children[0];
let main=[...node.children][1]; while(main&&main.children.length===1)main=main.children[0];
const secs=[...main.children];
function dumpCards(sec,label){
  console.log('\n##### '+label);
  sec.querySelectorAll('.cmp-card').forEach((c,i)=>{
    const a=c.querySelector('a');
    const img=c.querySelector('img');
    const svg=c.querySelector('svg');
    const pre=c.querySelector('.cmp-card__pretitle');
    const title=c.querySelector('.cmp-card__title, h2,h3,h4,h5');
    const desc=c.querySelector('.cmp-card__description');
    console.log(` [${i}] href=${a?a.getAttribute('href'):'-'}`);
    if(img) console.log(`     img=${img.getAttribute('src')} alt="${img.getAttribute('alt')}"`);
    if(svg) console.log(`     svg viewBox=${svg.getAttribute('viewBox')} d0=${(svg.querySelector('path')?.getAttribute('d')||'').slice(0,40)}`);
    if(pre) console.log(`     pretitle="${pre.textContent.trim()}"`);
    if(title) console.log(`     title<${title.tagName.toLowerCase()}>="${title.textContent.trim()}"`);
    if(desc) console.log(`     desc="${desc.textContent.trim().replace(/\s+/g,' ').slice(0,120)}"`);
    const sr=c.querySelector('.sr-only,.visually-hidden');
    if(sr) console.log(`     sr-only="${sr.textContent.trim()}"`);
  });
}
dumpCards(secs[1],'sec1 icon-list-card (cmp-003)');
dumpCards(secs[3],'sec3 product-card (cmp-005)');
dumpCards(secs[5],'sec5 feature-card articles (cmp-006)');
dumpCards(secs[6],'sec6 icon-link-card calculators (cmp-007)');
dumpCards(secs[8],'sec8 feature-card community (cmp-009)');
