'use strict';
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {randomBytes,timingSafeEqual,createHash}=require('node:crypto');
const {label,hash}=require('./validation.cjs');
const validateUpload=require('./validation-worker.cjs');
const core=require('../relay/core.js');
function error(status,message){return Object.assign(Error(message),{status});}
function uploadFailure(cause){
  const codes=new Set(),visited=new Set();
  function collect(value,depth=0){
    if(!value||typeof value!=='object'||visited.has(value)||depth>4)return;
    visited.add(value);for(const key of ['name','code'])if(typeof value[key]==='string')codes.add(value[key]);
    collect(value.cause,depth+1);if(Array.isArray(value.errors))for(const item of value.errors.slice(0,8))collect(item,depth+1);
  }
  collect(cause);const has=(...values)=>values.some(value=>codes.has(value));
  let message='Backblaze upload failed. Retry this upload.';
  if(has('EACCES','EPERM'))message='Backblaze upload was blocked by the server’s network permissions. Allow outbound HTTPS to your B2 endpoint.';
  else if(has('NoSuchBucket')||cause?.$metadata?.httpStatusCode===404)message='Backblaze could not find the configured bucket. Check B2_BUCKET and B2_ENDPOINT.';
  else if(has('InvalidAccessKeyId','SignatureDoesNotMatch','InvalidToken'))message='Backblaze rejected the application credentials. Check B2_KEY_ID, B2_APPLICATION_KEY and B2_REGION, then restart the server.';
  else if(has('AccessDenied')||cause?.$metadata?.httpStatusCode===403)message='Backblaze denied write access. Check that the application key allows this bucket, write access, and the blobs/ filename prefix.';
  else if(has('ENOTFOUND','EAI_AGAIN','ETIMEDOUT','ECONNREFUSED','ENETUNREACH','TimeoutError','AbortError'))message='The server could not reach Backblaze. Check the B2 endpoint and network connection, then retry.';
  return error(502,message+' The map was not published.');
}
function mapId(value){const id=String(value||'').replace(/^JM-/i,'').toLowerCase();if(!/^[a-f0-9]{16}$/.test(id))throw error(400,'Enter a valid JM map code.');return id;}
function createMaps({directory,storage,publishToken,author='Jimbob',publicBase='',readConcurrency=8,trustProxy=false}={}){
  if(!directory||!storage)throw Error('Maps need durable storage and a catalogue directory.');
  fs.mkdirSync(directory,{recursive:true});
  const db=new DatabaseSync(path.join(directory,'catalogue.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS maps(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,visibility TEXT NOT NULL,latest INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY AUTOINCREMENT,map_id TEXT NOT NULL REFERENCES maps(id),revision INTEGER NOT NULL,hash TEXT NOT NULL,preview TEXT,data TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(map_id,revision));
    CREATE INDEX IF NOT EXISTS maps_browse ON maps(visibility,updated DESC,id);
    CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,response TEXT NOT NULL,created INTEGER NOT NULL);`);
  let pendingPublish=0,tail=Promise.resolve(),reading=0,closed=false;
  const cache=new Map(),inflight=new Map();let cacheBytes=0;
  function remember(key,body){if(cache.has(key))return;cache.set(key,body);cacheBytes+=body.length;while(cacheBytes>64*1024*1024&&cache.size){const [first,old]=cache.entries().next().value;cache.delete(first);cacheBytes-=old.length;}}
  async function blob(key){
    if(cache.has(key)){const body=cache.get(key);cache.delete(key);cache.set(key,body);return body;}
    if(inflight.has(key))return inflight.get(key);
    if(reading>=readConcurrency)throw error(503,'Map downloads are busy. Try again shortly.');
    reading++;const task=storage.get(key).then(body=>{if(hash(body)!==key.slice(6,70))throw error(502,'Stored map verification failed.');remember(key,body);return body;}).catch(e=>{if(e.status)throw e;throw error(502,'Map storage is temporarily unavailable.');}).finally(()=>{reading--;inflight.delete(key);});inflight.set(key,task);return task;
  }
  function descriptor(row){
    const data=JSON.parse(row.data),level=String(900000000+row.id);
    return {meta:{protocol:core.VERSION,source:'jimbob',mapId:row.map_id,revision:row.revision,level,hash:row.hash,title:row.title,author},rules:data.rules,size:data.size,objects:data.objects,character:data.character,minModVersion:data.minModVersion,requiredFeatures:data.requiredFeatures,code:'JM-'+row.map_id.toUpperCase(),name:row.title,description:row.description,visibility:row.visibility,created:row.created,preview:row.preview?'/api/maps/'+row.map_id+'/revisions/'+row.revision+'/preview':null,xml:'/api/maps/'+row.map_id+'/revisions/'+row.revision+'/xml'};
  }
  function get(id,revision){
    id=mapId(id);if(revision!=null&&(!Number.isSafeInteger(Number(revision))||Number(revision)<1))throw error(400,'Invalid map revision.');
    const row=db.prepare('SELECT r.*,m.title,m.description,m.visibility FROM maps m JOIN revisions r ON r.map_id=m.id AND r.revision=COALESCE(?,m.latest) WHERE m.id=? AND m.visibility<>\'removed\'').get(revision==null?null:Number(revision),id);
    if(!row)throw error(404,'This map revision is unavailable.');return descriptor(row);
  }
  function authenticate(token){
    const a=createHash('sha256').update(String(token||'')).digest(),b=createHash('sha256').update(String(publishToken||'')).digest();
    if(!publishToken||!timingSafeEqual(a,b))throw error(401,'Publishing key is missing or incorrect.');
  }
  async function publish(input){
    if(closed)throw error(503,'Maps service is stopping.');
    if(pendingPublish>=3)throw error(429,'Publishing is busy. Try again shortly.');
    pendingPublish++;
    const task=tail.then(async()=>{
      if(!input||typeof input!=='object'||Array.isArray(input))throw error(400,'Upload a JSON map object.');
      const title=label(input.title,80,true),description=label(input.description,1500),visibility=input.visibility||'public';
      if(!['public','unlisted'].includes(visibility))throw error(400,'Choose public or unlisted visibility.');
      if(!/^[a-zA-Z0-9-]{8,80}$/.test(input.uploadId||''))throw error(400,'Missing upload identifier.');
      const {info,preview}=await validateUpload(input.xml,input.preview),id=input.mapId?mapId(input.mapId):null;
      const fingerprint=hash(JSON.stringify({id,title,description,visibility,hash:info.hash,preview:preview?.hash||null,baseRevision:input.baseRevision??null}));
      const saved=db.prepare('SELECT * FROM uploads WHERE id=?').get(input.uploadId);
      if(saved){if(saved.fingerprint!==fingerprint)throw error(409,'That upload identifier belongs to another edit.');return JSON.parse(saved.response);}
      const existing=id?db.prepare('SELECT * FROM maps WHERE id=?').get(id):null;
      if(id&&!existing)throw error(404,'The map to update was not found.');
      if(existing&&(existing.visibility==='removed'||Number(input.baseRevision)!==existing.latest))throw error(409,'This map changed since you opened it. Refresh My maps before updating.');
      if(Number(db.prepare('SELECT COALESCE(MAX(id),0) AS n FROM revisions').get().n)>=99999999)throw error(503,'Map revision capacity reached.');
      const chosen=id||randomBytes(8).toString('hex'),revision=(existing?.latest||0)+1,now=Date.now();
      try{await storage.put('blobs/'+info.hash+'.xml',Buffer.from(input.xml,'utf8'));if(preview)await storage.put('blobs/'+preview.hash+'.png',preview.body);}catch(cause){throw uploadFailure(cause);}
      let result;
      db.exec('BEGIN IMMEDIATE');
      try{
        if(!existing)db.prepare('INSERT INTO maps VALUES(?,?,?,?,?,?,?)').run(chosen,title,description,visibility,0,now,now);
        db.prepare('INSERT INTO revisions(map_id,revision,hash,preview,data,created) VALUES(?,?,?,?,?,?)').run(chosen,revision,info.hash,preview?.hash||null,JSON.stringify(info),now);
        db.prepare('UPDATE maps SET title=?,description=?,visibility=?,latest=?,updated=? WHERE id=?').run(title,description,visibility,revision,now,chosen);
        result=get(chosen,revision);
        db.prepare('INSERT INTO uploads VALUES(?,?,?,?)').run(input.uploadId,fingerprint,JSON.stringify(result),now);
        db.exec('COMMIT');
      }catch(e){db.exec('ROLLBACK');throw e;}
      remember('blobs/'+info.hash+'.xml',Buffer.from(input.xml,'utf8'));if(preview)remember('blobs/'+preview.hash+'.png',preview.body);
      return result;
    });
    tail=task.catch(()=>{});try{return await task;}finally{pendingPublish--;}
  }
  function list({page=1,query='',sort='newest',mine=false}={}){
    page=Math.floor(Math.max(1,Math.min(100000,Number(page)||1)));query=String(query||'').slice(0,120);
    const where=mine?"m.visibility<>'removed'":"m.visibility='public'",pattern='%'+query.replace(/[\\%_]/g,'\\$&')+'%';
    const order=sort==='oldest'?'m.updated ASC,m.id':'m.updated DESC,m.id';
    const rows=db.prepare(`SELECT r.*,m.title,m.description,m.visibility FROM maps m JOIN revisions r ON r.map_id=m.id AND r.revision=m.latest WHERE ${where} AND (m.title LIKE ? ESCAPE '\\' OR m.description LIKE ? ESCAPE '\\') ORDER BY ${order} LIMIT 25 OFFSET ?`).all(pattern,pattern,(page-1)*24);
    return {page,hasNext:rows.length>24,items:rows.slice(0,24).map(descriptor)};
  }
  async function resolve(meta){if(meta?.source!=='jimbob')throw error(400,'Unsupported map source.');const found=get(meta.mapId,meta.revision);if(!core.compatible(meta,found.meta))throw error(409,'Selected map identity does not match its published revision.');return found;}
  async function readBody(req){let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>20*1024*1024)throw error(413,'Upload exceeds 20 MB.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw error(400,'Invalid JSON upload.');}}
  const budgets=new Map();
  function rate(req,publishing){
    const now=Date.now();let address=req.socket.remoteAddress||'unknown';
    // Enable only behind a controlled proxy that appends/replaces X-Forwarded-For.
    // Its rightmost address cannot be replaced by a client-supplied left prefix.
    if(trustProxy){const forwarded=String(req.headers['x-forwarded-for']||'').split(',').at(-1).trim();if(require('node:net').isIP(forwarded))address=forwarded;}
    const key=address+':'+publishing;let item=budgets.get(key);
    if(!item||now-item.at>=60000){
      if(budgets.size>=20000){for(const [id,value] of budgets)if(now-value.at>=60000)budgets.delete(id);if(budgets.size>=20000)budgets.delete(budgets.keys().next().value);}
      item={at:now,n:0};budgets.set(key,item);
    }
    if(++item.n>(publishing?12:240))throw error(429,'Too many requests. Try again in a minute.');
  }
  function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));}
  async function handle(req,res){
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith('/api/maps')&&url.pathname!=='/maps'&&!url.pathname.startsWith('/maps/'))return false;
    try{
      const publishing=req.method==='POST'||url.pathname==='/api/maps/mine';rate(req,publishing);
      if(url.pathname==='/api/maps/health'){json(res,200,{ok:true,protocol:'jimbob-maps-v1',publishing:!!publishToken});return true;}
      if(req.method==='GET'&&(url.pathname==='/maps'||url.pathname==='/maps/')){res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'",'x-content-type-options':'nosniff'});res.end(fs.readFileSync(path.join(__dirname,'public/index.html')));return true;}
      if(req.method==='GET'&&['/maps/app.js','/maps/style.css'].includes(url.pathname)){res.writeHead(200,{'content-type':url.pathname.endsWith('.js')?'application/javascript':'text/css','cache-control':'public, max-age=300'});res.end(fs.readFileSync(path.join(__dirname,'public',path.basename(url.pathname))));return true;}
      if(url.pathname==='/api/maps/mine'){authenticate(String(req.headers.authorization||'').replace(/^Bearer /,''));if(req.method!=='GET')throw error(405,'Use GET.');json(res,200,list({...Object.fromEntries(url.searchParams),mine:true}));return true;}
      if(url.pathname==='/api/maps'){
        if(req.method==='GET'){json(res,200,list({...Object.fromEntries(url.searchParams),mine:false}));return true;}
        if(req.method!=='POST')throw error(405,'Use GET or POST.');authenticate(String(req.headers.authorization||'').replace(/^Bearer /,''));
        if(!String(req.headers['content-type']||'').startsWith('application/json'))throw error(415,'Upload JSON map data.');json(res,201,await publish(await readBody(req)));return true;
      }
      const match=/^\/api\/maps\/([a-fA-F0-9]{16}|JM-[a-fA-F0-9]{16})(?:\/revisions\/(\d+)(?:\/(xml|preview))?)?$/.exec(url.pathname);
      if(!match)throw error(404,'Map endpoint not found.');if(!['GET','HEAD'].includes(req.method))throw error(405,'Use GET.');
      const found=get(match[1],match[2]);if(!match[3]){json(res,200,found);return true;}
      const row=db.prepare('SELECT preview FROM revisions WHERE map_id=? AND revision=?').get(found.meta.mapId,found.meta.revision),digest=match[3]==='xml'?found.meta.hash:row.preview;
      if(!digest)throw error(404,'This map has no preview.');const etag='"'+digest+'"';
      if(req.headers['if-none-match']===etag){res.writeHead(304,{etag});res.end();return true;}
      const body=await blob('blobs/'+digest+(match[3]==='xml'?'.xml':'.png'));
      res.writeHead(200,{'content-type':match[3]==='xml'?'application/xml; charset=utf-8':'image/png','content-length':body.length,'cache-control':'public, max-age=31536000, immutable',etag,'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"});res.end(req.method==='HEAD'?undefined:body);return true;
    }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Map service encountered an error.'});else res.destroy();return true;}
  }
  return {handle,get,list,publish,resolve,authenticate,close:async()=>{closed=true;await tail;db.close();},publicBase};
}
module.exports={createMaps,mapId};
