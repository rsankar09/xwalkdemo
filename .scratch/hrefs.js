const {parseHTML}=require('linkedom');
const path=require('path');
const d=require(path.resolve(__dirname,'../capture/home/dom.json'));
const {document}=parseHTML(d.html);
const ids={'cmp-003':'container-3fa13bf9f9','cmp-004':'container-a45a9ae443','cmp-005':'container-9e57203639','cmp-006':'container-710848f31b','cmp-007':'container-1991f9d8e4','cmp-008':'container-b91a8c83c8','cmp-009':'container-6e0d748310','cmp-010':'container-e09ffabe8d'};
for (const [k,v] of Object.entries(ids)){
  const el=document.getElementById(v); if(!el) {console.log(k,'MISSING');continue;}
  const as=[...el.querySelectorAll('a')];
  console.log('==',k,'anchors:',as.length);
  as.forEach(a=>console.log('   href='+JSON.stringify(a.getAttribute('href'))+'  text='+JSON.stringify((a.textContent||'').trim().replace(/\s+/g,' ').slice(0,50))));
}
const hero=document.querySelector('.cmp-hero');
console.log('== cmp-002 hero anchors');
[...hero.querySelectorAll('a')].forEach(a=>console.log('   href='+JSON.stringify(a.getAttribute('href'))+'  text='+JSON.stringify((a.textContent||'').trim().replace(/\s+/g,' ').slice(0,50))));
