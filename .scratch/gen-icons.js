const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function fnv1a(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');}
function sig(t){return [...t.matchAll(/\sd="([^"]+)"/g)].map(m=>m[1].replace(/\s+/g,' ').trim()).join('||');}
const map={};
for(const f of fs.readdirSync(path.join(root,'icons')).sort()){
  if(!f.endsWith('.svg'))continue;
  const name=f.replace(/\.svg$/,'');
  const s=sig(fs.readFileSync(path.join(root,'icons',f),'utf8'));
  if(!s){console.error('  (skip, no path data):',name);continue;}
  const h=fnv1a(s);
  if(map[h]){console.error('COLLISION',h,map[h],name);process.exit(1);}
  map[h]=name;
}
console.log(JSON.stringify(map,null,2));
console.error('unique hashes:',Object.keys(map).length);
