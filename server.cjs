'use strict';
const {createServer}=require('node:http');
const {randomBytes}=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const core=require('./core.js');

function createRelay({host='127.0.0.1',port=19799,countdown=3000}={}){
  const rooms=new Map();
  const http=createServer((req,res)=>{
    res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
    res.end('Happy Wheels ghost racing relay\n');
  });
  const wss=new WebSocketServer({server:http,maxPayload:512*1024,perMessageDeflate:false});
  wss.address=()=>http.address();
  http.on('listening',()=>wss.emit('listening'));
  http.on('error',e=>wss.emit('error',e));
  function send(ws,m){if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<1024*1024)ws.send(JSON.stringify(m));}
  const broadcast=(room,m,except)=>{for(const p of room.players.values())if(p!==except)send(p,m);};
  const state=room=>broadcast(room,{type:'room',code:room.code,hostId:room.hostId,meta:room.meta,checking:!!room.check,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,ready:p.ready}))});
  function resetReady(room){room.check=false;room.start=null;for(const p of room.players.values()){p.ready=false;p.finished=false;p.lastTime=-1;}}
  function cancel(room,message){resetReady(room);broadcast(room,{type:'cancel',message});state(room);}
  function allReady(room){return room.players.size>=2&&[...room.players.values()].every(p=>p.ready&&core.compatible(room.meta,p.meta));}
  function beginRace(room){room.check=false;room.start=Date.now()+countdown;for(const p of room.players.values()){p.lastTime=-1;p.finished=false;}broadcast(room,{type:'start',at:room.start});}
  function leave(ws){
    const room=ws.room;if(!room)return;
    const racing=!!room.start;
    const name=ws.name||'A racer';
    room.players.delete(ws.id);ws.room=null;
    if(!room.players.size){rooms.delete(room.code);return;}
    if(room.hostId===ws.id)room.hostId=room.players.keys().next().value;
    broadcast(room,{type:'left',id:ws.id,name,racing});
    cancel(room,racing?name+' left. The race is over.':name+' left. Ready up again when everyone is here.');
  }
  function validMeta(m){return m&&m.protocol===core.VERSION&&typeof m.level==='string'&&/^[1-9][0-9]{0,8}$/.test(m.level)&&typeof m.hash==='string'&&/^[a-f0-9]{64}$/.test(m.hash);}
  wss.on('connection',ws=>{
    ws.id=randomBytes(8).toString('hex');ws.room=null;ws.ready=false;ws.finished=false;ws.lastTime=-1;ws.budget=0;ws.budgetAt=Date.now();ws.alive=true;
    const greeting=setTimeout(()=>{if(!ws.room)ws.close(1008,'Join timeout');},15000);greeting.unref();
    ws.on('pong',()=>ws.alive=true);
    ws.on('error',()=>{});
    ws.on('close',()=>{clearTimeout(greeting);leave(ws);});
    ws.on('message',raw=>{
      try{
        ws.alive=true;
        const now=Date.now();if(now-ws.budgetAt>1000){ws.budget=0;ws.budgetAt=now;}if(++ws.budget>120){ws.close(1008,'Rate limit');return;}
        const m=JSON.parse(raw);if(!m||typeof m!=='object')throw Error('Invalid message');
        if(m.type==='ping'){if(typeof m.clientTime==='number'&&Number.isFinite(m.clientTime))send(ws,{type:'pong',clientTime:m.clientTime,serverTime:Date.now()});return;}
        if(m.type==='create'||m.type==='join'){
          if(ws.room)throw Error('Leave the current room first');if(m.protocol!==core.VERSION&&m.meta?.protocol!==core.VERSION)throw Error('Unsupported game protocol');if(m.meta!=null&&!validMeta(m.meta))throw Error('Invalid level');
          let room;
          if(m.type==='create'){
            if(rooms.size>=100)throw Error('Relay is full');const code=randomBytes(8).toString('hex').toUpperCase();room={code,hostId:ws.id,meta:m.meta||null,players:new Map(),start:null,check:false};rooms.set(code,room);
          }else{
            room=rooms.get(String(m.code));if(!room)throw Error('Room not found');if(room.start)throw Error('Race in progress');
            if(room.players.size>=8)throw Error('Room is full');
          }
          clearTimeout(greeting);ws.name=typeof m.name==='string'?m.name.slice(0,24):'Racer';ws.meta=m.meta;ws.room=room;room.players.set(ws.id,ws);send(ws,{type:'identity',id:ws.id});state(room);if(room.meta&&!core.compatible(room.meta,m.meta))send(ws,{type:'travel',meta:room.meta});return;
        }
        const room=ws.room;if(!room)throw Error('Join a room first');
        if(m.type==='summon'){
          if(ws.id!==room.hostId)throw Error('Only the host can bring everyone to a level');
          if(!validMeta(m.meta))throw Error('Load a published level first');
          room.meta=m.meta;ws.meta=m.meta;cancel(room,'Host selected a level. Waiting for everyone to load.');
          broadcast(room,{type:'travel',meta:room.meta},ws);return;
        }
        if(m.type==='level'){
          if(!validMeta(m.meta))throw Error('Invalid level');
          if(room.start&&core.compatible(room.meta,m.meta)){ws.meta=m.meta;state(room);return;}
          ws.meta=m.meta;ws.ready=false;
          if(!room.meta||(ws.id===room.hostId&&!core.compatible(room.meta,m.meta))){
            const moved=!core.compatible(room.meta,m.meta);
            room.meta=m.meta;
            if(moved){
              resetReady(room);
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
            resetReady(room);room.check=true;ws.ready=true;ws.meta=m.meta;state(room);
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
          if(!room.start)return;
          if(!core.validFrame(m.frame)||!Array.isArray(m.textures)||m.textures.length>4096||!m.textures.every(core.validTexture)||m.frame.parts.some(p=>p[1]>=m.textures.length))return;
          if(m.frame.t<ws.lastTime)return;ws.lastTime=m.frame.t;broadcast(room,{type:'frame',id:ws.id,frame:m.frame,textures:m.textures},ws);return;
        }
        if(m.type==='finish'){
          if(!room.start||ws.finished||typeof m.time!=='number'||!Number.isFinite(m.time)||m.time<0||m.time>Date.now()-room.start+2000)throw Error('Invalid finish');
          ws.finished=true;broadcast(room,{type:'finish',id:ws.id,name:ws.name,time:m.time});return;
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
