(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./factory-model.js'):root.HWFactoryModel,typeof module==='object'&&module.exports?require('./factory-engine.js'):root.HWFactoryEngine);if(typeof module==='object'&&module.exports)module.exports=api;else root.HWTycoonCore=api;})(typeof window==='object'?window:globalThis,(model,factoryEngine)=>{
  'use strict';
  const FORMAT='jimbob-level',VERSION=1,MAX_MONEY=1e12;
  const collections=['objects','resources','droppers','processors','conveyors','collectors','purchases','triggers','variables','displays','groups',...Object.keys(model.extensions)];
  const types=['platform','box','ellipse','triangle','text'];
  const events=['player-enter','object-enter','timer','purchase','sold','processed','death'];
  const actions=['add-money','set-variable','add-variable','enable','show','spawn','message','finish','set-machine',...model.featureActions];
  const identifier=s=>typeof s==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(s)&&!['__proto__','constructor','prototype'].includes(s);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const inside=(r,p)=>!!p&&p.x>=r.x-r.width/2&&p.x<=r.x+r.width/2&&p.y>=r.y-r.height/2&&p.y<=r.y+r.height/2;
  function schema(){const value={
    format:FORMAT,version:VERSION,coordinates:'Pixels; centres for objects and zones; positive Y points down. Rotation is degrees.',
    limits:{entities:512,items:128,variables:64,actionsPerTick:128,projectBytes:262144},
    project:{id:'identifier',name:'1–80 characters',spawn:{x:'number',y:'number',character:'1–11',hideVehicle:'boolean'},tycoon:{enabled:'boolean',startingMoney:'integer >= 0',persist:'boolean',maxItems:'1–128',goalMoney:'integer >= 0'},settings:{starts:'[{x,y,facing:right|left,character?:1–11}]',wait:'2–15',camera:'optional {x,y,width:200–20000}',visuals:'machines|zones (legacy default zones)'},editor:'optional Level Editor extras: joints, triggers, spikes, items, groups and shapes that are not production objects'},
    collections:{
      objects:{id:'identifier',type:types,x:'number',y:'number',width:'1–20000',height:'1–20000',rotation:'degrees (default 0)',fixed:'boolean (default true)',color:'0–16777215',visible:'boolean',text:'text only; <= 500 characters'},
      resources:{id:'identifier',name:'label',value:'positive integer',color:'0–16777215',size:'8–96 pixels (default 24)'},
      droppers:{id:'identifier',appearance:'machine|label|none (overrides settings.visuals)',color:'optional 0–16777215',resource:'resource ID',x:'number',y:'number',interval:'0.1–300 seconds',enabled:'boolean (default true)',buildOnEnable:'boolean (hide artwork and collisions until enabled)'},
      processors:{id:'identifier',appearance:'machine|label|none (overrides settings.visuals)',color:'optional 0–16777215',x:'number',y:'number',width:'number',height:'number',input:'resource ID',output:'resource ID',seconds:'0.1–300',multiplier:'0.1–100 (default 1)',outputX:'number',outputY:'number',enabled:'boolean',buildOnEnable:'boolean (hide artwork and collisions until enabled)'},
      conveyors:{id:'identifier',appearance:'machine|label|none (overrides settings.visuals)',color:'optional 0–16777215',x:'number',y:'number',width:'number',height:'number',speedX:'pixels/sec',speedY:'pixels/sec',enabled:'boolean',buildOnEnable:'boolean (hide artwork and collisions until enabled)'},
      collectors:{id:'identifier',appearance:'machine|label|none (overrides settings.visuals)',color:'optional 0–16777215',x:'number',y:'number',width:'number',height:'number',resource:'optional resource ID',multiplier:'0.1–100 (default 1)',enabled:'boolean',buildOnEnable:'boolean (hide artwork and collisions until enabled)'},
      purchases:{id:'identifier',name:'label',interaction:'click|zone (legacy default zone)',icon:'belt|crusher|dropper|sell|upgrade',x:'number',y:'number',width:'number',height:'number',price:'integer >= 0',requires:'purchase IDs',maxLevel:'1–100 (default 1)',priceGrowth:'1–100 (default 1)',actions:'action array'},
      triggers:{id:'identifier',event:events,source:'optional purchase/machine ID',resource:'optional resource ID',x:'region events only',y:'region events only',width:'region events only',height:'region events only',interval:'timer only, seconds',once:'boolean',conditions:'[{variable,op:eq|ne|gte|lte,value}]',actions:'action array'},
      variables:{id:'identifier',type:['number','boolean','string'],initial:'value matching type'},
      displays:{id:'identifier',label:'label',variable:'optional variable ID; absent = money'},
      groups:{id:'identifier',members:'object or spatial entity IDs'},
    },
    actions:{'add-money':'{type,amount:integer}','set-variable':'{type,target:variableID,value}','add-variable':'{type,target:numberVariableID,amount:number}',enable:'{type,target:machineID,value:boolean}',show:'{type,target:objectID,value:boolean}',spawn:'{type,resource:resourceID,x,y}',message:'{type,text:<=200}',finish:'{type}', 'set-machine':'{type,target:machineID,property:interval|seconds|multiplier|speedX|speedY|capacity|quota,value:number}'},
    notes:['Machine artwork minimum: conveyors 50x32, processors/collectors 60x60 pixels; appearance:none allows smaller custom zones.','Only declarative actions; no JavaScript/eval.','Shared Physics uses a shared cooperative wallet controlled by the host.','Physical materials use a bounded pool of native rectangular bodies.','CLI simulations test rules and approximated conveyor transport, not character jump reachability.']
  };value.limits=model.limits;for(const [k,fields]of Object.entries(model.extraFields))Object.assign(value.collections[k],fields);Object.assign(value.collections,model.extensions);Object.assign(value.actions,{'scene-action':'{type,target:sceneObjectID,operation,name?,property?,value?}',build:'{type,target:machineID,value:boolean}', 'unlock-floor':'{type,target:floorID,value:boolean}',boost:'{type,target:machineID,factor,duration,cooldown,property}', 'adjust-machine':'{type,target,property,operation:add|multiply,value}'});Object.assign(value.project.tycoon,{itemLifetime:'seconds'});Object.assign(value.project.settings,{artwork:'native|compact',cameraMode:'follow|floor|fixed',audio:'boolean'});value.project.save={id:'stable save ID',version:'positive integer'};return value;}
  function validateUnsafe(p){
    const errors=[],warnings=[];const err=(path,message)=>errors.push({path,message});
    if(!p||typeof p!=='object'||Array.isArray(p))return {ok:false,errors:[{path:'$',message:'Expected a project object'}],warnings};
    const encoded=JSON.stringify({...p,nativeXml:undefined,editor:undefined});
    if(encoded.length>262144)err('$','Project exceeds 256 KB');
    if(p.nativeXml!=null&&(typeof p.nativeXml!=='string'||p.nativeXml.length>16*1024*1024))err('nativeXml','Native base must be XML up to 16 MB');
    if(/"(?:__proto__|constructor|prototype)"\s*:/.test(encoded))err('$','Unsafe property name');
    if(p.format!==FORMAT||p.version!==VERSION)err('version','Unsupported project format/version');
    if(!identifier(p.id))err('id','Use a stable identifier');
    if(typeof p.name!=='string'||!p.name.trim()||p.name.length>80)err('name','Use a name of 1–80 characters');
    const number=(v,path,min=-1e5,max=1e5,integer=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||integer&&!Number.isSafeInteger(v))err(path,`Expected ${integer?'integer':'number'} between ${min} and ${max}`);};
    const bool=(v,path)=>{if(typeof v!=='boolean')err(path,'Expected a boolean');};
    const spatial=(e,path,zone=true)=>{number(e.x,path+'.x');number(e.y,path+'.y');if(zone){number(e.width,path+'.width',1,20000);number(e.height,path+'.height',1,20000);}};
    if(!p.spawn)err('spawn','Spawn is required');else{spatial(p.spawn,'spawn',false);number(p.spawn.character,'spawn.character',1,11,true);bool(p.spawn.hideVehicle,'spawn.hideVehicle');}
    if(!p.tycoon)err('tycoon','Tycoon settings are required');else{bool(p.tycoon.enabled,'tycoon.enabled');bool(p.tycoon.persist,'tycoon.persist');number(p.tycoon.maxItems,'tycoon.maxItems',1,128,true);number(p.tycoon.startingMoney,'tycoon.startingMoney',0,MAX_MONEY,true);number(p.tycoon.goalMoney,'tycoon.goalMoney',0,MAX_MONEY,true);}
    const known=(value,allowed,path)=>{if(value&&typeof value==='object')for(const key of Object.keys(value))if(!allowed.includes(key))err(path+'.'+key,'Unsupported field');};
    known(p,['format','version','id','name','spawn','tycoon','settings','nativeXml','editor','save',...collections],'$');
    known(p.spawn,['x','y','character','hideVehicle'],'spawn');known(p.tycoon,['enabled','startingMoney','persist','maxItems','goalMoney','itemLifetime'],'tycoon');known(p.settings,['wait','starts','camera','visuals','artwork','cameraMode','audio','supportedRiders'],'settings');
    const definitions=schema().collections;
    const all=new Map(),kind=new Map();let count=0;
    for(const collection of collections){
      if(!Array.isArray(p[collection])){if(!Object.hasOwn(model.extensions,collection))err(collection,'Expected an array');continue;}
      count+=p[collection].length;
      for(const e of p[collection]){if(!e||typeof e!=='object'||Array.isArray(e)){err(collection,'Expected entity objects');continue;}if(!identifier(e.id))err(collection+'.id','Invalid identifier');else if(all.has(e.id))err(e.id,'Duplicate entity ID');else{all.set(e.id,e);kind.set(e.id,collection);}}
    }
    if(count>512)err('$','Maximum 512 entities');if((p.variables||[]).length>64)err('variables','Maximum 64 variables');
    const ref=(id,allowed,path)=>{if(!all.has(id)||!allowed.includes(kind.get(id)))err(path,'Missing or incompatible referenced ID: '+String(id));};
    const machineKinds=['droppers','processors','conveyors','collectors'];
    function validActions(list,path){
      if(!Array.isArray(list)||list.length>32){err(path,'Use at most 32 actions');return;}
      for(const [i,a]of list.entries()){
        const q=path+'['+i+']';if(!a||!actions.includes(a.type)){err(q,'Unsupported action');continue;}
        known(a,['type',...({'add-money':['amount'],'set-variable':['target','value'],'add-variable':['target','amount'],enable:['target','value'],show:['target','value'],spawn:['resource','x','y'],message:['text'],finish:[],'set-machine':['target','property','value'],build:['target','value'],'unlock-floor':['target','value'],boost:['target','factor','duration','cooldown','property'],'adjust-machine':['target','property','operation','value'],'scene-action':['target','operation','name','property','value']}[a.type]||[])],q);
        if(a.type==='scene-action'){try{const D=typeof module==='object'&&module.exports?require('./scene-data.js'):globalThis.HWSceneData,rows=new Map((p.editor?.scene?.objects||[]).map(o=>[o.id,o]));const o=rows.get(a.target);if(!o)throw Error('Missing scene action target');D.validateAction(o,{type:a.operation,target:a.target,name:a.name,property:a.property,value:a.value},rows);}catch(e){err(q,e.message);}}if(a.type==='add-money')number(a.amount,q+'.amount',-MAX_MONEY,MAX_MONEY,true);
        if(['set-variable','add-variable'].includes(a.type)){
          ref(a.target,['variables'],q+'.target');const v=all.get(a.target);
          if(a.type==='set-variable'&&v&&(typeof a.value!==v.type||v.type==='number'&&(!Number.isFinite(a.value)||Math.abs(a.value)>MAX_MONEY)||v.type==='string'&&a.value.length>200))err(q+'.value','Value does not match variable type or bound');
          if(a.type==='add-variable'){number(a.amount,q+'.amount',-MAX_MONEY,MAX_MONEY);if(v?.type!=='number')err(q+'.target','Requires a number variable');}
        }
        if(['enable','show'].includes(a.type)){ref(a.target,a.type==='show'?['objects']:machineKinds,q+'.target');bool(a.value,q+'.value');}
        if(a.type==='build'){ref(a.target,machineKinds,q+'.target');bool(a.value,q+'.value');}
        if(a.type==='unlock-floor'){ref(a.target,['floors'],q+'.target');bool(a.value,q+'.value');}
        if(a.type==='boost'){ref(a.target,machineKinds,q+'.target');number(a.factor,q+'.factor',1,10);number(a.duration,q+'.duration',1,300);if(a.cooldown!=null)number(a.cooldown,q+'.cooldown',1,3600);const available={droppers:['interval'],processors:['seconds','multiplier'],conveyors:['speedX','speedY'],collectors:['multiplier']}[kind.get(a.target)]||[];if(a.property!=null&&!available.includes(a.property))err(q+'.property','Boost property does not belong to this machine');}
        if(a.type==='spawn'){ref(a.resource,['resources'],q+'.resource');spatial(a,q,false);}
        if(a.type==='message'&&(typeof a.text!=='string'||a.text.length>200))err(q+'.text','Use a message of at most 200 characters');
        if(['set-machine','adjust-machine'].includes(a.type)){
          ref(a.target,machineKinds,q+'.target');const allowed={droppers:['interval','quota'],processors:['seconds','multiplier','capacity'],conveyors:['speedX','speedY'],collectors:['multiplier']}[kind.get(a.target)]||[];
          if(!allowed.includes(a.property))err(q+'.property','Unsupported machine property');
          const range=['speedX','speedY'].includes(a.property)?[-2000,2000]:a.property==='multiplier'?[0.1,100]:a.property==='capacity'?[1,32]:a.property==='quota'?[1,128]:[0.1,300];if(a.type==='adjust-machine'){if(!['add','multiply'].includes(a.operation))err(q+'.operation','Use add or multiply');number(a.value,q+'.value',-2000,2000);}else {number(a.value,q+'.value',...range);if(['capacity','quota'].includes(a.property)&&!Number.isSafeInteger(a.value))err(q+'.value','Capacity and quota need whole numbers');}
        }
      }
    }
    for(const [id,e]of all){const k=kind.get(id);known(e,Object.keys(definitions[k]),id);
      if(['objects','processors','conveyors','collectors','purchases'].includes(k))spatial(e,id);
      if(k==='objects'&&e.type!=='text'&&!e.floor){const angle=(e.rotation||0)*Math.PI/180,halfX=(Math.abs(Math.cos(angle))*e.width+Math.abs(Math.sin(angle))*e.height)/2,halfY=(Math.abs(Math.sin(angle))*e.width+Math.abs(Math.cos(angle))*e.height)/2;if(e.x+1e-6<halfX||e.y+1e-6<halfY)err(id,'Native shapes must fit inside positive map coordinates; move this shape right/down');}
      if(k==='objects'){if(!types.includes(e.type))err(id+'.type','Unsupported native object type');if(e.rotation!=null)number(e.rotation,id+'.rotation',-36000,36000);if(e.fixed!=null)bool(e.fixed,id+'.fixed');if(e.visible!=null)bool(e.visible,id+'.visible');if(e.color!=null)number(e.color,id+'.color',0,0xffffff,true);if(e.type==='text'&&(typeof e.text!=='string'||e.text.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(e.text)))err(id+'.text','Invalid text');}
      if(['resources','purchases'].includes(k)&&e.name!=null&&(typeof e.name!=='string'||e.name.length>80))err(id+'.name','Use a label up to 80 characters');
      if(k==='resources'){number(e.value,id+'.value',1,MAX_MONEY,true);number(e.color,id+'.color',0,0xffffff,true);if(e.size!=null)number(e.size,id+'.size',8,96);}
      if(machineKinds.includes(k)){const look=e.appearance||(p.settings?.visuals==='machines'?'machine':'label');if(look==='machine'&&k!=='droppers'){const min=k==='conveyors'?[50,32]:[60,60];if(e.width<min[0]||e.height<min[1])err(id+'.appearance','Machine artwork needs at least '+min[0]+' × '+min[1]+' pixels; use appearance:none for smaller detection zones');}if(e.enabled!=null)bool(e.enabled,id+'.enabled');if(e.buildOnEnable!=null)bool(e.buildOnEnable,id+'.buildOnEnable');if(e.appearance!=null&&!['machine','label','none'].includes(e.appearance))err(id+'.appearance','Use machine, label or none');if(e.color!=null)number(e.color,id+'.color',0,0xffffff,true);}
      if(k==='droppers'){ref(e.resource,['resources'],id+'.resource');spatial(e,id,false);number(e.interval,id+'.interval',0.1,300);}
      if(k==='processors'){ref(e.input,['resources'],id+'.input');ref(e.output,['resources'],id+'.output');number(e.seconds,id+'.seconds',0.1,300);number(e.outputX,id+'.outputX');number(e.outputY,id+'.outputY');if(e.input===e.output&&e.mode!=='gate')warnings.push({path:id,message:'Input and output match; each item processes only once in this machine'});}
      if(['processors','collectors'].includes(k)&&e.multiplier!=null)number(e.multiplier,id+'.multiplier',0.1,100);
      if(k==='conveyors'){number(e.speedX,id+'.speedX',-2000,2000);number(e.speedY,id+'.speedY',-2000,2000);}
      if(k==='collectors'&&e.resource)ref(e.resource,['resources'],id+'.resource');
      if(k==='purchases'){
        if(e.interaction!=null&&!['click','zone'].includes(e.interaction))err(id+'.interaction','Use click or zone');if(e.icon!=null&&!['belt','crusher','dropper','sell','upgrade'].includes(e.icon))err(id+'.icon','Unsupported upgrade icon');
        if(e.tiers){if(!Array.isArray(e.tiers)||!e.tiers.length||e.tiers.length>100)err(id+'.tiers','Use 1–100 tiers');else for(const [i,tier]of e.tiers.entries()){number(tier.price,id+'.tiers['+i+'].price',0,MAX_MONEY,true);validActions(tier.actions,id+'.tiers['+i+'].actions');}}
        number(e.price,id+'.price',0,MAX_MONEY,true);if(e.maxLevel!=null)number(e.maxLevel,id+'.maxLevel',1,100,true);if(e.priceGrowth!=null)number(e.priceGrowth,id+'.priceGrowth',1,100);
        if(e.requires!=null&&(!Array.isArray(e.requires)||e.requires.length>32))err(id+'.requires','Use up to 32 purchase IDs');else for(const r of e.requires||[])ref(r,['purchases'],id+'.requires');validActions(e.actions,id+'.actions');
      }
      if(k==='triggers'){
        if(!events.includes(e.event))err(id+'.event','Unsupported event');if(['player-enter','object-enter'].includes(e.event))spatial(e,id);if(e.event==='timer')number(e.interval,id+'.interval',0.1,300);if(e.once!=null)bool(e.once,id+'.once');
        if(e.source)ref(e.source,machineKinds.concat('purchases'),id+'.source');if(e.resource)ref(e.resource,['resources'],id+'.resource');
        if(e.conditions!=null&&(!Array.isArray(e.conditions)||e.conditions.length>16))err(id+'.conditions','Use up to 16 conditions');else for(const c of e.conditions||[]){ref(c.variable,['variables'],id+'.condition');if(!['eq','ne','gte','lte'].includes(c.op))err(id+'.condition','Unsupported comparison');const v=all.get(c.variable);if(typeof c.value==='number'&&!Number.isFinite(c.value)||typeof c.value==='string'&&c.value.length>200)err(id+'.condition','Invalid comparison value');if(v&&(typeof c.value!==v.type||['gte','lte'].includes(c.op)&&v.type!=='number'))err(id+'.condition','Comparison type mismatch');}
        validActions(e.actions,id+'.actions');
      }
      if(k==='variables'){if(!['number','boolean','string'].includes(e.type)||typeof e.initial!==e.type)err(id,'Variable initial value/type mismatch');else if(e.type==='number')number(e.initial,id+'.initial',-MAX_MONEY,MAX_MONEY);else if(e.type==='string'&&e.initial.length>200)err(id,'String exceeds 200 characters');}
      if(k==='displays'){if(typeof e.label!=='string'||e.label.length>60)err(id+'.label','Use a label up to 60 characters');if(e.variable)ref(e.variable,['variables'],id+'.variable');}
      if(k==='groups'){if(!Array.isArray(e.members)||e.members.length>256)err(id+'.members','Use at most 256 members');else for(const member of e.members)ref(member,['objects','droppers','processors','conveyors','collectors','purchases','triggers'],id+'.members');}
    }
    const visiting=new Set(),visited=new Set();
    function cycle(id){if(visiting.has(id)){err(id+'.requires','Cyclic purchase dependency');return;}if(visited.has(id))return;visiting.add(id);for(const r of Array.isArray(all.get(id)?.requires)?all.get(id).requires:[])cycle(r);visiting.delete(id);visited.add(id);}
    for(const e of p.purchases||[])if(e?.id)cycle(e.id);
    const s=p.settings;if(!s||typeof s!=='object')err('settings','Settings are required');else{
      number(s.wait,'settings.wait',2,15,true);if(s.visuals!=null&&!['machines','zones'].includes(s.visuals))err('settings.visuals','Use machines or zones');
      if(!Array.isArray(s.starts)||s.starts.length<1||s.starts.length>16)err('settings.starts','Use 1–16 spawns');else s.starts.forEach((v,i)=>{known(v,['x','y','facing','character'],'settings.starts['+i+']');spatial(v,'settings.starts['+i+']',false);if(!['right','left'].includes(v.facing))err('settings.starts['+i+']','Invalid facing');if(v.character!=null)number(v.character,'settings.starts['+i+'].character',1,11,true);});
      if(p.editor!=null){if(!p.editor||typeof p.editor!=='object'||Array.isArray(p.editor))err('editor','Expected Level Editor extras');else{known(p.editor,['pieces','scene','projectId','assets','prefabs','mode','generated'],'editor');if(!Array.isArray(p.editor.pieces)||p.editor.pieces.length>4000)err('editor.pieces','Use at most 4000 Level Editor objects');else{if(JSON.stringify(p.editor).length>4*1024*1024)err('editor','Level Editor extras exceed 4 MB');for(const piece of p.editor.pieces){if(!piece||typeof piece!=='object'||Array.isArray(piece)||typeof piece.id!=='string'||piece.id.length>80)err('editor.pieces','Each Level Editor object needs an id');if(piece.kind&&!['shape','text','trigger','spikes','item','joint','group','folder','script','texture','native','camera','region'].includes(piece.kind))err(piece.id,'Unsupported Level Editor object');}}}}
      if(s.camera){known(s.camera,['x','y','width'],'settings.camera');spatial(s.camera,'settings.camera',false);number(s.camera.width,'settings.camera.width',200,20000);}
    }
    try{const scene=typeof module==='object'&&module.exports?require('./scene-data.js'):globalThis.HWSceneData;scene?.validateScene(p.editor?.scene);}catch(e){err('editor.scene',e.message);}model.validate(p,err);return {ok:!errors.length,errors,warnings};
  }
  function validate(p){try{return validateUnsafe(p);}catch(error){return {ok:false,errors:[{path:'$',message:'Malformed project: '+error.message}],warnings:[]};}}
  function assertProject(p){const r=validate(p);if(!r.ok)throw Error(r.errors.map(e=>e.path+': '+e.message).join('\n'));return p;}
  function blank(id='my-tycoon',name='My Tycoon'){
    return {format:FORMAT,version:VERSION,id,name,spawn:{x:120,y:640,character:2,hideVehicle:false},tycoon:{enabled:true,startingMoney:0,persist:true,maxItems:32,goalMoney:0},settings:{wait:3,starts:[{x:120,y:640,facing:'right'},{x:260,y:640,facing:'right'}]},...Object.fromEntries(collections.map(k=>[k,[]]))};
  }
  function junkyard(){
    const p=blank('junkyard-empire','Jimbob’s Junkyard Tycoon');p.tycoon.goalMoney=1000;p.settings.visuals='machines';p.settings.camera={x:900,y:545,width:1900};
    p.objects=[{id:'floor',type:'platform',x:1200,y:740,width:2400,height:40,color:0x394c56},{id:'gate',type:'platform',x:1550,y:630,width:25,height:180,color:0xb86053},{id:'instructions',type:'text',x:160,y:260,width:500,height:100,text:'JUNKYARD EMPIRE\nClick FREE Dropper and FREE Conveyor. Sell scrap, then buy the Crusher for more valuable blocks.',color:0xf4ecd9}];
    p.resources=[{id:'scrap',name:'Scrap',value:5,size:24,color:0x9aa6ab},{id:'metal',name:'Processed metal',value:12,size:24,color:0xf2c965},{id:'rare',name:'Engine scrap',value:30,size:48,color:0xf17f73}];
    p.droppers=[{id:'scrap-drop',resource:'scrap',x:400,y:685,interval:2,enabled:false,buildOnEnable:true},{id:'engine-drop',resource:'rare',x:400,y:685,interval:8,enabled:false,buildOnEnable:true}];
    p.processors=[{id:'crusher',x:750,y:575,width:200,height:310,input:'scrap',output:'metal',seconds:2,outputX:860,outputY:685,enabled:false,buildOnEnable:true},{id:'big-crusher',x:750,y:575,width:200,height:310,input:'rare',output:'metal',multiplier:5,seconds:3,outputX:860,outputY:685,enabled:false,buildOnEnable:true}];
    p.conveyors=[{id:'belt',x:850,y:695,width:1080,height:65,speedX:140,speedY:0,enabled:false,buildOnEnable:true}];
    p.collectors=[{id:'sell',x:1380,y:680,width:140,height:100,enabled:true}];
    p.purchases=[
      {id:'buy-dropper',interaction:'click',icon:'dropper',name:'FREE Dropper',x:400,y:330,width:140,height:120,price:0,actions:[{type:'enable',target:'scrap-drop',value:true},{type:'message',text:'Dropper built. Buy the free conveyor to carry scrap to the selling bin.'}]},
      {id:'buy-belt',interaction:'click',icon:'belt',name:'FREE Conveyor',x:1000,y:330,width:140,height:120,price:0,actions:[{type:'enable',target:'belt',value:true},{type:'message',text:'Conveyor running! Scrap now travels automatically.'}]},
      {id:'buy-fast',interaction:'click',icon:'crusher',name:'Crusher · $5 → $12 blocks',x:870,y:330,width:140,height:120,price:96,requires:['buy-dropper','buy-belt'],actions:[{type:'enable',target:'crusher',value:true},{type:'message',text:'Crusher built: scrap now becomes metal worth $12 instead of $5.'}]},
      {id:'buy-engine',interaction:'click',icon:'dropper',name:'Big scrap + new yard',x:1440,y:330,width:150,height:120,price:240,requires:['buy-fast'],actions:[{type:'enable',target:'engine-drop',value:true},{type:'enable',target:'big-crusher',value:true},{type:'show',target:'gate',value:false}]},
    ];
    p.variables=[{id:'processed-count',type:'number',initial:0}];p.triggers=[{id:'count-metal',event:'processed',actions:[{type:'add-variable',target:'processed-count',amount:1}]}];p.displays=[{id:'metal-counter',label:'Processed',variable:'processed-count'}];
    return assertProject(p);
  }
  const safeScripts=typeof module==='object'&&module.exports?require('./script-runtime.js'):globalThis.HWScriptRuntime;
  const scriptCollections=['droppers','processors','conveyors','collectors','purchases','objects','resources','floors'];
  const scriptKinds={droppers:'dropper',processors:'press',conveyors:'belt',collectors:'seller',purchases:'button'};
  const scriptLimits={interval:[0.1,300],seconds:[0.1,300],multiplier:[0.1,100],speedX:[-2000,2000],speedY:[-2000,2000],price:[0,MAX_MONEY],quota:[1,128],capacity:[1,32]};
  function bindScript(engine,entity,object,source){
    object.message=text=>engine.message(text);
    const script={Parent:object,Name:'Script',Source:source};
    object.script=script;
    return {object,script};
  }
  function scriptObject(engine,collection,entity,source){
    const text=source==null?entity.script:source;
    if(collection==='floors'){const object={id:entity.id,name:entity.name||entity.id,kind:'floor'};Object.defineProperty(object,'unlocked',{enumerable:true,get(){return entity.unlocked!==false;},set(value){entity.unlocked=!!value;}});return bindScript(engine,entity,object,text);}
    if(collection==='objects'||collection==='resources'){
      const object={id:entity.id,name:entity.name||entity.id,kind:collection==='resources'?'material':'object'};
      Object.defineProperty(object,'visible',{enumerable:true,get(){return engine.visible[entity.id]!==false;},set(value){engine.visible[entity.id]=!!value;engine.adapter.show?.(entity.id,!!value);}});
      for(const key of collection==='resources'?['color','value','size']:['color','width','height']){const range=key==='color'?[0,16777215]:key==='value'?[1,1e12]:key==='size'?[8,96]:[4,20000];
        Object.defineProperty(object,key,{enumerable:true,get(){return entity[key];},set(value){const n=Number(value);if(!Number.isFinite(n)||n<range[0]||n>range[1])throw Error(key+' is out of range for this object');entity[key]=['color','value','size'].includes(key)?Math.round(n):n;}});}
      return bindScript(engine,entity,object,text);
    }
    const object={id:entity.id,name:entity.name||entity.id,kind:scriptKinds[collection]};
    const fields={dropper:['interval','quota'],press:['seconds','multiplier','capacity'],belt:['speedX','speedY'],seller:['multiplier'],button:['price']}[object.kind]||[];
    Object.defineProperty(object,'enabled',{enumerable:true,get(){return engine.enabled[entity.id]!==false;},set(value){engine.enabled[entity.id]=!!value;}});
    Object.defineProperty(object,'built',{enumerable:true,get(){return engine.built?engine.built[entity.id]!==false:true;}});
    for(const key of fields){const range=scriptLimits[key];
      Object.defineProperty(object,key,{enumerable:true,get(){return typeof engine.effective==='function'?engine.effective(entity,key):entity[key];},set(value){const n=Number(value);if(!Number.isFinite(n)||n<range[0]||n>range[1])throw Error(key+' is out of range for this object');entity[key]=['price','quota','capacity'].includes(key)?Math.round(n):n;if(engine.overrides&&key!=='price')(engine.overrides[entity.id]||={})[key]=entity[key];}});
    }
    object.drop=()=>engine.spawn(entity.resource,entity.x,entity.y,entity.id);
    return bindScript(engine,entity,object,text);
  }
  function compileScript(){throw Error('Legacy unrestricted script execution is disabled');}
  function pieceScriptObject(engine,collection,entity,piece){
    const machine=scriptObject(engine,collection,entity,piece.source).object;
    const object={name:piece.host.key||piece.name||'Part',key:piece.host.key||'',Parent:machine};
    object.message=text=>engine.message(text);
    const script={Parent:object,Name:piece.name||'Script',Source:piece.source};
    object.script=script;
    return {object,script};
  }
  class Engine{
    constructor(project,adapter={},saved=null){
      this.project=clone(assertProject(project));this.adapter=adapter;this.byId=new Map(collections.flatMap(k=>(this.project[k]||[]).map(e=>[e.id,e])));this.machineIds=new Set(['droppers','processors','conveyors','collectors'].flatMap(k=>this.project[k].map(e=>e.id)));this.clock=0;this.revision=0;this.money=project.tycoon.startingMoney;this.earnings=0;this.deaths=0;this.sold=0;this.finished=false;this.items=new Map();this.levels={};this.variables=Object.fromEntries(project.variables.map(v=>[v.id,v.initial]));this.enabled={};this.visible={};this.overrides={};this.times={};this.visits=new Map();this.fired=new Set();this.dead=new Set();this.queue=[];this.logs=[];this.budget=128;
      for(const id of this.machineIds)this.enabled[id]=this.byId.get(id).enabled!==false;this.scriptHost=new Map();
      for(const e of project.objects.concat((project.editor?.pieces||[]).filter(e=>['shape','text','native'].includes(e.kind))))this.visible[e.id]=e.visible!==false;
      if(saved)this.restore(saved);this.applyEnvironment();
    }
    changed(){this.revision++;}
    message(text){this.logs.push(String(text).slice(0,200));if(this.logs.length>8)this.logs.shift();this.changed();this.adapter.message?.(text);}
    applyEnvironment(){for(const [id,value]of Object.entries(this.visible))this.adapter.show?.(id,value);}
    price(p){return Math.min(MAX_MONEY,Math.round(p.price*Math.pow(p.priceGrowth||1,this.levels[p.id]||0)));}
    buy(id){const p=this.byId.get(id);if(!this.project.purchases.some(e=>e.id===id)||this.finished)return {ok:false,reason:'Unknown purchase or finished game'};const level=this.levels[id]||0;if(level>=(p.maxLevel||1))return {ok:false,reason:'Already owned'};if((p.requires||[]).some(r=>!this.levels[r]))return {ok:false,reason:'Buy the prerequisite upgrade first'};const cost=this.price(p);if(this.money<cost)return {ok:false,reason:'Not enough money'};if(this.budget<p.actions.length+1)return {ok:false,reason:'Action budget reached'};this.money-=cost;this.levels[id]=level+1;this.act(p.actions);this.changed();this.event('purchase',{source:id});this.message('Bought '+(p.name||p.id)+' · $'+cost);this.runScriptEvent(id,'onPurchase');return {ok:true,cost,level:level+1};}
    spawn(resource,x,y){
      if(this.items.size>=this.project.tycoon.maxItems||!this.project.resources.some(r=>r.id===resource))return null;
      let slot=0;while(this.items.has(slot))slot++;const r=this.byId.get(resource),item={slot,resource,x,y,value:r.value,age:0,status:'live',processed:[]};this.items.set(slot,item);this.adapter.spawn?.(clone(item),r);this.changed();return item;
    }
    remove(item){this.adapter.remove?.(item.slot);this.items.delete(item.slot);for(const [key,set]of this.visits)if(key.startsWith('object:'))set.delete(String(item.slot));this.changed();}
    condition(c){const v=this.variables[c.variable];return c.op==='eq'?v===c.value:c.op==='ne'?v!==c.value:c.op==='gte'?v>=c.value:v<=c.value;}
    event(event,data={}){this.queue.push({event,...data});}
    dispatch(){
      while(this.queue.length&&this.budget>0){const event=this.queue.shift();for(const t of this.project.triggers){if(t.event!==event.event||t.source&&t.source!==event.source||t.resource&&t.resource!==event.resource||t.once&&this.fired.has(t.id)||!(t.conditions||[]).every(c=>this.condition(c)))continue;if(this.budget<t.actions.length+1)break;this.budget--;this.act(t.actions);if(t.once){this.fired.add(t.id);this.changed();}}}
      if(this.queue.length){this.queue.length=0;this.message('Rule action budget reached; remaining events skipped.');}
    }
    act(list,environmentOnly=false){for(const a of list){if(!environmentOnly&&this.budget--<=0)break;if(environmentOnly&&!['enable','show','set-machine'].includes(a.type))continue;
      if(a.type==='add-money'){this.money=Math.max(0,Math.min(MAX_MONEY,this.money+a.amount));if(a.amount>0)this.earnings=Math.min(MAX_MONEY,this.earnings+a.amount);}
      else if(a.type==='set-variable')this.variables[a.target]=a.value;
      else if(a.type==='add-variable')this.variables[a.target]=Math.max(-MAX_MONEY,Math.min(MAX_MONEY,this.variables[a.target]+a.amount));
      else if(a.type==='enable')this.enabled[a.target]=a.value;
      else if(a.type==='show'){this.visible[a.target]=a.value;this.adapter.show?.(a.target,a.value);}
      else if(['set-machine','adjust-machine'].includes(a.type)){this.byId.get(a.target)[a.property]=a.value;(this.overrides[a.target]||=Object.create(null))[a.property]=a.value;}
      else if(a.type==='spawn')this.spawn(a.resource,a.x,a.y);
      else if(a.type==='message')this.message(a.text);
      else if(a.type==='finish')this.finish();this.changed();
    }}
    enter(key,id,yes){let set=this.visits.get(key);if(!set){set=new Set();this.visits.set(key,set);}if(!yes){set.delete(id);return false;}if(set.has(id))return false;set.add(id);return true;}
    finish(){if(this.finished)return;this.finished=true;this.changed();this.adapter.finish?.();}
    step(dt,players=[]){
      if(!Number.isFinite(dt)||dt<=0||dt>0.25)throw Error('Use a rule step of 0–0.25 seconds');this.budget=128;if(this.finished||!this.project.tycoon.enabled)return;this.clock+=dt;
      const livePlayerIds=new Set(players.map(p=>p.id));for(const [key,set]of this.visits)if(key.startsWith('player:'))for(const id of set)if(!livePlayerIds.has(id))set.delete(id);
      for(const player of players){if(player.dead){if(!this.dead.has(player.id)){this.deaths++;this.changed();this.event('death',{player:player.id});this.dead.add(player.id);}continue;}this.dead.delete(player.id);
        for(const p of this.project.purchases){if(p.interaction==='click')continue;const yes=inside(p,player);const entered=this.enter('player:'+p.id,player.id,yes);if(yes&&(entered||this.clock>=(this.times['buy:'+p.id+':'+player.id]||0))){this.times['buy:'+p.id+':'+player.id]=this.clock+1;this.buy(p.id);}}
        for(const t of this.project.triggers)if(t.event==='player-enter'&&this.enter('player:'+t.id,player.id,inside(t,player)))this.fireRegion(t,{player:player.id});
      }
      for(const d of this.project.droppers)if(this.enabled[d.id]&&this.clock>=(this.times[d.id]||0)){this.spawn(d.resource,d.x,d.y);this.times[d.id]=this.clock+d.interval;}
      for(const item of [...this.items.values()]){
        item.age+=dt;if(item.age>180){this.remove(item);continue;}
        if(item.status==='processing'){
          if(this.clock<item.readyAt)continue;const m=this.byId.get(item.machine),r=this.byId.get(m.output);item.resource=m.output;item.value=Math.min(MAX_MONEY,Math.max(1,Math.round(r.value*(m.multiplier||1))));item.x=m.outputX;item.y=m.outputY;item.status='live';item.processed.push(m.id);delete item.readyAt;delete item.machine;this.adapter.spawn?.(clone(item),r);this.event('processed',{source:m.id,resource:item.resource});this.changed();
        }
        const point=this.adapter.position?.(item.slot);if(point&&Number.isFinite(point.x)&&Number.isFinite(point.y)){item.x=point.x;item.y=point.y;}
        if(Math.abs(item.x)>1e5||Math.abs(item.y)>1e5){this.remove(item);continue;}
        for(const c of this.project.conveyors)if(this.enabled[c.id]&&inside(c,item))this.adapter.velocity?.(item.slot,c.speedX,c.speedY,dt);
        let handled=false;
        for(const c of this.project.collectors)if(this.enabled[c.id]&&inside(c,item)&&(!c.resource||c.resource===item.resource)){const value=Math.min(MAX_MONEY,Math.round(item.value*(c.multiplier||1)));this.money=Math.min(MAX_MONEY,this.money+value);this.earnings=Math.min(MAX_MONEY,this.earnings+value);this.sold++;this.event('sold',{source:c.id,resource:item.resource});this.remove(item);handled=true;break;}
        if(handled)continue;
        for(const m of this.project.processors)if(this.enabled[m.id]&&item.resource===m.input&&!item.processed.includes(m.id)&&inside(m,item)&&![...this.items.values()].some(i=>i.machine===m.id)){item.status='processing';item.machine=m.id;item.readyAt=this.clock+m.seconds;this.adapter.remove?.(item.slot);this.changed();break;}
        for(const t of this.project.triggers)if(t.event==='object-enter'&&this.enter('object:'+t.id,String(item.slot),inside(t,item))&&(!t.resource||t.resource===item.resource))this.fireRegion(t,{resource:item.resource});
      }
      for(const t of this.project.triggers)if(t.event==='timer'&&this.clock>=(this.times[t.id]??t.interval)){this.times[t.id]=this.clock+t.interval;this.fireRegion(t,{});}
      this.dispatch();if(this.project.tycoon.goalMoney>0&&this.earnings>=this.project.tycoon.goalMoney)this.finish();this.runScripts(dt);
    }
    scriptRecord(id){for(const collection of scriptCollections){const entity=(this.project[collection]||[]).find(item=>item.id===id);if(entity)return {collection,entity};}return null;}
    ensureScript(id){const record=this.scriptRecord(id);if(!record||typeof record.entity.script!=='string'||!record.entity.script.trim())return null;let host=this.scriptHost.get(id);if(!host||host.source!==record.entity.script){host=compileScript(this,record.collection,record.entity);this.scriptHost.set(id,host);if(host.error)this.message(host.name+' script: '+host.error);}return host;}
    runScriptEvent(id,name){this.scriptRuntime||=new safeScripts.Driver(this);this.scriptRuntime.event(id,name);if(!globalThis.document)this.scriptRuntime.step(0);}
    runScripts(dt){this.scriptRuntime||=new safeScripts.Driver(this);this.scriptRuntime.step(dt);}
    stopScripts(){this.scriptRuntime?.stop();this.scriptRuntime=null;}
    fireRegion(t,data){if(t.once&&this.fired.has(t.id)||!(t.conditions||[]).every(c=>this.condition(c)))return;if(this.budget<t.actions.length+1)return;this.budget--;this.act(t.actions);if(t.once){this.fired.add(t.id);this.changed();}}
    progress(){return {version:1,id:this.project.id,money:this.money,earnings:this.earnings,deaths:this.deaths,sold:this.sold,levels:clone(this.levels),variables:clone(this.variables),fired:[...this.fired],enabled:clone(this.enabled),visible:clone(this.visible),overrides:clone(this.overrides)};}
    restore(s){
      if(!s||s.version!==1||s.id!==this.project.id)throw Error('Save does not match this tycoon');
      for(const key of ['money','earnings','deaths','sold'])if(!Number.isSafeInteger(s[key])||s[key]<0||s[key]>MAX_MONEY)throw Error('Invalid saved '+key);
      if(!s.levels||!s.variables||!Array.isArray(s.fired)||s.fired.some(id=>!this.project.triggers.some(t=>t.id===id)))throw Error('Invalid saved progression');
      for(const [id,n]of Object.entries(s.levels)){const p=this.project.purchases.find(p=>p.id===id);if(!p||!Number.isInteger(n)||n<0||n>(p.repeatable?1e12:p.tiers?.length||p.maxLevel||1)||(p.requires||[]).some(r=>!(s.levels[r]>0)))throw Error('Invalid saved upgrade');}
      for(const v of this.project.variables){const value=s.variables[v.id];if(typeof value!==v.type||v.type==='number'&&(!Number.isFinite(value)||Math.abs(value)>MAX_MONEY)||v.type==='string'&&value.length>200)throw Error('Invalid saved variable');}
      for(const p of this.project.purchases)for(let i=0;i<(s.levels[p.id]||0);i++)this.act(p.tiers?.[i]?.actions||p.actions,true);
      if(s.enabled){for(const id of this.machineIds){if(typeof s.enabled[id]!=='boolean')throw Error('Invalid saved machine state');this.enabled[id]=s.enabled[id];}}
      if(s.visible){for(const e of this.project.objects){if(typeof s.visible[e.id]!=='boolean')throw Error('Invalid saved visibility');this.visible[e.id]=s.visible[e.id];}}
      if(s.overrides){for(const [id,properties]of Object.entries(s.overrides))for(const [property,value]of Object.entries(properties)){const kind=['droppers','processors','conveyors','collectors'].find(k=>this.project[k].some(e=>e.id===id));const allowed={droppers:['interval','quota'],processors:['seconds','multiplier','capacity'],conveyors:['speedX','speedY'],collectors:['multiplier']}[kind]||[];const [lo,hi]=['speedX','speedY'].includes(property)?[-2000,2000]:property==='multiplier'?[0.1,100]:[0.1,300];if(!allowed.includes(property)||!Number.isFinite(value)||value<lo||value>hi)throw Error('Invalid saved machine override');this.byId.get(id)[property]=value;}this.overrides=clone(s.overrides);}
      for(const key of ['money','earnings','deaths','sold'])this[key]=s[key];this.levels=clone(s.levels);this.variables=Object.fromEntries(this.project.variables.map(v=>[v.id,s.variables[v.id]]));this.fired=new Set(s.fired);this.changed();
    }
    snapshot(){return {...this.progress(),revision:this.revision,clock:this.clock,finished:this.finished,enabled:clone(this.enabled),visible:clone(this.visible),items:[...this.items.values()].map(clone),logs:this.logs.slice()};}
  }
  return {FORMAT,VERSION,collections,types,events,actions,identifier,clone,inside,schema,validate,assertProject,blank,junkyard,Engine:factoryEngine.extend(Engine,model),model,worldProject:model.worldProject,entityWorld:model.entityWorld};
});

