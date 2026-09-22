const {parseHTML}=require('linkedom');const path=require('path');
const d=require(path.resolve(__dirname,'../capture/home/dom.json'));
const {document}=parseHTML(d.html);
const h4=[...document.querySelectorAll('h4')].find(h=>/Official Partner/.test(h.textContent));
let n=h4;
for(let i=0;i<9&&n;i++){
  console.log('^'.repeat(i), n.tagName.toLowerCase(), '#'+(n.id||'-'), 'class="'+(n.getAttribute('class')||'')+'"', 'style="'+(n.getAttribute('style')||'')+'"', 'hidden='+n.hasAttribute('hidden'));
  n=n.parentElement;
}
// any <style> rules mentioning the ancestors
[...document.querySelectorAll('style')].forEach((s,i)=>{
  const t=s.textContent;
  if(/display\s*:\s*none/.test(t)) console.log('\nSTYLE#'+i+' has display:none:', t.replace(/\s+/g,' ').slice(0,600));
});
