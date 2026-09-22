const {parseHTML}=require('linkedom');const path=require('path');
const d=require(path.resolve(__dirname,'../capture/home/dom.json'));
const {document}=parseHTML(d.html);
const root=document.querySelector('.root.container.responsivegrid');
let node=root;
while(node && node.children.length===1) node=node.children[0];
let main=[...node.children][1];
while(main && main.children.length===1) main=main.children[0];
function txt(el){return (el.textContent||'').trim().replace(/\s+/g,' ');}
[...main.children].forEach((c,i)=>{
  const cls=(c.getAttribute('class')||'').split(/\s+/).filter(x=>!/^aem-Grid/.test(x)).join('.');
  const t=txt(c);
  const style=c.getAttribute('style');
  console.log(`\n[${i}] <${c.tagName.toLowerCase()}> #${c.id||'-'} .${cls}${style?' STYLE='+style:''}  (len ${t.length})`);
  console.log('    ', t.slice(0,200));
});
