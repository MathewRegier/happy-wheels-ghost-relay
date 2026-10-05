 'use strict';
const {isMainThread,parentPort,workerData,Worker}=require('node:worker_threads');
if(!isMainThread){try{parentPort.postMessage({result:require('./skin-validation.cjs').validateSkin(workerData)});}catch(e){parentPort.postMessage({error:e.message});}}
else module.exports=input=>new Promise((resolve,reject)=>{
 const w=new Worker(__filename,{workerData:input,resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32}});
 let done=false;const end=(e,r)=>{if(done)return;done=true;clearTimeout(timer);w.terminate();e?reject(e):resolve({...r,bytes:Buffer.from(r.bytes),icon:Buffer.from(r.icon)});};
 const timer=setTimeout(()=>end(Error('Skin validation took too long. Try a smaller PNG.')),20000);
 w.once('message',m=>end(m.error?Error(m.error):null,m.result));w.once('error',()=>end(Error('The skin could not be validated.')));w.once('exit',()=>{if(!done)end(Error('Skin validation stopped.'));});
});
