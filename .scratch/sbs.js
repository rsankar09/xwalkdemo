const sharp=require('sharp');
(async()=>{
  const w=+process.argv[2];
  const src=`../capture/home/screenshots/${w}.png`;
  const ours=`shots/page-${w}.png`;
  const a=await sharp(src).metadata(), b=await sharp(ours).metadata();
  const H=Math.max(a.height,b.height);
  const scale=Math.min(1, 1500/H);
  const tw=Math.round(w*scale);
  const A=await sharp(src).resize(tw).extend({bottom:Math.round((H-a.height)*scale),background:'#ddd'}).toBuffer();
  const B=await sharp(ours).resize(tw).extend({bottom:Math.round((H-b.height)*scale),background:'#ddd'}).toBuffer();
  const am=await sharp(A).metadata(), bm=await sharp(B).metadata();
  const h=Math.max(am.height,bm.height);
  await sharp({create:{width:tw*2+16,height:h,channels:3,background:'#888'}})
    .composite([{input:A,left:0,top:0},{input:B,left:tw+16,top:0}])
    .png().toFile(`/tmp/sbs-${w}.png`);
  console.log(`sbs-${w}.png  source ${a.height}px | ours ${b.height}px`);
})();
