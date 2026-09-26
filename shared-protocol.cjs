'use strict';
const core=require('./core.js');
const PROTOCOL='shared-authority-v3';
const DAMAGE_METHODS=new Set(['neckBreak','torsoBreak','shoulderBreak1','shoulderBreak2','elbowBreak1','elbowBreak2','hipBreak1','hipBreak2','kneeBreak1','kneeBreak2','headSmash','chestSmash','pelvisSmash','backWheelSmash','frontWheelSmash','eject','explode']);
function isDamageMethod(name){return DAMAGE_METHODS.has(name);}
const integer=(v,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const pose=p=>Array.isArray(p)&&p.length===6&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e8);
function validateInput(m){
 if(!integer(m.seq)||!integer(m.keys,255))return false;
 if(m.recover!=null&&(!Array.isArray(m.recover)||m.recover.length>16||!m.recover.every(item=>item&&typeof item.id==='string'&&item.id.length<80&&integer(item.life))))return false;
 if(m.applied==null)return true;
 if(typeof m.applied!=='object'||Array.isArray(m.applied))return false;
 return Object.entries(m.applied).every(([id,value])=>typeof id==='string'&&id.length<80&&(integer(value)||value&&integer(value.life)&&integer(value.seq)));
}
const skinId=v=>typeof v==='string'&&(v===''||/^[a-z0-9][a-z0-9-]{0,63}$/i.test(v));
function validateRequest(m){return integer(m.seq)&&integer(m.character,11)&&m.character>0&&(m.skin==null||skinId(m.skin));}
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e8;
function effectArg(a){
 if(a===null||typeof a==='boolean'||finite(a))return true;
 if(typeof a==='string')return a.length<=64&&/^[\w .:-]*$/.test(a);
 if(!a||typeof a!=='object'||Array.isArray(a))return false;
 const keys=Object.keys(a);if(keys.length!==1)return false;
 if(a.c===1)return true;
 if(a.w!=null)return integer(a.w,1000000);
 if(a.v||a.p){const p=a.v||a.p;return Array.isArray(p)&&p.length===2&&p.every(finite);}
 if(a.b)return Array.isArray(a.b)&&(a.b.length===2||a.b.length===3)&&a.b.every(s=>typeof s==='string'&&/^[\w:-]{1,80}$/.test(s));
 return false;
}
function validEffect(e){
 if(!e||typeof e!=='object'||!integer(e.seq))return false;
 if(e.kind==='emitterStop')return integer(e.emitter)&&integer(e.life);
 if(!['sound','loop','loopOp','loopVolume','particle'].includes(e.kind))return false;
 if(e.kind!=='sound'&&e.kind!=='particle'&&!integer(e.id))return false;
 if(e.kind==='loopVolume')return finite(e.volume);
 if(e.at!=null&&(!Array.isArray(e.at)||e.at.length>8||!e.at.every(row=>Array.isArray(row)&&integer(row[0],12)&&row[1]&&['x','y','a','vx','vy'].every(k=>finite(row[1][k])))))return false;
 return typeof e.method==='string'&&/^[A-Za-z]{1,40}$/.test(e.method)&&Array.isArray(e.args)&&e.args.length<=12&&e.args.every(effectArg);
}
function validateState(m,ids){
 if(m.effects!=null&&(!Array.isArray(m.effects)||m.effects.length>128||!m.effects.every(validEffect)))return false;
 if(!integer(m.revision)||!integer(m.tick)||typeof m.signature!=='string'||m.signature.length>100000||!Array.isArray(m.players)||m.players.length>16||!Array.isArray(m.world)||m.world.length>6000)return false;
 if(m.removed!=null&&(!Array.isArray(m.removed)||m.removed.length>6000||!m.removed.every(id=>integer(id,1000000))))return false;
 if(m.full!=null&&typeof m.full!=='boolean')return false;
 if(!Array.isArray(m.textures)||m.textures.length>4096||!m.textures.every(core.validTexture)||!Array.isArray(m.extras)||m.extras.length>2048)return false;
 for(const e of m.extras){if(!e||!integer(e.id,1000000)||(e.visual&&!core.validFrame(e.visual))||!Array.isArray(e.outline)||e.outline.length>64)return false;for(const shape of e.outline){const p=shape.points||shape.circle;if(!Array.isArray(p)||p.length>256||!p.every(n=>Number.isFinite(n)&&Math.abs(n)<1e8))return false;}}
 const players=new Set();
 for(const p of m.players){
  if(!p||!ids.has(p.id)||players.has(p.id)||!integer(p.character,11)||p.character<1||!integer(p.life)||!integer(p.request)||!integer(p.protectedUntil)||typeof p.dead!=='boolean'||!p.parts||Array.isArray(p.parts)||typeof p.parts!=='object')return false;
  if(p.origin!=null&&(!Array.isArray(p.origin)||p.origin.length!==2||!p.origin.every(n=>Number.isFinite(n)&&Math.abs(n)<1e8)))return false;
  if(p.skin!=null&&!skinId(p.skin))return false;
  if(p.finished!=null&&typeof p.finished!=='boolean')return false;
  if(p.finishTime!=null&&!integer(p.finishTime))return false;
  if(p.resetEvents!=null&&typeof p.resetEvents!=='boolean')return false;
  const eventBase=p.eventBase==null?0:p.eventBase;
  if(!integer(eventBase))return false;
  if(p.rebuild!=null&&!integer(p.rebuild,1000))return false;
  if(!Array.isArray(p.events)||p.events.length>48||!p.events.every((e,i)=>e&&e.seq===eventBase+i+1&&integer(e.rider,32)&&isDamageMethod(e.method)&&integer(e.seed,4294967295)&&Array.isArray(e.args)&&e.args.length<=8&&e.args.every(v=>v===null||typeof v==='boolean'||finite(v)||v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===1&&Array.isArray(v.v)&&v.v.length===2&&v.v.every(finite))))return false;
  players.add(p.id);const parts=Object.entries(p.parts);
  if(!parts.length||parts.length>256||!parts.every(([k,v])=>/^[\w:]{1,80}$/.test(k)&&pose(v)))return false;
  if(!Array.isArray(p.breaks)||p.breaks.length>128||!p.breaks.every(x=>typeof x==='string'&&/^[\w:]{1,80}$/.test(x)))return false;
  if(p.replicas!=null){
    if(!Array.isArray(p.replicas)||p.replicas.length>32)return false;
    for(const replica of p.replicas){
      if(!replica||typeof replica.key!=='string'||!/^[\w:]{1,80}$/.test(replica.key)||(replica.visual&&!core.validFrame(replica.visual))||!Array.isArray(replica.outline)||replica.outline.length>64)return false;
      for(const shape of replica.outline){const points=shape?.points||shape?.circle;if(!Array.isArray(points)||points.length>256||!points.every(n=>Number.isFinite(n)&&Math.abs(n)<1e8))return false;}
    }
  }
 }
 const bodies=new Set();for(const p of m.world){if(!Array.isArray(p)||p.length!==7||!integer(p[0],1000000)||bodies.has(p[0])||!pose(p.slice(1)))return false;bodies.add(p[0]);}
 return true;
}
module.exports={PROTOCOL,DAMAGE_METHODS,isDamageMethod,validateInput,validateRequest,validateState,pose};
