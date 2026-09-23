(function (root) {
  'use strict';
  const VERSION = 'hw199-ghost-1';
  const finite = (x, limit=1e8) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x)<=limit;
  function validFrame(f) {
    return !!f && finite(f.t, 86400000) && f.t>=0 && Array.isArray(f.parts) && f.parts.length<=1200 &&
      f.parts.every(p=>Array.isArray(p)&&p.length===12&&p.every(x=>finite(x))&&Number.isInteger(p[0])&&p[0]>=0&&p[0]<100000&&Number.isInteger(p[1])&&p[1]>=0&&p[1]<4096&&p[8]>=0&&p[8]<=1&&Number.isInteger(p[9])&&p[9]>=0&&p[9]<=0xffffff);
  }
  function allowedTextureUrl(url) {
    return typeof url==='string' && !url.includes('..') && (
      /^assets-[a-z0-9]+\/animate\/[a-zA-Z0-9_./@-]+\.png$/.test(url) ||
      /^js\/jimbobs-custom-characters\/characters\/[a-z0-9][a-z0-9-]*\/[a-zA-Z0-9._-]+\.png$/.test(url)
    );
  }
  function publicTexturePath(raw, pageHref) {
    if(typeof raw!=='string'||!raw||raw.includes('..'))return null;
    try{
      const href=pageHref||(typeof location!=='undefined'?location.href:'https://totaljerkface.com/__hw_app__/index.html');
      const path=new URL(raw,href).pathname;
      const rel=decodeURIComponent((path.split('/__hw_app__/')[1]||path).replace(/^\//,''));
      return rel&&!rel.includes('..')?rel:null;
    }catch{return null;}
  }
  function validTexture(t) {
    return !!t && allowedTextureUrl(t.url) &&
      ['frame','orig'].every(k=>Array.isArray(t[k])&&t[k].length===4&&t[k].every(x=>finite(x,16384))) &&
      (t.trim===null || Array.isArray(t.trim)&&t.trim.length===4&&t.trim.every(x=>finite(x,16384))) &&
      Number.isInteger(t.rotate)&&t.rotate>=0&&t.rotate<=15;
  }
  function compatible(a,b) {return !!a&&!!b&&a.protocol===VERSION&&b.protocol===VERSION&&a.level===b.level&&!!a.hash&&a.hash===b.hash;}
  function interpolate(a,b,t) {
    if(!a) return b;
    if(!b || b.t<=a.t || t<=a.t) return a;
    if(t>=b.t) return b;
    const u=(t-a.t)/(b.t-a.t), other=new Map(b.parts.map(p=>[p[0],p]));
    const mix=(key,fallback=0)=>{
      const av=Number(a[key]),bv=Number(b[key]);
      if(Number.isFinite(av)&&Number.isFinite(bv))return av+(bv-av)*u;
      return Number.isFinite(bv)?bv:Number.isFinite(av)?av:fallback;
    };
    return {...a,t,progress:mix('progress'),current:mix('current'),best:mix('best'),parts:a.parts.map(p=>{
      const q=other.get(p[0]); if(!q||q[1]!==p[1])return p;
      const out=p.slice();
      // Interpolate affine transforms; appearance changes occur at their sample boundary.
      for(let i=2;i<=8;i++)out[i]=p[i]+(q[i]-p[i])*u;
      return out;
    })};
  }
  function sample(frames,t) {
    if(!frames.length)return null;
    let lo=0,hi=frames.length-1;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].t<=t)lo=mid;else hi=mid-1;}
    return interpolate(frames[lo],frames[lo+1],t);
  }
  // Play ~delay ms behind the newest arrival so live ghosts do not depend on clock sync.
  function liveSample(frames,now,lastArrival,delay=120) {
    if(!frames.length)return null;
    const newest=frames[frames.length-1];
    return sample(frames,newest.t+(now-lastArrival)-delay);
  }
  function validateRecording(r) {
    if(!r||r.meta?.protocol!==VERSION||!Array.isArray(r.textures)||r.textures.length>4096||!r.textures.every(validTexture)||!Array.isArray(r.frames)||r.frames.length>7200||!r.frames.length)throw Error('Unsupported or invalid ghost file');
    let last=-1;
    for(const f of r.frames){if(!validFrame(f)||f.t<last||f.parts.some(p=>p[1]>=r.textures.length))throw Error('Invalid ghost frame');last=f.t;}
    return r;
  }
  const api={VERSION,validFrame,validTexture,publicTexturePath,compatible,interpolate,sample,liveSample,validateRecording};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.HWGhostCore=api;
})(globalThis);
