'use strict';
const {DOMParser}=require('@xmldom/xmldom');
const {createHash}=require('node:crypto');
const course=require('../mods/jimbobs-multiplayer/web/course.js');
const MAX_XML=16*1024*1024,MAX_NODES=60000;
const hash=body=>createHash('sha256').update(body).digest('hex');
function fail(text){const error=Error(text);error.status=400;throw error;}
function validateXml(xml){
  if(typeof xml!=='string'||!xml.trim()||Buffer.byteLength(xml)>MAX_XML)fail('Use a non-empty level XML smaller than 16 MB.');
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))fail('XML document types and entities are not allowed.');
  // Bound nesting before entering the parser, including files with enormous chains of empty groups.
  let depth=0,count=0;
  for(const token of xml.matchAll(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[^]*?\?>|<[^>]*>/g)){
    const t=token[0];if(/^<!|^<\?/.test(t))continue;
    if(t.startsWith('</'))depth--;else{if(++count>MAX_NODES)fail('This map contains too many XML elements.');if(!t.endsWith('/>'))depth++;}
    if(depth>64||depth<0)fail('This map has invalid or excessive XML nesting.');
  }
  let doc;
  try{doc=new DOMParser({onError:()=>{throw Error('Invalid XML');}}).parseFromString(xml,'application/xml');}catch{fail('The level XML is malformed.');}
  const root=doc.documentElement;
  if(root?.tagName!=='levelXML')fail('Only Happy Wheels level XML is supported.');
  const children=Array.from(root.childNodes).filter(n=>n.nodeType===1);
  const info=children.find(n=>n.tagName==='info');if(!info)fail('The map has no level information.');
  for(const key of ['x','y'])if(info.hasAttribute(key)&&(!Number.isFinite(Number(info.getAttribute(key)))||Math.abs(Number(info.getAttribute(key)))>1e6))fail('Invalid map start coordinates.');
  const character=Number(info.getAttribute('c')||1);if(!Number.isInteger(character)||character<1||character>11)fail('Unsupported template character.');
  const objects={};const sections={shapes:'sh',specials:'sp',groups:'g',joints:'j',triggers:'t'};
  for(const [name,item] of Object.entries(sections))objects[name]=children.filter(n=>n.tagName===name).flatMap(n=>Array.from(n.childNodes)).filter(n=>n.nodeType===1&&n.tagName===item).length;
  const boxes=[];
  for(const node of Array.from(root.getElementsByTagName('sp'))){
    if(node.getAttribute('t')!=='16')continue;
    const text=node.getAttribute('p7')||node.getElementsByTagName('p7')[0]?.textContent||'';
    const x=Number(node.getAttribute('p0')||0),y=Number(node.getAttribute('p1')||0);
    if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e6||Math.abs(y)>1e6)fail('Invalid text-box coordinates.');
    if(text.length>32768)fail('A text box is too long.');boxes.push({text,x,y});
  }
  const compiled=course.compile(boxes);
  const rules={play:compiled.play||null,waitSec:compiled.waitSec||null,seats:compiled.seats||null,rider:compiled.rider||null,lingerMs:compiled.lingerMs||null};
  if(compiled.play==='survival'&&!compiled.starts.length)fail('Survival maps need at least one multiplayer spawn marker.');
  return {hash:hash(Buffer.from(xml,'utf8')),size:Buffer.byteLength(xml),objects,rules,character,starts:compiled.starts.length,format:'levelXML',requiredFeatures:['hosted-maps-v1'],minModVersion:'0.7.0'};
}
function validatePreview(value){
  if(value==null||value==='')return null;
  if(typeof value!=='string'||value.length>3*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value))fail('Use a PNG preview smaller than 2 MB.');
  const body=Buffer.from(value.split(',')[1],'base64');
  if(body.length>2*1024*1024||body.length<33||body.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||body.toString('ascii',12,16)!=='IHDR')fail('Invalid PNG preview.');
  const width=body.readUInt32BE(16),height=body.readUInt32BE(20);
  if(!width||!height||width>2048||height>2048)fail('Preview dimensions must be between 1 and 2048 pixels.');
  // Decode with CRC checking rather than trusting the extension or the IHDR alone.
  try{require('pngjs').PNG.sync.read(body,{checkCRC:true});}catch{fail('The PNG preview is corrupt.');}
  return {body,hash:hash(body),width,height};
}
function label(value,max,required=false){if(typeof value!=='string')value='';const text=value.replace(/[\u0000-\u001f\u007f]/g,' ').trim();if(text.length>max||required&&!text)fail('Enter a '+(required?'non-empty ':'')+'label of up to '+max+' characters.');return text;}
module.exports={validateXml,validatePreview,label,hash,MAX_XML};
