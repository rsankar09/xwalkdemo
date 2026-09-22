const {parseHTML}=require('linkedom');
const d=require(require('path').resolve(__dirname,'../capture/home/dom.json'));
const {document}=parseHTML(d.html);
const ids={'cmp-003':'container-3fa13bf9f9','cmp-004':'container-a45a9ae443','cmp-005':'container-9e57203639','cmp-006':'container-710848f31b','cmp-007':'container-1991f9d8e4','cmp-008':'container-b91a8c83c8','cmp-009':'container-6e0d748310','cmp-010':'container-e09ffabe8d'};
function outline(el, depth, max, out){
  if(depth>max) return;
  const cls=(el.getAttribute&&el.getAttribute('class'))||'';
  const tag=el.tagName.toLowerCase();
  const kids=[...el.children];
  let txt='';
  if(!kids.length){ txt=(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,70); }
  out.push('  '.repeat(depth)+tag+(cls?'.'+cls.trim().split(/\s+/).join('.'):'')+(txt?'  «'+txt+'»':''));
  kids.forEach(k=>outline(k,depth+1,max,out));
}
const target=process.argv[2]; const max=+(process.argv[3]||6);
const el = target==='cmp-002' ? document.querySelector('.cmp-hero')
        : target==='cmp-011' ? document.querySelector('.cmp-email-subscribe')
        : document.getElementById(ids[target]);
if(!el){console.log('NOT FOUND');process.exit(1)}
const out=[];outline(el,0,max,out);console.log(out.join('\n'));
