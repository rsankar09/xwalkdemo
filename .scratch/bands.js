const {parseHTML}=require('linkedom');const path=require('path');
const d=require(path.resolve(__dirname,'../capture/home/dom.json'));
const {document}=parseHTML(d.html);
const ids={'cmp-003':'container-3fa13bf9f9','cmp-004':'container-a45a9ae443','cmp-005':'container-9e57203639','cmp-006':'container-710848f31b','cmp-007':'container-1991f9d8e4','cmp-008':'container-b91a8c83c8','cmp-009':'container-6e0d748310','cmp-010':'container-e09ffabe8d'};
for(const [k,v] of Object.entries(ids)){
  const el=document.getElementById(v);
  const chain=[];
  let n=el;
  for(let i=0;i<5&&n;i++){
    const style=n.getAttribute&&n.getAttribute('style');
    const cls=(n.getAttribute&&n.getAttribute('class'))||'';
    chain.push(`${n.tagName.toLowerCase()}${n.id?'#'+n.id:''}[${cls.split(/\s+/).filter(c=>!/^aem-Grid/.test(c)).slice(0,4).join('.')}]${style?' STYLE='+style:''}`);
    n=n.parentElement;
  }
  console.log('==',k); chain.forEach((c,i)=>console.log('   '+'^'.repeat(i)+' '+c));
}
