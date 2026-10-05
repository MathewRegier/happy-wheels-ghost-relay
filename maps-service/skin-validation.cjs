 'use strict';
const {PNG}=require('pngjs'),crypto=require('node:crypto');
const sizes=[[2048,1024],[2048,1024],[2048,2048],[2048,2048],[2048,2048],[2048,4096],[2048,1024],[2048,4096],[1024,2048],[2048,2048],[2048,2048]];
function fit(src,w,h){
 const out=new PNG({width:w,height:h}),scale=Math.min(w/src.width,h/src.height),dw=Math.max(1,Math.round(src.width*scale)),dh=Math.max(1,Math.round(src.height*scale)),ox=Math.floor((w-dw)/2),oy=Math.floor((h-dh)/2);
 for(let y=0;y<dh;y++){const sy=Math.min(src.height-1,Math.floor((y+.5)*src.height/dh));
  for(let x=0;x<dw;x++){const sx=Math.min(src.width-1,Math.floor((x+.5)*src.width/dw));src.data.copy(out.data,((oy+y)*w+ox+x)*4,(sy*src.width+sx)*4,(sy*src.width+sx)*4+4);}}
 return out;
}
function image(data,size,limit,fitPortrait=false){
 if(typeof data!=='string'||data.length>Math.ceil(limit*4/3)+32||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('Choose a PNG image within the upload limit.');
 const b=Buffer.from(data.slice(22),'base64');if(b.length>limit||b.length<33||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||b.toString('ascii',12,16)!=='IHDR')throw Error('Invalid PNG image.');
 const width=b.readUInt32BE(16),height=b.readUInt32BE(20);
 if(fitPortrait){if(!width||!height||width>1024||height>1024)throw Error('Portraits must be 1024 × 1024 or smaller.');}
 else if(width!==size[0]||height!==size[1])throw Error('The skin dimensions must match its template.');
 let decoded;try{decoded=PNG.sync.read(b,{checkCRC:true});}catch{throw Error('The PNG image is damaged.');}
 if(fitPortrait&&(decoded.width!==size[0]||decoded.height!==size[1]))decoded=fit(decoded,size[0],size[1]);
 return PNG.sync.write(decoded);
}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function validateSkin(input){
 if(!input||!Number.isInteger(input.base)||input.base<1||input.base>11)throw Error('Choose a supported character template.');
 const clean=(value,max,label,required=false)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value)||(required&&!value.trim()))throw Error('Invalid '+label+'.');return value.trim();};
 const name=clean(input.name,60,'skin name',true),author=clean(input.author||'Player',40,'creator name',true),description=clean(input.description||'',600,'description');
 if(!['public','unlisted'].includes(input.visibility||'public'))throw Error('Invalid visibility.');
 if(input.templateFingerprint!=null&&!/^[a-f0-9]{64}$/.test(input.templateFingerprint))throw Error('Invalid template version.');
 const sheet=image(input.sheet,sizes[input.base-1],12*1024*1024),icon=image(input.icon,[128,128],256*1024,true);
 const artRevision=crypto.createHash('sha256').update(sheet).update(icon).digest('hex');
 const pack={format:'jimbob-skin',version:2,manifest:{name,base:input.base,...(input.templateFingerprint?{templateFingerprint:input.templateFingerprint}:{}),sheet:'sheet.png',icon:'icon.png'},files:{'sheet.png':sheet.toString('base64'),'icon.png':icon.toString('base64')}};
 const bytes=Buffer.from(JSON.stringify(pack));if(bytes.length>16*1024*1024)throw Error('The skin package exceeds 16 MB.');
 return {name,author,description,templateFingerprint:input.templateFingerprint||null,base:input.base,visibility:input.visibility||'public',artRevision,hash:hash(bytes),iconHash:hash(icon),bytes,icon};
}
module.exports={validateSkin,sizes,hash};
