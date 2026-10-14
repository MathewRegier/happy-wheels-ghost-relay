(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./factory-model.js'):root.HWFactoryModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.HWTycoonArt=api;})(typeof window==='object'?window:globalThis,(model)=>{
 'use strict';
 const machineKinds=['droppers','processors','conveyors','collectors'];
 const appearance=(project,e)=>e.appearance||(project.settings.visuals==='machines'?'machine':'label');
 function placements(project){project=model.worldProject(project);const groups=new Map();for(const kind of machineKinds)for(const e of project[kind]){if(appearance(project,e)!=='machine')continue;const key=JSON.stringify([kind,e.x,e.y,e.width,e.height,e.color,!!e.buildOnEnable]);if(groups.has(key))groups.get(key).ids.push(e.id);else groups.set(key,{kind,e,ids:[e.id]});}return [...groups.values()];}
 function parts(kind,e){
  if(Array.isArray(e.parts)&&e.parts.length)return e.parts.map(p=>({key:p.key,type:p.type==='ellipse'||p.type==='circle'?'ellipse':'box',x:e.x+p.dx,y:e.y+p.dy,width:p.width,height:p.height,color:p.color??0x527a88,solid:!!p.solid,rotation:p.rotation||0,opacity:p.opacity??100}));
  const out=[],x=e.x,y=e.y,w=e.width||84,h=e.height||80,steel=e.color??0x527a88,dark=0x203540,gold=0xf4c65a;
  const rect=(key,dx,dy,width,height,color,solid=false,rotation=0)=>out.push({key,type:'box',x:x+dx,y:y+dy,width,height,color,solid,rotation});
  const oval=(key,dx,dy,size,color)=>out.push({key,type:'ellipse',x:x+dx,y:y+dy,width:size,height:size,color,solid:false});
  if(kind==='conveyors'){
   const deck=h/2-10;rect('deck',0,deck,w,12,dark,true);rect('rubber',0,deck-2,w,8,0x344953);
   for(let i=0,n=Math.max(2,Math.min(24,Math.ceil(w/44)));i<n;i++){const dx=-w/2+12+(w-24)*i/(n-1);oval('roller-'+i,dx,deck+3,16,steel);oval('hub-'+i,dx,deck+3,5,gold);}
   for(const [i,dx]of [-w/2+22,w/2-22].entries()){rect('leg-'+i,dx,deck+20,10,32,steel);rect('foot-'+i,dx,deck+35,34,8,dark);}
  }else if(kind==='processors'&&e.mode==='gate'){
   rect('value-screen',0,0,w,h,steel);out.at(-1).opacity=32;
   rect('screen-cap',0,-h/2,w+14,8,steel);rect('screen-foot',0,h/2,w+14,8,steel);
   rect('screen-edge',-w/2,0,6,h,steel);rect('screen-edge2',w/2,0,6,h,steel);
   for(const dy of [-h/4,h/4]){rect('arrow-up-'+dy,-8,dy,6,24,gold,false,45);rect('arrow-down-'+dy,8,dy,6,24,gold,false,-45);}
  }else if(kind==='processors'){
   rect('base',0,h/2-5,w+16,12,dark,true);rect('left',-w/2+4,-10,12,h+28,steel);rect('right',w/2-4,-10,12,h+28,steel);
   rect('beam',0,-h/2-16,w+24,24,dark,true);rect('motor',0,-h/2-42,52,32,steel);rect('ram',0,-h/2+3,12,34,0xafc5c9);
   rect('jaw',0,-h/2+22,Math.max(20,w-32),18,gold);for(let i=0;i<5;i++)rect('stripe-'+i,-w/2+24+i*(w-48)/4,-h/2+22,6,16,dark,false,-20);
   oval('light',w/2-8,-h/2-16,10,gold);
   if(e.style==='furnace'){rect('oven',0,0,w-28,h-68,0x754738);rect('oven-mouth',0,12,w-56,Math.max(24,h-120),dark);rect('heat',0,22,w-76,28,0xf28246);rect('chimney',w/2-35,-h/2-50,26,64,dark);}
   if(e.style==='buffer'||e.mode==='buffer'){rect('buffer-back',0,8,w-28,h-70,0x65858d);for(let i=0;i<3;i++){rect('shelf-'+i,0,-h/2+65+i*(h-90)/3,w-36,9,dark);rect('stored-'+i,-w/4,-h/2+48+i*(h-90)/3,24,24,gold);}rect('buffer-lip',0,h/2-20,w-24,18,steel);}
   if(e.style==='sorter'||e.mode==='sorter'){rect('sorter-case',0,10,w-28,h-80,0x596e91);rect('sorter-route',0,12,w-44,14,gold,false,-20);rect('sorter-left',-w/2+25,h/2-35,38,24,0xe78265);rect('sorter-right',w/2-25,h/2-35,38,24,0x76be93);oval('sensor',0,-h/2+65,24,0xafc5c9);}

  }else if(kind==='droppers'){
   rect('bin',0,-62,80,50,steel);rect('rim',0,-88,90,10,dark);rect('opening',0,-37,40,12,dark);rect('outlet',0,-26,30,16,gold);
   rect('stand',-36,-16,8,36,dark);rect('stand2',36,-16,8,36,dark);oval('dial',24,-64,16,gold);
   const tier=Math.min(3,Math.max(0,Math.round(Math.log2(2/(e.interval||2)))));for(let i=0;i<tier;i++){rect('speed-fin-'+i,-24+i*18,-78,10,28,[0x54b9e8,0x70d6a0,0xee7366][i]);}
   if(tier>1)rect('turbo-unit',-54,-62,22,36,0x54b9e8);if(tier>2)rect('turbo-unit2',54,-62,22,36,0xee7366);
  }else if(kind==='purchases'){
   oval('upgrade-base',0,0,44,dark);oval('upgrade-face',0,0,34,steel);
   rect('upgrade-stem',0,0,5,20,gold);rect('upgrade-left',-5,-6,5,14,gold,false,45);rect('upgrade-right',5,-6,5,14,gold,false,-45);
   rect('upgrade-post',0,30,6,22,dark);rect('upgrade-foot',0,42,38,6,dark);
  }else if(kind==='collectors'){
   rect('bin',0,h/2-25,w-12,48,steel);rect('rim',0,h/2-50,w+4,10,gold);rect('slot',0,h/2-52,w-24,6,dark);
   rect('post',w/2-10,-20,8,60,dark);rect('sign',w/2-10,-54,44,34,0x5eac77);oval('coin',w/2-10,-54,22,gold);
  }
  return out;
 }
 const hex=n=>'#'+n.toString(16).padStart(6,'0');
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 function shapeSVG(p){return p.type==='ellipse'?`<ellipse cx="${p.x}" cy="${p.y}" rx="${p.width/2}" ry="${p.height/2}" fill="${hex(p.color)}" opacity="${(p.opacity??100)/100}"/>`:`<rect x="${p.x-p.width/2}" y="${p.y-p.height/2}" width="${p.width}" height="${p.height}" fill="${hex(p.color)}" opacity="${(p.opacity??100)/100}" ${p.rotation?`transform="rotate(${p.rotation} ${p.x} ${p.y})"`:''}/>`;}
 function icon(type){const paths={belt:'<rect x="3" y="10" width="26" height="10" rx="5"/><circle cx="8" cy="15" r="2"/><circle cx="24" cy="15" r="2"/><path d="M11 25V20M21 25V20M12 6H24M21 3L24 6L21 9"/>',crusher:'<path d="M5 28V6H27V28M8 26H24M16 6V14M9 15H23V20H9Z"/><path d="M12 20V23M20 20V23"/>',dropper:'<path d="M4 4H28L23 17H9ZM12 17V22H20V17M7 28H12M21 28H26"/><rect x="14" y="25" width="5" height="5"/>',sell:'<path d="M3 12H29L25 28H7ZM7 8H25"/><circle cx="16" cy="7" r="5"/><path d="M16 4V10M14 5H18M14 9H18"/>',upgrade:'<path d="M4 21L16 8L28 21M16 8V29M9 4H23"/>'};return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round">${paths[type]||paths.upgrade}</svg>`;}
 function iconFor(p){return p.icon||(p.actions.some(a=>a.target&&/belt|conveyor/.test(a.target))?'belt':p.actions.some(a=>a.target&&/crusher|process/.test(a.target))?'crusher':'upgrade');}
 function svg(project){project=model.worldProject(project);
  const all=sceneParts(project);
  const xs=all.flatMap(e=>[model.bounds(e).left,model.bounds(e).right]).concat(project.purchases.flatMap(e=>[e.x-110,e.x+110]),[0,900]),ys=all.flatMap(e=>[model.bounds(e).top,model.bounds(e).bottom]).concat(project.purchases.flatMap(e=>[e.y-50,e.y+50]),[0,500]);
  const x=Math.min(...xs)-30,y=Math.min(...ys)-30,w=Math.max(...xs)-x+30,h=Math.max(...ys)-y+30;
  const buttons=project.purchases.map(e=>`<g transform="translate(${e.x-82} ${e.y-30})"><rect width="164" height="60" rx="8" fill="#f4c65a" stroke="#203540" stroke-width="3"/><text x="82" y="23" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#203540">${esc(e.name||e.id)}</text><text x="82" y="45" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#203540">$${e.price.toLocaleString()} · ${e.interaction==='zone'?'WALK TO BUY':'CLICK TO BUY'}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="1400" height="${Math.round(1400*h/w)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e3ece5"/>${all.map(shapeSVG).join('')}${buttons}</svg>`;
 }
 function drawNative(g,entries){for(const p of entries){g.beginFill(p.color??0x527a88,(p.opacity??100)/100);if(p.type==='ellipse')g.drawCircle(p.x,p.y,p.width/2);else if(p.rotation){const angle=p.rotation*Math.PI/180,points=[[-p.width/2,-p.height/2],[p.width/2,-p.height/2],[p.width/2,p.height/2],[-p.width/2,p.height/2]];points.forEach(([x,y],i)=>{const px=p.x+x*Math.cos(angle)-y*Math.sin(angle),py=p.y+x*Math.sin(angle)+y*Math.cos(angle);i?g.lineTo(px,py):g.moveTo(px,py);});g.lineTo(p.x+points[0][0]*Math.cos(angle)-points[0][1]*Math.sin(angle),p.y+points[0][0]*Math.sin(angle)+points[0][1]*Math.cos(angle));}else g.drawRect(p.x-p.width/2,p.y-p.height/2,p.width,p.height);g.endFill();}}
 function sceneParts(project,{floor,ghost=false}={}){const w=model.worldProject(project),out=[];for(const e of w.objects)if(e.type!=='text'&&(!floor||e.floor===floor||!e.floor))out.push({...e,alpha:e.visible===false?0.2:1});for(const {kind,e}of placements(w))if(!floor||e.floor===floor)for(const p of parts(kind,e))out.push({...p,alpha:(ghost?0.25:1)*(p.opacity??100)/100});for(const e of w.purchases)if(!floor||e.floor===floor)out.push(...parts('purchases',e).map(p=>({...p,alpha:1})));return out;}
 function sceneBounds(project){const entries=sceneParts(project),w=model.worldProject(project),boxes=entries.map(model.bounds).concat(w.purchases.map(e=>model.bounds({...e,width:180,height:90})));if(!boxes.length)return {left:0,top:0,right:900,bottom:500,width:900,height:500};const left=Math.min(...boxes.map(b=>b.left))-50,top=Math.min(...boxes.map(b=>b.top))-50,right=Math.max(...boxes.map(b=>b.right))+50,bottom=Math.max(...boxes.map(b=>b.bottom))+50;return {left,top,right,bottom,width:right-left,height:bottom-top};}
 function drawCanvas(ctx,project,{floor,selected=[],links=false}={}){const w=model.worldProject(project);for(const p of sceneParts(w,{floor})){ctx.save();ctx.globalAlpha=p.alpha;ctx.fillStyle=hex(p.color??0x527a88);ctx.translate(p.x,p.y);ctx.rotate((p.rotation||0)*Math.PI/180);if(p.type==='ellipse'){ctx.beginPath();ctx.ellipse(0,0,p.width/2,p.height/2,0,0,Math.PI*2);ctx.fill();}else ctx.fillRect(-p.width/2,-p.height/2,p.width,p.height);ctx.restore();}

  if(links){ctx.strokeStyle='#d67f55';ctx.setLineDash([12,8]);ctx.lineWidth=3;for(const l of w.links||[]){const a=model.all(w).find(r=>r.entity.id===l.from)?.entity,b=model.all(w).find(r=>r.entity.id===l.to)?.entity;if(a?.x!=null&&b?.x!=null){ctx.beginPath();ctx.moveTo(a.outputX??a.x,a.outputY??a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}ctx.setLineDash([]);}
  ctx.strokeStyle='#e77950';ctx.lineWidth=3;for(const id of selected){const e=model.all(w).find(r=>r.entity.id===id)?.entity;if(e?.x!=null){const b=model.bounds(e);ctx.strokeRect(b.left-4,b.top-4,b.width+8,b.height+8);}}
 }
 function create(session,lab,project){
  project=model.worldProject(project);let Sprite;try{Sprite=(lab.require||globalThis.HWGhost?.require)?.(4971)?.kx;}catch{}if(!Sprite||!session.containerSprite?.addChild)return null;
  const machines=placements(project),view=new Sprite(),statics=[];view.name='jhw-tycoon-machines';view.__hwLocalOnly=true;session.containerSprite.addChild(view);let cached='';
  if(project.settings.artwork==='compact')for(const m of machines){const node=new Sprite();node.name='jhw-factory-'+m.e.id;node.__hwLocalOnly=true;drawNative(node.graphics,parts(m.kind,m.e).filter(p=>!p.solid));session.containerSprite.addChild(node);statics.push({node,m});}
  return {update(state){if(!state)return;for(const {node,m}of statics){const updates=state.runtimeProperties||{},signature=JSON.stringify(Object.entries(updates).filter(([id])=>id.startsWith(m.e.id+':')).concat([['machine',state.overrides?.[m.e.id]||{}]]));if(node.__studioSignature!==signature){node.__studioSignature=signature;node.graphics.clear();drawNative(node.graphics,parts(m.kind,{...m.e,...state.overrides?.[m.e.id]}).filter(p=>!p.solid).map(p=>({...p,...updates[m.e.id+':'+p.key]})));}const built=m.ids.some(id=>(state.built?.[id]??state.enabled[id])!==false)&&(!m.e.floor||state.floorState?.[m.e.floor]!==false);node.visible=built;node.alpha=built?Math.min(1,0.25+Math.max(0,state.clock-(state.builtAt?.[m.e.id]??-10))*2):0;}
   const phase=Math.floor(state.clock*12),key=phase+':'+state.revision;if(key===cached)return;cached=key;const g=view.graphics;g.clear();const screen=session.camera?.screenBounds;
   const L=globalThis.HWSceneLogic||(typeof module==='object'&&module.exports?require('./scene-logic.js'):null),markers=new Map();for(const p of project.purchases){if(p.interaction!=='click')continue;if(L&&!L.availability(project,state,p.id).visible)continue;const level=state.levels[p.id]||0,owned=level>=(p.tiers?.length||p.maxLevel||1);if(p.floor&&state.floorState?.[p.floor]===false||owned&&p.hideOwned!==false)continue;const key=p.x+':'+p.y,locked=(p.requires||[]).some(id=>!state.levels[id])||L?.availability(project,state,p.id).available===false,prior=markers.get(key);if(!prior||prior.locked&&!locked)markers.set(key,{p,locked});}
   for(const {p,locked}of markers.values())drawNative(g,parts('purchases',{...p,color:locked?0x77858a:state.clock<(state.cooldowns?.[p.id]||0)?0xf4c65a:(L?.availability(project,state,p.id).balance??state.money)>=(state.purchasePrices?.[p.id]??p.price)?0x70d6a0:0x54b9e8}));
   for(const {kind:k,e,ids}of machines){if(screen&&(e.x<screen.x-200||e.x>screen.x+screen.width+200||e.y<screen.y-450||e.y>screen.y+screen.height+200))continue;const built=ids.some(id=>(state.built?.[id]??(!e.buildOnEnable||state.enabled[id]))!==false)&&(!e.floor||state.floorState?.[e.floor]!==false);if(!built)continue;const enabled=ids.some(id=>state.enabled[id]!==false),blocked=ids.some(id=>/full|blocked/.test(state.machineStatus?.[id]||''));g.beginFill(blocked?0xef9b63:enabled?0x76dc99:0x77858a);g.drawCircle(e.x+(e.width||80)/2-10,e.y-(e.height||80)/2-16,5);g.endFill();
    if(k==='conveyors'&&enabled){const speed=state.overrides?.[e.id]?.speedX??e.speedX,shift=((state.clock*speed)%28+28)%28,top=e.y+e.height/2-14;g.lineStyle(2,0x92b3bc,0.7);for(let x=e.x-e.width/2+shift;x<e.x+e.width/2-8;x+=28){g.moveTo(x,top);g.lineTo(x+7,top+5);}g.lineStyle(0,0);}
    if(k==='processors'&&enabled&&(!e.style||e.style==='press')){const item=state.items.find(i=>ids.includes(i.machine)&&i.status==='processing');if(item){const recipe=project.processors.find(p=>p.id===item.machine);if(!recipe)continue;const seconds=state.overrides?.[item.machine]?.seconds??recipe.seconds,t=Math.max(0,Math.min(1,1-(item.readyAt-state.clock)/seconds)),down=Math.sin(t*Math.PI)*Math.min(40,Math.max(0,e.height-232));g.beginFill(0x9fb9c0);g.drawRect(e.x-6,e.y-e.height/2,12,down+16);g.endFill();g.beginFill(0xf4c65a);g.drawRect(e.x-e.width/2+16,e.y-e.height/2+18+down,e.width-32,16);g.endFill();}}
   }
  },stop(){for(const {node}of statics){node.parent?.removeChild?.(node);node.destroy?.();}view.parent?.removeChild?.(view);view.destroy?.();}};
 }
 return {machineKinds,appearance,placements,parts,icon,iconFor,svg,create,drawNative,drawCanvas,sceneParts,sceneBounds};
});
