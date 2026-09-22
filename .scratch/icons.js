const {parseHTML}=require('linkedom');const path=require('path');const fs=require('fs');
const d=require(path.resolve(__dirname,'../capture/home/dom.json'));
const {document}=parseHTML(d.html);
const root=path.resolve(__dirname,'..');
function sig(svgText){
  const ds=[...svgText.matchAll(/\sd="([^"]+)"/g)].map(m=>m[1].replace(/\s+/g,' ').trim());
  return ds.join('||');
}
// repo icons
const repo={};
for(const f of fs.readdirSync(path.join(root,'icons'))){
  if(!f.endsWith('.svg'))continue;
  repo[f.replace(/\.svg$/,'')]=sig(fs.readFileSync(path.join(root,'icons',f),'utf8'));
}
console.log('repo icons:',Object.keys(repo).join(', '));
const ids={'cmp-003':'container-3fa13bf9f9','cmp-007':'container-1991f9d8e4'};
for(const [k,v] of Object.entries(ids)){
  const el=document.getElementById(v);
  console.log('\n==',k);
  [...el.querySelectorAll('.cmp-card__image-wrapper svg')].forEach((svg,i)=>{
    const s=sig(svg.outerHTML);
    const match=Object.entries(repo).find(([n,rs])=>rs===s);
    const card=svg.closest('.card');
    const title=(card.querySelector('h3,p.text__medium')||{}).textContent||'';
    console.log(`  [${i}] "${title.trim().replace(/\s+/g,' ').slice(0,40)}" -> ${match?match[0]:'NO EXACT MATCH'}  paths=${s.split('||').length} sigLen=${s.length}`);
    if(!match){
      // try partial: first path d
      const first=s.split('||')[0];
      const p=Object.entries(repo).filter(([n,rs])=>rs.includes(first)&&first.length>20);
      console.log('       partial candidates:',p.map(x=>x[0]).join(',')||'none');
    }
  });
}
