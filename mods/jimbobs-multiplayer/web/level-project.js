(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./tycoon-core.js'):root.HWTycoonCore,typeof module==='object'&&module.exports?require('./tycoon-art.js'):root.HWTycoonArt);if(typeof module==='object'&&module.exports)module.exports=api;else root.HWLevelProject=api;})(typeof window==='object'?window:globalThis,(core,art)=>{
  'use strict';
  const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const unescape=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v)=>v[0]==='#'?String.fromCodePoint(v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[v.toLowerCase()]);
  const cdata=s=>'<![CDATA['+String(s).replace(/]]>/g,']]]]><![CDATA[>')+']]>';
  function xmlTree(xml){
    if(typeof xml!=='string'||xml.length>16*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Unsupported or oversized native XML');
    let root=null,stack=[],i=0;
    while(i<xml.length){
      if(xml[i]!=='<'){const end=xml.indexOf('<',i),j=end<0?xml.length:end;if(stack.length)stack.at(-1).children.push(xml.slice(i,j));else if(xml.slice(i,j).trim())throw Error('Text outside XML root');i=j;continue;}
      const start=i;
      if(xml.startsWith('<![CDATA[',i)||xml.startsWith('<!--',i)||xml.startsWith('<?',i)){
        const ending=xml.startsWith('<![CDATA[',i)?']]>':xml.startsWith('<!--',i)?'-->':'?>',end=xml.indexOf(ending,i+2);if(end<0)throw Error('Unclosed XML block');i=end+ending.length;if(stack.length)stack.at(-1).children.push(xml.slice(start,i));continue;
      }
      let quote='';for(i++;i<xml.length;i++){const ch=xml[i];if(quote){if(ch===quote)quote='';}else if(ch==='"'||ch==="'")quote=ch;else if(ch==='>')break;}if(i>=xml.length)throw Error('Unclosed XML tag');const token=xml.slice(start,++i);
      if(token.startsWith('</')){const tag=token.slice(2,-1).trim(),node=stack.pop();if(!node||node.tag!==tag)throw Error('Mismatched XML closing tag');node.raw=xml.slice(node.start,i);continue;}
      const match=/^<([\w:-]+)([\s\S]*?)(\/?)>$/.exec(token);if(!match)throw Error('Unsupported XML tag');const attrs={};let rest=match[2];
      while(rest.trim()){
        const a=/^\s+([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(rest);if(!a)throw Error('Invalid XML attribute');if(Object.hasOwn(attrs,a[1])||['__proto__','constructor','prototype'].includes(a[1]))throw Error('Invalid XML attribute name');attrs[a[1]]=unescape(a[2]??a[3]);rest=rest.slice(a[0].length);
      }
      const node={tag:match[1],attrs,children:[],start};if(stack.length)stack.at(-1).children.push(node);else if(root)throw Error('Multiple XML roots');else root=node;
      if(match[3])node.raw=token;else{if(stack.length>=100)throw Error('XML nesting limit exceeded');stack.push(node);}
    }
    if(stack.length||root?.tag!=='levelXML'||!child(root,'info'))throw Error('Expected a complete Happy Wheels levelXML with info');return root;
  }
  const child=(node,tag)=>node.children.find(n=>typeof n==='object'&&n.tag===tag);
  const nodes=(node,tag)=>node?.children.filter(n=>typeof n==='object'&&n.tag===tag)||[];
  function serialize(n){return typeof n==='string'?n:n.raw||'<'+n.tag+Object.entries(n.attrs).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+(n.children.length?'>'+n.children.map(serialize).join('')+'</'+n.tag+'>':'/>');}
  function text(n){return String(n.attrs.p7||child(n,'p7')?.children.map(v=>typeof v==='string'?v.startsWith('<![CDATA[')?v.slice(9,-3):unescape(v):'').join('')||'').replace(/\r\n?/g,'\n');}
  function caption(line,x=0,y=0,color=0x304852,fontSize=12){return {tag:'sp',attrs:{t:16,p0:x,p1:y,p2:0,p3:color,p4:2,p5:fontSize,p6:1,p8:100},children:[{tag:'p7',attrs:{},children:[cdata(line)]}]};}
  function shape(e){return {tag:'sh',attrs:{t:e.type==='triangle'?2:e.type==='ellipse'?1:0,p0:e.x,p1:e.y,p2:e.width,p3:e.height,p4:e.rotation||0,p5:e.fixed===false?'f':'t',p6:'f',p7:1,p8:e.color??0x667783,p9:-1,p10:e.visible===false?0:(e.opacity??100),p11:1},children:[]};}
  const courseMark=n=>n.tag==='sp'&&/^#jmp (start|camera|play|rider|seats|wait|goal|loops|flag|clock|retry)(?: |$)/.test(text(n));
  function canonicalSignature(value){const [tag,entries,caption]=typeof value==='string'?JSON.parse(value):value,attrs=Object.fromEntries(entries);if(tag==='sh'&&String(attrs.t)==='1'&&attrs.p12==null)attrs.p12='0';return JSON.stringify([tag,Object.entries(attrs).map(([k,v])=>{let s=String(v);if(!(tag==='sp'&&k==='p7')&&/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(s)){const n=Number(s);if(Number.isFinite(n))s=String(tag==='sh'&&/^p[0-4]$/.test(k)?Number(n.toFixed(2)):n);}return [k,s];}).sort(([a],[b])=>a.localeCompare(b)),String(caption).replace(/\r\n?/g,'\n')]);}
  const signature=n=>canonicalSignature([n.tag,Object.entries(n.attrs),text(n)]);
  function encode(value){const json=JSON.stringify(value);if(typeof Buffer!=='undefined')return Buffer.from(json).toString('base64');const bytes=new TextEncoder().encode(json);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);}
  function decode(value){value=String(value).replace(/\s/g,'');if(!/^[A-Za-z0-9+/=]{1,800000}$/.test(value))throw Error('Invalid tycoon metadata encoding');const json=typeof Buffer!=='undefined'?Buffer.from(value,'base64').toString('utf8'):new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0)));if(new TextEncoder().encode(json).length>core.model.limits.metadataBytes)throw Error('Tycoon metadata exceeds 512 KB');return JSON.parse(json);}
  function metadata(xml){
    const root=typeof xml==='string'?xmlTree(xml):xml,marks=nodes(child(root,'specials'),'sp').filter(n=>text(n).startsWith('#jtycoon '));if(!marks.length)return null;if(marks.length!==1)throw Error('A map can contain only one tycoon project marker');
    const value=text(marks[0]);if(!/^#jtycoon v[12] /.test(value))throw Error('Unsupported tycoon runtime version');const data=decode(value.slice(12));core.assertProject(data.project);if(![1,2].includes(data.version)||data.key!==key(data.project)||!data.bindings||!Array.isArray(data.bindings.pool)||data.bindings.pool.length!==(data.project.tycoon.enabled?data.project.tycoon.maxItems:0)||!Array.isArray(data.managed))throw Error('Invalid tycoon native bindings');const used=new Set();for(const binding of [...Object.values(data.bindings.objects||{}),...data.bindings.pool]){if(!binding||!Number.isSafeInteger(binding.index)||binding.index<0||used.has(binding.index)||![binding.x,binding.y,binding.width,binding.height].every(Number.isFinite)||binding.width<1||binding.height<1)throw Error('Invalid native binding');used.add(binding.index);}
    const shapeRows=nodes(child(root,'shapes'),'sh'),specialRows=nodes(child(root,'specials'),'sp'),machineIds=new Set(core.model.machineKinds.flatMap(k=>data.project[k].map(e=>e.id)));for(const machine of data.bindings.machines||[]){if(!machineIds.has(machine.id)||!Array.isArray(machine.ids)||machine.ids.some(id=>!machineIds.has(id))||!Array.isArray(machine.parts)||typeof machine.buildOnEnable!=='boolean')throw Error('Invalid machine bindings');for(const b of machine.parts){if(!b||!Number.isSafeInteger(b.index)||!shapeRows[b.index]||used.has(b.index)||![b.x,b.y,b.width,b.height].every(Number.isFinite)||typeof b.solid!=='boolean')throw Error('Invalid machine part binding');used.add(b.index);}}
    for(const [id,b]of Object.entries(data.bindings.texts||{}))if(!data.project.objects.some(e=>e.id===id&&e.type==='text')||!Number.isSafeInteger(b.index)||!specialRows[b.index]||![b.x,b.y].every(Number.isFinite)||typeof b.text!=='string')throw Error('Invalid text bindings');
    if(data.bindings.editor){const identities=new Set();for(const [id,b]of Object.entries(data.bindings.editor)){if(!id||!b||!['shapes','specials'].includes(b.section)||!Number.isSafeInteger(b.index)||b.index<0||!(b.section==='shapes'?shapeRows:specialRows)[b.index]||![b.x,b.y,b.width,b.height].every(Number.isFinite))throw Error('Invalid Studio native binding');const key=b.section+':'+b.index;if(identities.has(key)||b.section==='shapes'&&used.has(b.index))throw Error('Duplicate Studio native binding');identities.add(key);}}
    if(data.managed.length>core.model.limits.managed||data.managed.some(row=>!['shapes','specials'].includes(row.section)||typeof row.signature!=='string'||row.signature.length>4096||(row.index!=null&&(!Number.isSafeInteger(row.index)||row.index<0))||(row.key!=null&&(typeof row.key!=='string'||row.key.length>180))))throw Error('Invalid generated component manifest');return data;
  }
  function key(project){const clean=core.clone(project);delete clean.nativeXml;if(clean.editor?.scene)for(const key of ['view','grid','tool','revision','dirty','seq'])delete clean.editor.scene[key];const s=JSON.stringify(clean);let a=2166136261,b=0x12345678;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b^s.charCodeAt(i),2246822519);}return project.id+'-'+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
  function compile(project,baseXml=null){
    const scene=typeof module==='object'&&module.exports?require('./scene-data.js'):globalThis.HWSceneData;project=scene.compile(project);core.assertProject(project);const author=core.clone(project);delete author.nativeXml;const p=core.worldProject(author);
    const root=xmlTree(baseXml||project.nativeXml||'<levelXML><info v="2.01" rv="1.99.2" bg="1" bgc="16777215" e="1"/><shapes/><specials/><groups/><joints/><triggers/></levelXML>');
    const old=metadata(root),info=child(root,'info'),originalShapes=nodes(child(root,'shapes'),'sh').slice(),originalSpecials=nodes(child(root,'specials'),'sp').slice();root.raw=null;
    for(const tag of ['shapes','specials','groups','joints','triggers'])if(!child(root,tag))root.children.push({tag,attrs:{},children:[]});
    if(old){
      for(const [tag,item]of [['shapes','sh'],['specials','sp']]){const section=child(root,tag);section.raw=null;let removed=0;const wanted=old.managed.filter(m=>m.section===tag&&!m.course).map(m=>canonicalSignature(m.signature));
        section.children=section.children.filter(n=>{if(typeof n!=='object'||n.tag!==item)return true;if(tag==='specials'&&(text(n).startsWith('#jtycoon ')||courseMark(n)))return false;const i=wanted.indexOf(signature(n));if(i<0)return true;wanted.splice(i,1);removed++;return false;});
        if(wanted.length)throw Error('A generated tycoon object was changed in the native editor. Import that XML as a new base or undo that edit before reapplying the structured project.');
      }
    }
    const nativeSpecials=child(root,'specials');nativeSpecials.raw=null;nativeSpecials.children=nativeSpecials.children.filter(n=>typeof n!=='object'||!courseMark(n));
    Object.assign(info.attrs,{x:p.spawn.x,y:p.spawn.y,c:p.spawn.character,f:'f',h:p.spawn.hideVehicle?'t':'f'});info.raw=null;
    const shapes=child(root,'shapes'),specials=child(root,'specials');shapes.raw=specials.raw=null;
    const bindings={objects:{},texts:{},machines:[],pool:[]},managed=[],generated=new Map();
    function add(section,node,id){const nativeIndex=nodes(section,section.tag==='shapes'?'sh':'sp').length;section.children.push(node);const logical=id||(courseMark(node)?'course:'+text(node).split(' ').slice(0,3).join(':'):null);if(logical)generated.set(logical,node);managed.push({section:section.tag,index:nativeIndex,signature:signature(node),course:courseMark(node),...(logical?{key:logical}:{})});}
    const startIndex=nodes(shapes,'sh').length;let index=startIndex;
    for(const e of p.objects){if(e.type==='text'){add(specials,caption(e.text,e.x,e.y,e.color??0x304852,14),'object:'+e.id);bindings.texts[e.id]={index:nodes(specials,'sp').length-1,x:e.x,y:e.y,text:e.text};}else{add(shapes,shape(e),'object:'+e.id);bindings.objects[e.id]={index:index++,x:e.x,y:e.y,width:e.width,height:e.height};}}
    // Native preallocated bodies keep the original world/signature consistent on every client.
    const minX=Math.min(p.spawn.x,...p.objects.map(e=>e.x-e.width/2)),minY=Math.min(p.spawn.y,...p.objects.map(e=>e.y-e.height/2));
    for(let slot=0;slot<(p.tycoon.enabled?p.tycoon.maxItems:0);slot++){const x=Math.max(p.spawn.x,...p.objects.map(e=>e.x+e.width/2))+400+slot%16*34,y=Math.max(20,minY-400)+Math.floor(slot/16)*34;add(shapes,shape({type:'box',x,y,width:24,height:24,fixed:false,color:0xffffff}),'pool:'+slot);bindings.pool.push({index:index++,x,y,width:24,height:24});}
    p.settings.starts.forEach((s,i)=>add(specials,caption('#jmp start '+(i+1)+(s.facing==='left'?' left':''),s.x,s.y)));
    if(p.settings.camera)add(specials,caption('#jmp camera fixed '+p.settings.camera.width,p.settings.camera.x,p.settings.camera.y));
    add(specials,caption('#jmp play race',p.spawn.x,p.spawn.y-160));if((p.settings.supportedRiders||[]).length<=1)add(specials,caption('#jmp rider '+p.spawn.character,p.spawn.x,p.spawn.y-180));add(specials,caption('#jmp seats '+Math.max(2,p.settings.starts.length),p.spawn.x,p.spawn.y-200));add(specials,caption('#jmp wait '+p.settings.wait,p.spawn.x,p.spawn.y-220));
    const placements=art.placements(p),physicalMachines=new Map(placements.map(m=>[m.e,m]));
    for(const [collection,label]of [['droppers','DROP'],['processors','PROCESS'],['conveyors','CONVEYOR'],['collectors','SELL']])for(const e of p[collection]){
      const look=art.appearance(p,e);if(look==='label')add(specials,caption(label,e.x,e.y-85,0x477487,12),'station:'+collection+':'+e.id);
      if(look==='machine'&&physicalMachines.has(e))for(const part of art.parts(collection,e)){if(part.x<part.width/2||part.y<part.height/2)throw Error('Machine '+e.id+' artwork extends outside positive map coordinates. Move it right/down or use appearance:none.');if(p.settings.artwork==='compact'&&!part.solid)continue;const node=shape({...part,fixed:true});if(!part.solid)node.attrs.i='f';const binding={index:nodes(shapes,'sh').length,x:part.x,y:part.y,width:part.width,height:part.height,solid:part.solid};add(shapes,node,'machine:'+e.id+':'+part.key);let machine=bindings.machines.find(m=>m.id===e.id);if(!machine){machine={id:e.id,ids:physicalMachines.get(e).ids,buildOnEnable:!!e.buildOnEnable,parts:[]};bindings.machines.push(machine);}machine.parts.push(binding);}
    }
    for(const e of p.purchases)if(e.interaction!=='click'&&!p.editor?.generated?.includes(e.id))add(specials,caption('BUY · '+(e.name||e.id)+' $'+e.price,e.x,e.y-85,0xae6953,12),'station:purchases:'+e.id);
    // Native joints and trigger targets refer to section indices, not stable IDs.
    // Preserve their meaning after moving generated components past native additions.
    function indexMap(original,final,section){
      const result=new Map(),indices=new Map(final.map((node,i)=>[node,i])),oldKeys=new Map(),records=new Map(),bySignature=new Map(),finalBySignature=new Map();
      for(const row of old?.managed||[])if(row.section===section){if(row.index!=null&&original[row.index]&&signature(original[row.index])===canonicalSignature(row.signature))records.set(row.index,row);const sig=canonicalSignature(row.signature),rows=bySignature.get(sig)||[];rows.push(row);bySignature.set(sig,rows);}
      for(const node of final){const sig=signature(node),matches=finalBySignature.get(sig)||[];matches.push(node);finalBySignature.set(sig,matches);}
      if(section==='shapes'&&old){for(const [id,b]of Object.entries(old.bindings.objects))oldKeys.set(b.index,'object:'+id);old.bindings.pool.forEach((b,i)=>oldKeys.set(b.index,'pool:'+i));}
      if(section==='specials'&&old)for(const [id,b]of Object.entries(old.bindings.texts||{}))if(b.index!=null&&original[b.index]&&text(original[b.index])===b.text&&Number(original[b.index].attrs.p0)===b.x&&Number(original[b.index].attrs.p1)===b.y)oldKeys.set(b.index,'object:'+id);
      for(const [index,node]of original.entries()){
        if(indices.has(node)){result.set(index,indices.get(node));continue;}
        const sig=signature(node),matches=bySignature.get(sig)||[],record=records.get(index)||(matches.length===1?matches[0]:null);
        let logical=oldKeys.get(index)||record?.key;
        if(!logical&&courseMark(node))logical='course:'+text(node).split(' ').slice(0,3).join(':');
        if(!logical&&section==='specials'&&old){const ids=Object.keys(old.bindings.texts||{}).filter(id=>{const b=old.bindings.texts[id];return text(node)===b.text&&Number(node.attrs.p0)===b.x&&Number(node.attrs.p1)===b.y;});if(ids.length===1)logical='object:'+ids[0];}
        const candidates=finalBySignature.get(sig)||[],replacement=logical?generated.get(logical):(candidates.length===1?candidates[0]:null);
        if(replacement&&indices.has(replacement))result.set(index,indices.get(replacement));
      }return result;
    }
    const shapeIndices=indexMap(originalShapes,nodes(shapes,'sh'),'shapes'),specialIndices=indexMap(originalSpecials,nodes(specials,'sp'),'specials');
    function remap(value,map,where){const index=Number(value);if(!map.has(index))throw Error(where+' references a removed component at index '+index+'. Remove or retarget that native reference before applying.');return String(map.get(index));}
    function editTree(node,fn){if(!node||typeof node!=='object')return false;let changed=fn(node);for(const c of node.children)if(editTree(c,fn))changed=true;if(changed)node.raw=null;return changed;}
    editTree(child(root,'joints'),node=>{let changed=false;if(node.tag==='j')for(const field of ['b1','b2']){const value=node.attrs[field];let next=value;if(/^\d+$/.test(value||''))next=remap(value,shapeIndices,'Native joint');else if(/^s\d+$/.test(value||''))next='s'+remap(value.slice(1),specialIndices,'Native joint');if(next!==value){node.attrs[field]=next;changed=true;}}return changed;});
    editTree(child(root,'triggers'),node=>{if(['sh','sp'].includes(node.tag)&&/^\d+$/.test(node.attrs.i||'')){const next=remap(node.attrs.i,node.tag==='sh'?shapeIndices:specialIndices,'Native trigger');if(next!==node.attrs.i){node.attrs.i=next;return true;}}return false;});
    const data={version:author.settings.artwork==='compact'||author.floors?.length?2:1,key:key(author),project:author,bindings,managed};const encoded=encode(data);if(encoded.length>800000)throw Error('Compiled metadata exceeds limit');specials.children.push(caption('#jtycoon v'+data.version+' '+encoded.match(/.{1,120}/g).join('\n'),p.spawn.x,p.spawn.y-300,0x304852,1));
    const xml=serialize(root);const round=metadata(xml);if(round.key!==data.key)throw Error('Compiled round-trip failed');const metrics={entities:core.model.all(author).length,shapes:nodes(shapes,'sh').length,managed:managed.length,metadataBytes:new TextEncoder().encode(JSON.stringify(data)).length,encodedBytes:encoded.length,materials:p.tycoon.maxItems};if(metrics.shapes>core.model.limits.nativeShapes)throw Error('Generated native shape limit exceeded; use compact artwork');return {xml,data,metrics,warnings:core.validate(author).warnings};
  }
  function importXML(xml){const root=xmlTree(xml),data=metadata(root);if(data)return {...core.clone(data.project),nativeXml:xml};const info=child(root,'info');const p=core.blank('imported-tycoon','Imported level');p.spawn={x:Number(info.attrs.x)||0,y:Number(info.attrs.y)||0,character:Number(info.attrs.c)||2,hideVehicle:info.attrs.h==='t'};p.settings.starts=[{x:p.spawn.x,y:p.spawn.y,facing:'right'},{x:p.spawn.x+150,y:p.spawn.y,facing:'right'}];p.nativeXml=xml;return p;}
  function patch(project,operations){
    const p=core.clone(project);if(!Array.isArray(operations)||operations.length>512)throw Error('Use at most 512 patch operations');
    for(const op of operations){
      if(op.op==='project'){if(!op.value||Object.keys(op.value).some(k=>!['name','spawn','settings','tycoon','save'].includes(k)))throw Error('Only name, spawn, settings, tycoon and save project fields can be patched');Object.assign(p,core.clone(op.value));continue;}
      if(!core.collections.includes(op.collection))throw Error('Unknown collection');const list=p[op.collection]||=[],i=list.findIndex(e=>e.id===op.id);
      if(op.op==='add'){if(!op.value)throw Error('Entity value is required');list.push(core.clone(op.value));}
      else if(i<0)throw Error('Unknown entity: '+op.id);
      else if(op.op==='set')Object.assign(list[i],core.clone(op.value));
      else if(op.op==='remove')list.splice(i,1);
      else if(op.op==='clone'&&op.collection==='groups'){const result=core.model.cloneAssembly(p,[op.id],op.newId,{dx:op.dx||0,dy:op.dy||0});const group=result.project.groups.find(g=>g.id===result.ids[op.id]);group.id=op.newId;Object.assign(p,result.project);}
      else if(op.op==='clone'){if(!core.identifier(op.newId))throw Error('New ID required');const e=core.clone(list[i]);e.id=op.newId;if(e.x!=null)e.x+=op.dx||0;if(e.y!=null)e.y+=op.dy||0;for(const key of ['outputX','alternateX'])if(e[key]!=null)e[key]+=op.dx||0;for(const key of ['outputY','alternateY'])if(e[key]!=null)e[key]+=op.dy||0;list.push(e);}
      else if(op.op==='transform'){
        const targets=op.collection==='groups'?list[i].members.map(id=>core.collections.flatMap(k=>p[k]||[]).find(e=>e.id===id)):[list[i]],angle=(op.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
        for(const e of targets){if(!e||!Number.isFinite(e.x)||!Number.isFinite(e.y))throw Error('Transform needs spatial entities');const x=e.x-(op.originX||0),y=e.y-(op.originY||0);e.x=x*c-y*s+(op.originX||0)+(op.dx||0);e.y=x*s+y*c+(op.originY||0)+(op.dy||0);for(const [px,py]of [['outputX','outputY'],['alternateX','alternateY']])if(e[px]!=null&&e[py]!=null){const vx=e[px]-(op.originX||0),vy=e[py]-(op.originY||0);e[px]=vx*c-vy*s+(op.originX||0)+(op.dx||0);e[py]=vx*s+vy*c+(op.originY||0)+(op.dy||0);}if(e.type&&e.type!=='text')e.rotation=(e.rotation||0)+(op.rotation||0);else if(op.rotation)throw Error('Axis-aligned machine zones cannot rotate; rotate their artwork separately');}
      }else throw Error('Unknown patch operation');
    }return core.assertProject(p);
  }
  return {xmlTree,serialize,metadata,compile,importXML,patch,key,encode,decode,caption,signature,text};
});
