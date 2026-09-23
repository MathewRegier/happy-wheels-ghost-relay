(() => {
  'use strict';
  const lab = window.HWGhost = {version:'0.1.0', require:null, errors:[],levelHash:null};
  const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
  let generation=0;
  XMLHttpRequest.prototype.open = function(method,url,...args) {
    this.ghostLevelURL = new URL(url,location.href);
    return open.call(this,method,url,...args);
  };
  XMLHttpRequest.prototype.send = function(body) {
    const url=this.ghostLevelURL;
    const params=new URLSearchParams(typeof body==='string'?body:body instanceof URLSearchParams?body.toString():url?.search);
    if(url?.pathname==='/get_level.hw'&&['get_level','get_record'].includes(params.get('action'))&&/^[1-9][0-9]{0,8}$/.test(params.get('level_id')||'')){
      const level=params.get('level_id');
      if(params.get('action')==='get_level'){
        ++generation;lab.download={level,loading:true,hash:null};lab.levelHash=null;lab.pendingHash=null;
        return send.call(this,body);
      }
      if(lab.download?.level!==level)return send.call(this,body);
      const ticket=generation;
      // get_level is mutable listing metadata; get_record carries the level geometry.

      this.addEventListener('load',()=>{
        const pending=(async()=>{
          try{
            if(this.status!==200)throw Error('Level download failed');
            const response=this.response;
            const data=response instanceof Blob?await response.arrayBuffer():response instanceof ArrayBuffer?response:typeof response==='string'?new TextEncoder().encode(response):null;
            if(!data)throw Error('Unsupported level response');
            const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
            if(ticket===generation){lab.levelHash=hash;lab.download={level,hash,loading:false};}
            return hash;
          }catch(e){if(ticket===generation){lab.download={level,loading:false,hash:null};lab.errors.push('Level fingerprint unavailable');}return null;}
        })();
        if(ticket===generation)lab.pendingHash=pending;
      },{once:true});
      const failed=()=>{if(ticket===generation)lab.download={level,loading:false,hash:null};};
      this.addEventListener('error',failed,{once:true});this.addEventListener('abort',failed,{once:true});
    }
    return send.call(this,body);
  };
  if(typeof fetch==='function'){
    const origFetch=fetch;
    window.fetch=function(input,init){
      const url=new URL(typeof input==='string'?input:input.url,location.href);
      const body=init?.body;
      const params=new URLSearchParams(typeof body==='string'?body:body instanceof URLSearchParams?body.toString():url.search);
      const track=url.pathname==='/get_level.hw'&&['get_level','get_record'].includes(params.get('action'))&&/^[1-9][0-9]{0,8}$/.test(params.get('level_id')||'');
      const level=params.get('level_id');
      if(track&&params.get('action')==='get_level'){
        ++generation;lab.download={level,loading:true,hash:null};lab.levelHash=null;lab.pendingHash=null;
      }
      const ticket=generation;
      const req=origFetch.apply(this,arguments);
      if(track&&params.get('action')==='get_record'&&lab.download?.level===level){
        const pending=req.then(async res=>{
          try{
            const copy=res.clone();
            const data=await copy.arrayBuffer();
            const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
            if(ticket===generation){lab.levelHash=hash;lab.download={level,hash,loading:false};}
            return hash;
          }catch(e){if(ticket===generation){lab.download={level,loading:false,hash:null};lab.errors.push('Level fingerprint unavailable');}return null;}
        });
        lab.pendingHash=pending;
      }
      return req;
    };
  }
  function chunkQueue(){
    for(const key of Object.keys(window)){
      if(/^Tmu[A-Za-z0-9]+0$/.test(key)&&Array.isArray(window[key]))return window[key];
    }
    window.Tmuddaafe0=window.Tmuddaafe0||[];
    return window.Tmuddaafe0;
  }
  function attachState(require){
    lab.require=require;
    const tryIds=[35057,29552];
    const grab=()=>{
      for(const id of tryIds){
        try{
          const w=require(id)?.w;
          if(w&&(w.rootApp||'currentSession' in w||w.totalCharacters!=null)){lab.state=w;return true;}
        }catch{}
      }
      return false;
    };
    if(!grab()){
      const wait=setInterval(()=>{if(grab())clearInterval(wait);},100);
      setTimeout(()=>clearInterval(wait),30000);
    }
  }
  const poll = setInterval(() => {
    const chunks=chunkQueue();
    if (chunks.push === Array.prototype.push) return;
    clearInterval(poll);
    chunks.push([['ghost-lab'], {}, require => attachState(require)]);
  }, 250);
})();
