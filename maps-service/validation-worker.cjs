'use strict';
const {isMainThread,parentPort,workerData,Worker}=require('node:worker_threads');
if(!isMainThread){
  try{const {validateXml,validatePreview}=require('./validation.cjs');parentPort.postMessage({info:validateXml(workerData.xml),preview:validatePreview(workerData.preview)});}
  catch(e){parentPort.postMessage({error:e.message,status:e.status||400});}
}else{
  module.exports=function validateUpload(xml,preview){return new Promise((resolve,reject)=>{
    const worker=new Worker(__filename,{workerData:{xml,preview},resourceLimits:{maxOldGenerationSizeMb:192,maxYoungGenerationSizeMb:32}});let done=false;
    const timer=setTimeout(()=>finish(Object.assign(Error('Map validation took too long. Simplify the map and retry.'),{status:400})),15000);timer.unref();
    function finish(error,result){if(done)return;done=true;clearTimeout(timer);worker.terminate();if(error)reject(error);else{if(result.preview)result.preview.body=Buffer.from(result.preview.body);resolve(result);}}
    worker.once('message',result=>result.error?finish(Object.assign(Error(result.error),{status:result.status})):finish(null,result));
    worker.once('error',()=>finish(Object.assign(Error('Map validation exceeded its resource limit.'),{status:400})));
    worker.once('exit',code=>{if(!done)finish(Object.assign(Error('Map validator stopped unexpectedly ('+code+').'),{status:400}));});
  });};
}
