const authority=require('./shared-protocol.cjs');
'use strict';
const {createServer}=require('node:http');
const {randomBytes}=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const core=require('./core.js');

function createRelay({host='127.0.0.1',port=19799,countdown=3000}={}){
  const rooms=new Map();
  const startedAt=Date.now();
  const totals={connections:0,roomsCreated:0,racesStarted:0,finishes:0};
  function snapshot(){
    const roomList=[];
    let players=0,racing=0,checking=0;
    for(const room of rooms.values()){
      players+=room.players.size;
      if(room.start)racing++;
      if(room.check)checking++;
      roomList.push({
        code:room.code,
        mode:room.mode==='shared'?'shared':'ghost',
        capacity:room.capacity||8,
        players:[...room.players.values()].map(p=>({
          name:String(p.name||'Racer').slice(0,24),
          host:p.id===room.hostId,
          phase:playerPhase(room,p),
          ready:!!p.ready,
          finished:!!p.finished
        })),
        level:room.meta&&typeof room.meta.level==='string'?room.meta.level:null,
        racing:!!room.start,
        checking:!!room.check
      });
    }
    return {ok:true,name:"Jimbob's Multiplayer relay",now:Date.now(),uptimeSec:Math.max(0,Math.floor((Date.now()-startedAt)/1000)),connections:wss.clients.size,rooms:rooms.size,players,racing,checking,totals:{...totals},roomList};
  }
  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function modeLabel(mode){return mode==='shared'?'Shared Physics':'Ghost Multiplayer';}
  function renderStats(data){
    const ago=data.uptimeSec>=3600?Math.floor(data.uptimeSec/3600)+'h '+Math.floor(data.uptimeSec%3600/60)+'m':data.uptimeSec>=60?Math.floor(data.uptimeSec/60)+'m '+data.uptimeSec%60+'s':data.uptimeSec+'s';
    const rows=data.roomList.length?data.roomList.map((room,i)=>{
      const status=room.racing?'Racing':room.checking?'Ready check':room.level?'On level':'Lobby';
      const size=room.players.length+'/'+(room.capacity||8);
      const people=room.players.map(p=>esc(p.name)+(p.host?' (host)':'')+(p.ready?' ready':'')+(p.finished?' finished':'')+' · '+esc(p.phase)).join('<br>');
      return `<tr><td>${i+1}</td><td class="code">${esc(room.code)}<\/td><td>${esc(modeLabel(room.mode))}<\/td><td>${esc(room.level||'—')}<\/td><td>${status}<\/td><td>${size}<\/td><td>${people}<\/td><\/tr>`;
    }).join(''):'<tr><td colspan="7">No rooms right now.<\/td><\/tr>';
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relay stats</title><style>body{margin:24px;background:#12202a;color:#e8eef3;font:16px/1.45 Georgia,serif}h1{font-size:28px;margin:0 0 8px}p,th,td{font-family:system-ui,sans-serif}p{color:#b8c6d0}.grid{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 22px}.card{background:#1c2e3b;border:1px solid #3a5363;border-radius:8px;padding:12px 14px;min-width:110px}.card b{display:block;font-size:26px;color:#fff}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #355060;vertical-align:top}th{color:#9eb0bb;font-size:13px}td.code{font:15px/1.4 ui-monospace,Consolas,monospace;letter-spacing:.04em;color:#fff}</style><h1>Jimbob's Multiplayer relay</h1><p>Live rooms and players · up ${ago} · refresh for a new snapshot</p><div class="grid"><div class="card"><b>${data.rooms}</b>rooms</div><div class="card"><b>${data.players}</b>players</div><div class="card"><b>${data.racing}</b>racing</div><div class="card"><b>${data.connections}</b>connections</div><div class="card"><b>${data.totals.roomsCreated}</b>rooms ever</div><div class="card"><b>${data.totals.racesStarted}</b>races started</div><div class="card"><b>${data.totals.finishes}</b>finishes</div></div><table><thead><tr><th>#</th><th>Room code</th><th>Mode</th><th>Level</th><th>Status</th><th>Players</th><th>Who</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function statsAllowed(req){
    const need=process.env.HW_RELAY_STATS_TOKEN;
    if(!need)return true;
    const url=new URL(req.url||'/', 'http://localhost');
    const auth=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    return url.searchParams.get('token')===need||auth===need;
  }
  const http=createServer((req,res)=>{
    const url=new URL(req.url||'/', 'http://localhost');
    if(url.pathname==='/stats'||url.pathname==='/stats.json'){
      if(!statsAllowed(req)){res.writeHead(401,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end('Stats token required\n');return;}
      const data=snapshot();
      const wantJson=url.pathname==='/stats.json'||url.searchParams.get('format')==='json'||String(req.headers.accept||'').includes('application/json');
      if(wantJson){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data,null,2)+'\n');return;}
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(renderStats(data));return;
    }
    res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
    res.end('Happy Wheels ghost racing relay\nStats: /stats\n');
  });
  const wss=new WebSocketServer({server:http,maxPayload:512*1024,perMessageDeflate:false});
  wss.address=()=>http.address();
  http.on('listening',()=>wss.emit('listening'));
  http.on('error',e=>wss.emit('error',e));
  function send(ws,m){if(!ws||ws.readyState!==WebSocket.OPEN)return;if(ws.bufferedAmount>=1024*1024){ws.close(1013,'Connection cannot keep up; reconnect');return;}const essential=m.type==='authorityState'&&(m.full||m.effects?.length||m.textures?.length||m.removed?.length||(m.players||[]).some(p=>p.events?.length||p.resetEvents));if(m.type==='authorityState'&&!essential&&ws.bufferedAmount>128*1024)return;ws.send(JSON.stringify(m));}
  const broadcast=(room,m,except)=>{for(const p of room.players.values())if(p!==except)send(p,m);};
  function playerPhase(room,p){
    if(p.phase==='ingame'||p.phase==='selecting'||p.phase==='loading'||p.phase==='lobby')return p.phase;
    if(!room.meta)return 'lobby';
    return core.compatible(room.meta,p.meta)?'ingame':'loading';
  }
  function playerInGame(room,p){
    const phase=playerPhase(room,p);
    if(phase==='ingame')return true;
    if(phase==='selecting'||phase==='loading'||phase==='lobby')return false;
    return core.compatible(room.meta,p.meta);
  }
  function allInGame(room){return !!room.meta&&[...room.players.values()].every(p=>playerInGame(room,p));}
  function setCharacter(ws,value){
    const n=Number(value);
    if(!Number.isInteger(n)||n<1||n>32)return false;
    if(ws.character===n)return false;
    ws.character=n;return true;
  }
  const state=room=>broadcast(room,{type:'room',code:room.code,hostId:room.hostId,mode:room.mode||'ghost',capacity:room.capacity||8,collide:room.collide!==false,capabilities:['shared-physics-v1','shared-pose-v1',authority.PROTOCOL],meta:room.meta,checking:!!room.check,players:[...room.players.values()].map(p=>{const phase=playerPhase(room,p);return {id:p.id,name:p.name,ready:p.ready,phase,loaded:phase==='ingame',character:Number.isInteger(p.character)?p.character:null};})});
  function resetReady(room){room.check=false;room.start=null;for(const p of room.players.values()){p.ready=false;p.finished=false;p.lastTime=-1;}}
  function cancel(room,message){resetReady(room);broadcast(room,{type:'cancel',message});state(room);}
  function allReady(room){return room.players.size>=2&&[...room.players.values()].every(p=>p.ready&&core.compatible(room.meta,p.meta));}
  function setPhase(ws,phase){
    if(!['lobby','loading','selecting','ingame'].includes(phase))return false;
    if(ws.phase===phase)return false;
    ws.phase=phase;return true;
  }
  function beginRace(room){room.check=false;room.start=Date.now()+countdown;for(const p of room.players.values()){p.lastTime=-1;p.finished=false;}totals.racesStarted++;broadcast(room,{type:'start',at:room.start});}
  function leave(ws){
    const room=ws.room;if(!room)return;
    const racing=!!room.start;
    const name=ws.name||'A racer';
    room.players.delete(ws.id);ws.room=null;
    if(!room.players.size){rooms.delete(room.code);return;}
    if(room.hostId===ws.id){room.hostId=room.players.keys().next().value;if(room.mode==='shared')cancel(room,'Host left. Shared world ended; the new host can start again.');}
    broadcast(room,{type:'left',id:ws.id,name,racing});
    state(room);
    if(room.check&&allReady(room))beginRace(room);
  }
  function validMeta(m){return m&&m.protocol===core.VERSION&&typeof m.level==='string'&&/^[1-9][0-9]{0,8}$/.test(m.level)&&typeof m.hash==='string'&&/^[a-f0-9]{64}$/.test(m.hash);}
  wss.on('connection',ws=>{
    totals.connections++;
    ws.id=randomBytes(8).toString('hex');ws.room=null;ws.ready=false;ws.finished=false;ws.lastTime=-1;ws.budget=0;ws.budgetAt=Date.now();ws.alive=true;ws.phase='lobby';
    const greeting=setTimeout(()=>{if(!ws.room)ws.close(1008,'Join timeout');},15000);greeting.unref();
    ws.on('pong',()=>ws.alive=true);
    ws.on('error',()=>{});
    ws.on('close',()=>{clearTimeout(greeting);leave(ws);});
    ws.on('message',raw=>{
      try{
        ws.alive=true;
        const now=Date.now();if(now-ws.budgetAt>1000){ws.budget=0;ws.budgetAt=now;}if(++ws.budget>120){ws.close(1008,'Rate limit');return;}
        const m=JSON.parse(raw);if(!m||typeof m!=='object')throw Error('Invalid message');
        if(m.type==='ping'){
          if(typeof m.clientTime==='number'&&Number.isFinite(m.clientTime))send(ws,{type:'pong',clientTime:m.clientTime,serverTime:Date.now()});
          if(ws.room&&(setPhase(ws,m.phase)|setCharacter(ws,m.character)))state(ws.room);
          return;
        }
        if(m.type==='status'){
          if(!ws.room)throw Error('Join a room first');
          const changed=setPhase(ws,m.phase)|setCharacter(ws,m.character);
          if(changed)state(ws.room);
          return;
        }
        if(m.type==='create'||m.type==='join'){
          if(ws.room)throw Error('Leave the current room first');if(m.protocol!==core.VERSION&&m.meta?.protocol!==core.VERSION)throw Error('Unsupported game protocol');if(m.meta!=null&&!validMeta(m.meta))throw Error('Invalid level');
          let room;
          if(m.type==='create'){
            if(rooms.size>=100)throw Error('Relay is full');const code=randomBytes(8).toString('hex').toUpperCase();const capacity=Math.max(2,Math.min(16,Number.isInteger(m.capacity)?m.capacity:8));room={code,hostId:ws.id,mode:m.mode==='shared'?'shared':'ghost',capacity,collide:true,meta:m.meta||null,players:new Map(),start:null,check:false};rooms.set(code,room);totals.roomsCreated++;
          }else{
            room=rooms.get(String(m.code));if(!room)throw Error('Room not found');if(room.start)throw Error('Race in progress');
            if(room.players.size>=(room.capacity||8))throw Error('Room is full');
          }
          clearTimeout(greeting);ws.name=typeof m.name==='string'?m.name.slice(0,24):'Racer';ws.meta=m.meta;setCharacter(ws,m.meta?.character);ws.room=room;ws.phase=room.meta&&core.compatible(room.meta,m.meta)?'ingame':room.meta?'loading':'lobby';room.players.set(ws.id,ws);send(ws,{type:'identity',id:ws.id});state(room);if(room.meta&&!core.compatible(room.meta,m.meta))send(ws,{type:'travel',meta:room.meta});return;
        }
        const room=ws.room;if(!room)throw Error('Join a room first');
        if(m.type==='mode'){
          if(ws.id!==room.hostId)throw Error('Only the host can change the mode');
          if(!['ghost','shared'].includes(m.mode))throw Error('Invalid multiplayer mode');
          if(room.start||room.check)throw Error('Change mode before starting a ready check');
          room.mode=m.mode;resetReady(room);state(room);return;
        }
        if(m.type==='collide'){
          if(ws.id!==room.hostId)throw Error('Only the host can change bumps');
          if(room.mode!=='shared')throw Error('Bumps are only for Shared Physics');
          room.collide=!!m.on;state(room);return;
        }
        if(['authorityInput','authorityRequest','authorityState'].includes(m.type)){
          if(room.mode!=='shared'||!room.start||m.epoch!==room.start)throw Error('Authoritative world is not active');
          if(m.type==='authorityState'){
            if(ws.id!==room.hostId)throw Error('Only the host can publish the world');
            if(!authority.validateState(m,new Set(room.players.keys())))throw Error('Invalid authoritative state');
            if(ws.authorityEpoch===room.start&&(m.revision<ws.authorityRevision||m.revision===ws.authorityRevision&&m.tick<=ws.authorityTick))return;
            ws.authorityEpoch=room.start;ws.authorityRevision=m.revision;ws.authorityTick=m.tick;
            broadcast(room,{...m,id:ws.id},ws);return;
          }
          if(ws.id===room.hostId)throw Error('Host controls stay local');
          if(!(m.type==='authorityInput'?authority.validateInput(m):authority.validateRequest(m)))throw Error('Invalid authoritative controls');
          const key=m.type==='authorityInput'?'authorityInputSeq':'authorityRequestSeq';
          if(ws.controlEpoch!==room.start){ws.controlEpoch=room.start;ws.authorityInputSeq=-1;ws.authorityRequestSeq=-1;}
          if(m.seq<=ws[key])return;ws[key]=m.seq;
          send(room.players.get(room.hostId),m.type==='authorityInput'?{type:m.type,id:ws.id,epoch:room.start,seq:m.seq,keys:m.keys,applied:m.applied&&typeof m.applied==='object'?m.applied:undefined,recover:Array.isArray(m.recover)?m.recover.slice(0,16):undefined}:{type:m.type,id:ws.id,epoch:room.start,seq:m.seq,character:m.character,skin:typeof m.skin==='string'?m.skin:''});return;
        }
        if(m.type==='sharedState'){
          if(ws.id!==room.hostId)throw Error('Only the host can send the shared world');
          if(room.mode!=='shared'||!room.start||m.epoch!==room.start)throw Error('Shared world is not active');
          if(!Array.isArray(m.players)||m.players.length>16||(m.world&&!Array.isArray(m.world)))throw Error('Invalid shared world');
          const raw=JSON.stringify(m);
          if(raw.length>120000)throw Error('Shared world is too large');
          const ghostLeft=Number.isFinite(m.ghostLeft)?Math.max(0,Math.min(30,Math.round(m.ghostLeft))):0;
          broadcast(room,{type:'sharedState',id:ws.id,epoch:room.start,t:m.t,ghostLeft,players:m.players,world:m.world||[]},ws);return;
        }
        if(m.type==='sharedPose'){
          if(room.mode!=='shared'||!room.start||m.epoch!==room.start)throw Error('Shared world is not active');
          if(!Number.isSafeInteger(m.seq)||m.seq<0||!m.parts||typeof m.parts!=='object'||Array.isArray(m.parts))throw Error('Invalid shared pose');
          if(ws.poseEpoch===room.start&&m.seq<=ws.poseSeq)return;
          const breaks=Array.isArray(m.breaks)?m.breaks.slice(0,64).map(String):[];
          const character=Number.isInteger(m.character)&&m.character>0&&m.character<=32?m.character:undefined;
          const out={type:'sharedPose',id:ws.id,epoch:room.start,seq:m.seq,life:Number.isSafeInteger(m.life)?m.life:0,dead:!!m.dead,parts:m.parts,breaks};
          if(character)out.character=character;
          if(JSON.stringify(out).length>40000)throw Error('Shared pose is too large');
          ws.poseEpoch=room.start;ws.poseSeq=m.seq;
          broadcast(room,out,ws);return;
        }
        if(m.type==='sharedHit'){
          if(room.mode!=='shared'||!room.start||m.epoch!==room.start)throw Error('Shared world is not active');
          const target=room.players.get(m.to);
          if(!target||target===ws)throw Error('Invalid shared hit recipient');
          if(!Array.isArray(m.hits)||!m.hits.length||m.hits.length>16)throw Error('Invalid shared hit');
          const num=(n,max)=>Number.isFinite(n)?Math.max(-max,Math.min(max,n)):null;
          const hits=[];
          for(const h of m.hits){
            if(!h||typeof h.key!=='string'||h.key.length>48)throw Error('Invalid shared hit');
            const x=num(h.x,40),y=num(h.y,40);
            if(x===null||y===null)throw Error('Invalid shared hit');
            const out={key:h.key,x,y};
            const px=num(h.px,100000),py=num(h.py,100000);
            if(px!==null&&py!==null){out.px=px;out.py=py;}
            hits.push(out);
          }
          send(target,{type:'sharedHit',id:ws.id,to:target.id,epoch:room.start,life:Number.isSafeInteger(m.life)?m.life:0,hits});return;
        }
        if(m.type==='sharedInput'||m.type==='sharedSignal'){
          if(room.mode!=='shared'||!room.start||m.epoch!==room.start)throw Error('Shared world is not active');
          if(m.type==='sharedInput'){
            if(ws.id===room.hostId)throw Error('Host inputs stay local');
            if(!Number.isSafeInteger(m.seq)||m.seq<0||!Number.isInteger(m.keys)||m.keys<0||m.keys>255)throw Error('Invalid shared controls');
            if(ws.inputEpoch===room.start&&m.seq<=ws.inputSeq)return;
            ws.inputEpoch=room.start;ws.inputSeq=m.seq;
            send(room.players.get(room.hostId),{type:m.type,id:ws.id,epoch:room.start,seq:m.seq,keys:m.keys,dead:!!m.dead,respawn:!!m.respawn});return;
          }
          const target=room.players.get(m.to);
          if(!target||target===ws||(ws.id!==room.hostId&&target.id!==room.hostId))throw Error('Invalid shared-world recipient');
          const signal=m.signal;
          if(!signal||typeof signal!=='object'||JSON.stringify(signal).length>100000)throw Error('Invalid shared signal');
          if(signal.description){if(!['offer','answer'].includes(signal.description.type)||typeof signal.description.sdp!=='string')throw Error('Invalid shared description');}
          else if(!signal.candidate||typeof signal.candidate.candidate!=='string')throw Error('Invalid shared candidate');
          send(target,{type:m.type,id:ws.id,epoch:room.start,signal});return;
        }
        if(m.type==='summon'){
          if(ws.id!==room.hostId)throw Error('Only the host can bring everyone to a level');
          if(!validMeta(m.meta))throw Error('Load a published level first');
          room.meta=m.meta;ws.meta=m.meta;ws.phase='ingame';
          for(const p of room.players.values())if(p!==ws)p.phase='loading';
          cancel(room,'Host selected a level. Waiting for everyone to load.');
          broadcast(room,{type:'travel',meta:room.meta},ws);return;
        }
        if(m.type==='level'){
          if(!validMeta(m.meta))throw Error('Invalid level');
          setCharacter(ws,m.meta.character);
          if(room.start&&core.compatible(room.meta,m.meta)){ws.meta=m.meta;ws.phase='ingame';state(room);return;}
          ws.meta=m.meta;ws.ready=false;if(core.compatible(room.meta,m.meta))ws.phase='ingame';
          if(!room.meta||(ws.id===room.hostId&&!core.compatible(room.meta,m.meta))){
            const moved=!core.compatible(room.meta,m.meta);
            room.meta=m.meta;
            if(moved){
              resetReady(room);
              ws.phase='ingame';
              for(const p of room.players.values())if(p!==ws)p.phase='loading';
              state(room);
              broadcast(room,{type:'travel',meta:room.meta},ws);
            }else state(room);
            return;
          }
          if(room.start&&!core.compatible(room.meta,m.meta))cancel(room,'Level changed. All racers must ready up again.');
          else state(room);
          return;
        }
        if(m.type==='ready'){
          if(!validMeta(m.meta)||!core.compatible(room.meta,m.meta))throw Error('Level does not match this room');
          if(ws.id===room.hostId){
            if(room.players.size<2)throw Error('Need another racer before starting');
            if(!allInGame(room))throw Error('Wait for everyone to select a character');
            resetReady(room);room.check=true;ws.ready=true;ws.meta=m.meta;ws.phase='ingame';state(room);
            broadcast(room,{type:'readyCheck',name:ws.name,meta:room.meta});
            return;
          }
          if(!room.check)throw Error('Wait for the host to ask if everyone is ready');
          if(room.start)throw Error('Race already starting');
          ws.ready=true;ws.meta=m.meta;state(room);
          if(allReady(room))beginRace(room);
          return;
        }
        if(m.type==='notReady'){
          if(ws.id===room.hostId)return;
          if(!room.check&&![...room.players.values()].some(p=>p.ready))return;
          const name=ws.name||'A racer';
          const text=name+' declined ready. The host will have to ask again.';
          broadcast(room,{type:'readyDeclined',name,message:text});
          cancel(room,text);
          return;
        }
        if(m.type==='frame'){
          if(!room.start||room.mode==='shared')return;
          if(!core.validFrame(m.frame)||!Array.isArray(m.textures)||m.textures.length>4096||!m.textures.every(core.validTexture)||m.frame.parts.some(p=>p[1]>=m.textures.length))return;
          if(m.frame.t<ws.lastTime)return;ws.lastTime=m.frame.t;broadcast(room,{type:'frame',id:ws.id,frame:m.frame,textures:m.textures},ws);return;
        }
        if(m.type==='finish'){
          if(!room.start||ws.finished||typeof m.time!=='number'||!Number.isFinite(m.time)||m.time<0||m.time>Date.now()-room.start+2000)throw Error('Invalid finish');
          ws.finished=true;totals.finishes++;broadcast(room,{type:'finish',id:ws.id,name:ws.name,time:m.time});return;
        }
        throw Error('Unknown message');
      }catch(e){send(ws,{type:'error',message:e.message});}
    });
  });
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);heartbeat.unref();
  wss.on('close',()=>clearInterval(heartbeat));
  http.listen(port,host);
  return {wss,http,rooms,close:()=>new Promise(resolve=>{for(const ws of wss.clients)ws.terminate();wss.close(()=>http.close(resolve));})};
}

function listenFromEnv({runtimeDir}={}){
  const hosted=!!(process.env.RAILWAY_ENVIRONMENT||process.env.RAILWAY_PUBLIC_DOMAIN||process.argv.includes('--lan'));
  const host=process.env.HOST||(hosted||process.env.PORT?'0.0.0.0':'127.0.0.1');
  const port=Number(process.env.PORT||19799);
  const relay=createRelay({host,port});
  relay.wss.on('listening',()=>{
    console.log('Ghost racing relay listening on '+host+':'+relay.wss.address().port);
    if(process.env.HW_RELAY_MANAGED==='1'&&runtimeDir){
      const fs=require('node:fs'),path=require('node:path'),token=randomBytes(16).toString('hex');
      fs.mkdirSync(runtimeDir,{recursive:true});fs.writeFileSync(path.join(runtimeDir,'state.json'),JSON.stringify({pid:process.pid,host,port:relay.wss.address().port,token}));
      const control=setInterval(()=>{try{if(JSON.parse(fs.readFileSync(path.join(runtimeDir,'stop.json'),'utf8')).token===token){clearInterval(control);relay.close().then(()=>process.exit());}}catch{}},500);control.unref();
    }
  });
  relay.wss.on('error',e=>{console.error(e.message);process.exitCode=1;});
  process.on('SIGINT',()=>relay.close().then(()=>process.exit()));
  process.on('SIGTERM',()=>relay.close().then(()=>process.exit()));
  return relay;
}

module.exports={createRelay,listenFromEnv};
if(require.main===module)listenFromEnv();
