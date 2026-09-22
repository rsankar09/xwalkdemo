const path=require('path');
const s=require(path.resolve(__dirname,'../capture/home/styles.json'));
const arr = Array.isArray(s)? s : (s['1440']||Object.values(s)[0]);
const q=process.argv.slice(2).join(' ').toLowerCase();
arr.forEach(e=>{
  const hay=((e.selector_path||'')+' '+(e.classes||'')+' '+(e.text_preview||'')).toLowerCase();
  if(hay.includes(q)){
    const r=e.rect||{};
    console.log(`y=${r.y} h=${r.h} w=${r.w} | ${e.tag}.${(e.classes||'').slice(0,50)} | bg=${e.computed&&e.computed['background-color']} bgimg=${(e.computed&&e.computed['background-image']||'').slice(0,50)} color=${e.computed&&e.computed.color}`);
    console.log('   txt:', (e.text_preview||'').slice(0,100));
  }
});
