const {parseHTML}=require('linkedom');const path=require('path');
const d=require(path.resolve(__dirname,'../capture/home/dom.json'));
const {document}=parseHTML(d.html);
const root=document.querySelector('.root.container.responsivegrid');
let node=root; while(node&&node.children.length===1)node=node.children[0];
let main=[...node.children][1]; while(main&&main.children.length===1)main=main.children[0];
const secs=[...main.children];
[[3,'product'],[5,'articles'],[6,'calculators'],[8,'community']].forEach(([i,l])=>{
  console.log('### '+l);
  secs[i].querySelectorAll('a.cmp-card__content-wrapper').forEach(a=>{
    const pre=a.querySelector('.cmp-card__pretitle');
    const t=a.querySelector('p.text__medium span, h3 span');
    const desc=a.querySelector('.text__body');
    console.log(`  href=${a.getAttribute('href')}`);
    console.log(`  title-attr="${a.getAttribute('title')}"`);
    console.log(`  pretitle="${pre?pre.textContent.trim():''}" heading="${t?t.textContent.trim():''}"`);
    if(desc) console.log(`  desc="${desc.textContent.trim().replace(/\s+/g,' ')}"`);
    console.log();
  });
});
console.log('### icon-list (sec1) titles/desc');
secs[1].querySelectorAll('.cmp-card--list .cmp-card').forEach(c=>{
  console.log(`  h="${c.querySelector('h3').textContent.trim()}" desc="${c.querySelector('.text__body').textContent.trim().replace(/\s+/g,' ')}"`);
});
