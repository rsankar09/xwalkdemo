const {parseHTML}=require('linkedom');const path=require('path');
const d=require(path.resolve(__dirname,'../capture/home/dom.json'));
const {document}=parseHTML(d.html);
const root=document.querySelector('.root.container.responsivegrid');
let node=root; while(node && node.children.length===1) node=node.children[0];
let main=[...node.children][1]; while(main && main.children.length===1) main=main.children[0];
const SKIP=/^(script|style|noscript)$/;
function walk(el,depth,out,maxd){
  if(depth>maxd) return;
  const tag=el.tagName.toLowerCase(); if(SKIP.test(tag)) return;
  const cls=(el.getAttribute('class')||'').split(/\s+/).filter(x=>x&&!/^aem-Grid/.test(x)).join('.');
  const kids=[...el.children].filter(k=>!SKIP.test(k.tagName.toLowerCase()));
  const own=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').replace(/\s+/g,' ');
  const isLeafish = /^(h1|h2|h3|h4|h5|h6|p|a|li|span|img|button|input|label)$/.test(tag);
  let line='  '.repeat(depth)+tag+(cls?'.'+cls:'');
  if(isLeafish){ const t=(el.textContent||'').trim().replace(/\s+/g,' '); if(t) line+='  «'+t.slice(0,90)+'»';
    if(tag==='a') line+=' href='+el.getAttribute('href');
    if(tag==='img') line+=' src='+(el.getAttribute('src')||'').slice(0,90)+' alt="'+(el.getAttribute('alt')||'')+'"';
  } else if(own) line+='  «'+own.slice(0,80)+'»';
  out.push(line);
  if(/^(h[1-6]|p|a|li|button|label)$/.test(tag)) return;
  kids.forEach(k=>walk(k,depth+1,out,maxd));
}
const idx=+process.argv[2]; const maxd=+(process.argv[3]||8);
const sec=[...main.children][idx];
const out=[];walk(sec,0,out,maxd);console.log(out.join('\n'));
