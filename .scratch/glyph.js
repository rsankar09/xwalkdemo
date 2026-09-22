const sharp=require('sharp');
// row-darkness profile to find glyph band extents
(async()=>{
 const [file,left,top,w,h]=[process.argv[2],+process.argv[3],+process.argv[4],+process.argv[5],+process.argv[6]];
 const {data,info}=await sharp(file).extract({left,top,width:w,height:h}).greyscale().raw().toBuffer({resolveWithObject:true});
 const rows=[];
 for(let y=0;y<info.height;y++){
   let dark=0;
   for(let x=0;x<info.width;x++) if(data[y*info.width+x]<128) dark++;
   rows.push(dark);
 }
 // print contiguous runs of rows with dark pixels
 let start=null;
 rows.forEach((d,y)=>{
   if(d>0&&start===null) start=y;
   if(d===0&&start!==null){ if(y-start>4) console.log(`  glyph run rows ${top+start}..${top+y-1}  height ${y-start}`); start=null; }
 });
 if(start!==null) console.log(`  glyph run rows ${top+start}..${top+h-1}  height ${h-start}`);
})();
