const authority=require('./shared-protocol.cjs');
'use strict';
const {createServer}=require('node:http');
const {randomBytes}=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const core=require('./core.js');

function createRelay({host='127.0.0.1',port=19799,countdown=3000,restartVoteMs=30000}={}){
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
  function cleanSkin(value){return typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/i.test(value)?value:'';}
  function roomPhase(room){
    if(room.results)return 'results';
    if(room.start)return Date.now()>=room.start?'racing':'countdown';
    if(room.phase==='loading'||room.phase==='selecting')return room.phase;
    if(room.launchId)return 'selecting';
    return 'lobby';
  }
  function rosterEntry(room,p){
    const current=roomPhase(room);
    const phase=!room.launchId?playerPhase(room,p):current==='selecting'?(Number.isInteger(p.confirmed)?'selected':'selecting'):p.prepared?'ready':'loading';
    const confirmed=Number.isInteger(p.confirmed)?p.confirmed:null;
    return {id:p.id,name:p.name,ready:p.ready,phase,loaded:room.launchId?!!p.prepared:phase==='ingame',character:confirmed,confirmed,skin:p.skin||'',prepared:!!p.prepared,finished:!!p.finished,time:p.finished?p.finishTime:null};
  }
  const state=room=>broadcast(room,{type:'room',code:room.code,hostId:room.hostId,mode:room.mode||'ghost',capacity:room.capacity||8,collide:room.collide!==false,locked:!!room.locked,launched:!!room.launched,gate:!!room.gate,launchId:room.launchId||0,lobbyRev:room.lobbyRev||0,phase:roomPhase(room),start:room.start||null,rules:room.rules||null,countdownMs:room.countdownMs||countdown,results:room.results||null,restartVote:voteState(room),capabilities:['shared-physics-v1','shared-pose-v1',authority.PROTOCOL,'restart-vote-v1','race-transitions-v1'],meta:room.meta,pick:room.pick||null,checking:!!room.check,players:[...room.players.values()].map(p=>rosterEntry(room,p))});
  function resetReady(room){room.check=false;room.start=null;for(const p of room.players.values()){p.ready=false;p.finished=false;p.finishTime=null;p.lastTime=-1;}}
  function clearResultsTimer(room){if(room.resultsTimer){clearTimeout(room.resultsTimer);room.resultsTimer=null;}if(room.survivalTimer){clearTimeout(room.survivalTimer);room.survivalTimer=null;}}
  function cancel(room,message){clearResultsTimer(room);room.results=null;room.lingerUntil=null;resetReady(room);clearAttempt(room);broadcast(room,{type:'cancel',message,launchId:0,lobbyRev:room.lobbyRev});state(room);}
  function allReady(room){return room.players.size>=2&&[...room.players.values()].every(p=>p.ready&&core.compatible(room.meta,p.meta));}
  function allLobbyReady(room){return room.players.size>=2&&[...room.players.values()].every(p=>p.ready);}
  function cleanRules(raw){
    const rules={};
    if(!raw||typeof raw!=='object')return rules;
    const wait=Number(raw.waitSec);
    if(Number.isInteger(wait)&&wait>=2&&wait<=15)rules.waitSec=wait;
    const seats=Number(raw.seats);
    if(Number.isInteger(seats)&&seats>=1&&seats<=16)rules.seats=seats;
    const rider=Number(raw.rider);
    if(Number.isInteger(rider)&&rider>=1&&rider<=11)rules.rider=rider;
    const linger=Number(raw.lingerMs);
    if(Number.isFinite(linger)&&linger>=1000&&linger<=600000)rules.lingerMs=linger;
    if(raw.play==='survival')rules.play='survival';
    return rules;
  }
  function ranked(room){
    const rows=[...room.players.values()].map(p=>({id:p.id,name:p.name,finished:!!p.finished,time:p.finished?p.finishTime:null}));
    rows.sort((a,b)=>(a.finished===b.finished?0:a.finished?-1:1)||((a.time??1e15)-(b.time??1e15)));
    return rows.map((row,index)=>({...row,place:row.finished?index+1:null}));
  }
  function publishResults(room){
    if(!room||room.results||!room.players.size)return;
    clearResultsTimer(room);
    room.results=ranked(room);
    room.start=null;
    room.lingerUntil=null;
    broadcast(room,{type:'results',launchId:room.launchId||0,rows:room.results});
    state(room);
  }
  function survivalState(room,m){
    if(room.rules?.play!=='survival'||!room.start||room.results||Date.now()<room.start)return;
    if(room.survivalEpoch!==room.start){room.survivalEpoch=room.start;room.eliminated=new Set();room.seenRiders=new Set();}
    for(const p of m.players){if(room.players.has(p.id)){room.seenRiders.add(p.id);if(p.dead)room.eliminated.add(p.id);}}
    if(![...room.players.keys()].every(id=>room.seenRiders.has(id)))return;
    const alive=[...room.players.keys()].filter(id=>!room.eliminated.has(id));
    if(alive.length>1||room.survivalTimer)return;
    const epoch=room.start;
    room.survivalTimer=setTimeout(()=>{
      room.survivalTimer=null;
      if(room.start!==epoch||room.results||room.rules?.play!=='survival')return;
      const remaining=[...room.players.values()].filter(p=>!room.eliminated.has(p.id));
      if(remaining.length>1)return;
      if(remaining.length===1){const winner=remaining[0];winner.finished=true;winner.finishTime=Math.max(0,Date.now()-epoch);totals.finishes++;broadcast(room,{type:'finish',launchId:room.launchId||0,id:winner.id,name:winner.name,time:winner.finishTime});}
      publishResults(room);
    },250);
    room.survivalTimer.unref?.();
  }
  function voteState(room){
    const vote=room.restartVote;if(!vote)return null;
    return {id:vote.id,launchId:vote.launchId,requesterId:vote.requesterId,expiresAt:vote.expiresAt,players:[...vote.voters].map(id=>({id,name:room.players.get(id)?.name||'Racer',yes:vote.yes.has(id)}))};
  }
  function endVote(room,outcome){
    const vote=room.restartVote;if(!vote)return;
    clearTimeout(vote.timer);room.restartVote=null;
    broadcast(room,{type:'restartVoteEnded',id:vote.id,launchId:vote.launchId,outcome});
  }
  function acceptVote(room){
    const vote=room.restartVote;if(!vote||vote.launchId!==room.launchId||vote.voters.size!==room.players.size||![...vote.voters].every(id=>room.players.has(id)&&vote.yes.has(id)))return;
    endVote(room,'accepted');launchRoom(room,{keepCharacters:true,reason:'restart'});
  }
  function requestRestart(room,ws,m){
    if(room.rules?.play!=='survival')throw Error('Restart voting is only for survival courses');
    if(!room.launchId||(!room.start&&!room.results))return;
    if(m.launchId!==room.launchId)return;
    if(room.restartVote){
      if(!room.restartVote.yes.has(ws.id)){room.restartVote.yes.add(ws.id);state(room);acceptVote(room);}
      return;
    }
    if(room.players.size<2)throw Error('Need another player to vote on a restart');
    const vote={id:(room.voteSeq||0)+1,launchId:room.launchId,requesterId:ws.id,voters:new Set(room.players.keys()),yes:new Set([ws.id]),expiresAt:Date.now()+restartVoteMs};
    room.voteSeq=vote.id;room.restartVote=vote;
    vote.timer=setTimeout(()=>{if(room.restartVote===vote){endVote(room,'expired');state(room);}},restartVoteMs);vote.timer.unref?.();
    state(room);acceptVote(room);
  }
  function armResults(room){
    if(room.resultsTimer||room.results)return;
    const linger=room.lingerMs||45000;
    room.lingerUntil=Date.now()+linger;
    broadcast(room,{type:'linger',launchId:room.launchId||0,until:room.lingerUntil,ms:linger});
    room.resultsTimer=setTimeout(()=>publishResults(room),linger);
    if(room.resultsTimer.unref)room.resultsTimer.unref();
  }
  function clearAttempt(room){
    endVote(room,'cancelled');
    room.survivalEpoch=null;room.eliminated=new Set();room.seenRiders=new Set();
    room.launchId=0;room.rosterLaunch=0;room.launched=false;room.gate=false;room.start=null;room.phase='lobby';
    room.lobbyRev=(room.lobbyRev||0)+1;
    for(const p of room.players.values()){p.confirmed=null;p.character=null;p.skin='';p.prepared=false;p.worldAck=false;p.phase='lobby';}
  }
  function lobbySettled(room){
    return !room.launchId&&!room.launched&&!room.start&&!room.results&&!room.gate&&room.phase==='lobby'&&[...room.players.values()].every(p=>!p.ready&&p.confirmed==null&&!p.prepared&&!p.finished);
  }
  function returnToLobby(room){
    if(lobbySettled(room)){broadcast(room,{type:'returnToLobby',rev:room.lobbyRev||0});state(room);return;}
    clearResultsTimer(room);
    room.results=null;room.lingerUntil=null;
    resetReady(room);
    clearAttempt(room);
    broadcast(room,{type:'returnToLobby',rev:room.lobbyRev||0});
    state(room);
  }
  function rosterMatches(room,roster){
    if(!Array.isArray(roster)||roster.length!==room.players.size)return false;
    const seen=new Set();
    for(const row of roster){
      const id=String(row?.id||'');
      const player=room.players.get(id);
      const character=Number(row?.characterId??row?.character);
      const skin=cleanSkin(row?.skinId??row?.skin);
      if(!player||seen.has(id)||player.confirmed!==character||skin!==(player.skin||''))return false;
      seen.add(id);
    }
    return seen.size===room.players.size;
  }
  function selectionRoster(room){
    return [...room.players.values()].map(p=>({id:p.id,name:p.name,characterId:p.confirmed,skinId:p.skin||''}));
  }
  function tryLoad(room){
    if(!room||room.phase!=='selecting'||room.start||room.results||room.players.size<2)return;
    if(![...room.players.values()].every(p=>Number.isInteger(p.confirmed)))return;
    room.phase='loading';
    for(const p of room.players.values())p.phase='loading';
    broadcast(room,{type:'loadRace',launchId:room.launchId,meta:room.meta,roster:selectionRoster(room),phase:'loading'});
    state(room);
  }
  function tryCountdown(room){
    if(!room?.launchId||room.phase!=='loading'||room.start||room.results||room.players.size<2)return;
    const players=[...room.players.values()];
    if(!players.every(p=>p.prepared&&Number.isInteger(p.confirmed)))return;
    if(room.mode==='shared'&&(room.rosterLaunch!==room.launchId||!players.every(p=>p.worldAck)))return;
    beginRace(room);
  }
  function launchRoom(room,{keepCharacters=false,reason='launch'}={}){
    if(!room.meta)throw Error('Pick a level first');
    endVote(room,'cancelled');
    clearResultsTimer(room);
    room.results=null;
    room.lingerUntil=null;
    room.launchSeq=(room.launchSeq||0)+1;
    room.launchId=room.launchSeq;
    room.rosterLaunch=0;
    room.launched=true;
    room.gate=true;
    room.phase='selecting';
    room.survivalEpoch=null;room.eliminated=new Set();room.seenRiders=new Set();
    resetReady(room);
    const rider=room.rules?.rider||null;
    for(const p of room.players.values()){
      p.phase='selecting';
      p.confirmed=rider||(keepCharacters&&Number.isInteger(p.confirmed)?p.confirmed:null);
      p.character=p.confirmed;
      p.skin=keepCharacters&&!rider?cleanSkin(p.skin):'';
      p.prepared=false;
      p.worldAck=false;
    }
    broadcast(room,{type:'launch',launchId:room.launchId,meta:room.meta,rider,reason,fresh:true,countdownMs:room.countdownMs||countdown,phase:'selecting',roster:[...room.players.values()].map(p=>({id:p.id,name:p.name,characterId:p.confirmed,skinId:p.skin||''}))});
    state(room);
    tryLoad(room);
  }
  function setPhase(ws,phase){
    if(!['lobby','loading','selecting','ingame'].includes(phase))return false;
    if(ws.phase===phase)return false;
    ws.phase=phase;return true;
  }
  function beginRace(room){const wait=room.countdownMs||countdown;room.check=false;room.results=null;room.start=Math.max(Date.now()+wait,(room.lastStart||0)+1);room.lastStart=room.start;for(const p of room.players.values()){p.lastTime=-1;p.finished=false;p.finishTime=null;}totals.racesStarted++;broadcast(room,{type:'start',at:room.start,countdownMs:wait,launchId:room.launchId||0});state(room);}
  function leave(ws){
    const room=ws.room;if(!room)return;
    const racing=!!room.start;
    const name=ws.name||'A racer';
    room.players.delete(ws.id);ws.room=null;
    endVote(room,'playersChanged');
    if(!room.players.size){clearResultsTimer(room);rooms.delete(room.code);return;}
    const selecting=room.launchId&&!room.start&&!room.results&&(room.phase==='selecting'||room.phase==='loading');
    if(selecting&&(room.hostId===ws.id||room.players.size<2)){
      const hostLeft=room.hostId===ws.id;
      if(hostLeft)room.hostId=room.players.keys().next().value;
      clearAttempt(room);
      broadcast(room,{type:'left',id:ws.id,name,racing:false});
      broadcast(room,{type:'cancel',message:hostLeft?'The host disconnected. Back in the lobby.':'Not enough players. Back in the lobby.'});
      state(room);
      return;
    }
    if(room.hostId===ws.id){room.hostId=room.players.keys().next().value;if(room.mode==='shared')cancel(room,'Host left. Shared world ended; the new host can start again.');}
    broadcast(room,{type:'left',id:ws.id,name,racing});
    state(room);
    survivalState(room,{players:[]});
    if(selecting&&room.phase==='selecting')tryLoad(room);
    else if(selecting)tryCountdown(room);
    else if(room.check&&[...room.players.values()].every(p=>p.ready)){
      if(!room.launched)launchRoom(room);
      else if(allReady(room))beginRace(room);
    }
  }
  function validMeta(m){return m&&m.protocol===core.VERSION&&typeof m.level==='string'&&/^[1-9][0-9]{0,8}$/.test(m.level)&&typeof m.hash==='string'&&/^[a-f0-9]{64}$/.test(m.hash);}
  wss.on('connection',ws=>{
    totals.connections++;
    ws.id=randomBytes(8).toString('hex');ws.room=null;ws.ready=false;ws.finished=false;ws.lastTime=-1;ws.budget=0;ws.budgetAt=Date.now();ws.alive=true;ws.phase='lobby';ws.confirmed=null;ws.prepared=false;ws.skin='';ws.worldAck=false;ws.character=null;
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
          return;
        }
        if(m.type==='status'){
          if(!ws.room)throw Error('Join a room first');
          if(!ws.room.launchId&&setPhase(ws,m.phase))state(ws.room);
          return;
        }
        if(m.type==='selectCharacter'){
          const attempt=ws.room;
          if(!attempt)throw Error('Join a room first');
          if(!attempt.launchId||m.launchId!==attempt.launchId||attempt.start||attempt.results)return;
          if(attempt.phase!=='selecting'){state(attempt);return;}
          if(!attempt.players.has(ws.id))throw Error('You are not in this race');
          const n=Number(m.characterId??m.character);
          if(!Number.isInteger(n)||n<1||n>11)throw Error('Invalid character');
          if(attempt.rules?.rider&&n!==attempt.rules.rider)throw Error('This map locks the character');
          const skin=cleanSkin(m.skinId??m.skin);
          if(ws.confirmed===n&&(ws.skin||'')===skin)return;
          ws.confirmed=n;ws.character=n;ws.skin=skin;ws.prepared=false;ws.worldAck=false;ws.phase='selected';
          state(attempt);
          tryLoad(attempt);
          return;
        }
        if(m.type==='playerPrepared'||m.type==='prepared'){
          const attempt=ws.room;
          if(!attempt)throw Error('Join a room first');
          if(!attempt.launchId||m.launchId!==attempt.launchId||attempt.start||attempt.results||attempt.phase!=='loading')return;
          if(!Number.isInteger(ws.confirmed))throw Error('Select a character first');
          const character=Number(m.characterId??m.character??ws.confirmed);
          const levelId=String(m.levelId??attempt.meta?.level??'');
          const levelHash=String(m.levelHash??attempt.meta?.hash??'');
          if(character!==ws.confirmed||levelId!==String(attempt.meta?.level||'')||levelHash!==String(attempt.meta?.hash||''))return;
          const skin=cleanSkin(m.skinId??m.skin??ws.skin);
          if(skin!==(ws.skin||''))return;
          if(attempt.mode==='shared'){
            if(!m.snapshot)return;
            if(ws.id===attempt.hostId){
              if(!rosterMatches(attempt,m.roster))throw Error('Shared roster is incomplete');
              attempt.rosterLaunch=attempt.launchId;
              broadcast(attempt,{type:'roster',launchId:attempt.launchId,players:m.roster.map(row=>({id:String(row.id),character:Number(row.character),skin:cleanSkin(row.skin)}))});
            }else if(attempt.rosterLaunch!==attempt.launchId)return;
            ws.worldAck=true;
          }
          ws.prepared=true;ws.phase='preparing';
          state(attempt);
          tryCountdown(attempt);
          return;
        }
        if(m.type==='create'||m.type==='join'){
          if(ws.room)throw Error('Leave the current room first');if(m.protocol!==core.VERSION&&m.meta?.protocol!==core.VERSION)throw Error('Unsupported game protocol');if(m.meta!=null&&!validMeta(m.meta))throw Error('Invalid level');
          let room;
          if(m.type==='create'){
            if(rooms.size>=100)throw Error('Relay is full');const code=randomBytes(8).toString('hex').toUpperCase();const capacity=Math.max(2,Math.min(16,Number.isInteger(m.capacity)?m.capacity:8));room={code,hostId:ws.id,mode:m.mode==='shared'?'shared':'ghost',capacity,collide:true,locked:false,launched:!!m.meta,gate:false,launchId:0,launchSeq:0,lobbyRev:0,rosterLaunch:0,phase:'lobby',rules:null,countdownMs:null,lingerMs:45000,lingerUntil:null,results:null,resultsTimer:null,meta:m.meta||null,pick:m.meta||null,players:new Map(),start:null,check:false};rooms.set(code,room);totals.roomsCreated++;
          }else{
            room=rooms.get(String(m.code));if(!room)throw Error('Room not found');if(room.locked)throw Error('Room is locked');if(room.start)throw Error('Race in progress');if(room.launchId&&!room.results)throw Error('Wait for the next race.');
            if(room.players.size>=(room.capacity||8))throw Error('Room is full');
          }
          endVote(room,'playersChanged');
          clearTimeout(greeting);ws.name=typeof m.name==='string'?m.name.slice(0,24):'Racer';ws.meta=m.meta;ws.confirmed=room.rules?.rider||null;ws.character=ws.confirmed;ws.skin='';ws.prepared=false;ws.worldAck=false;ws.room=room;ws.phase=room.launchId?'loading':room.launched&&room.meta&&core.compatible(room.meta,m.meta)?'ingame':room.launched&&room.meta?'loading':'lobby';room.players.set(ws.id,ws);send(ws,{type:'identity',id:ws.id});state(room);for(const p of room.players.values()){if(p!==ws&&p.avatar)send(ws,{type:'profile',id:p.id,name:p.name,avatar:p.avatar});}if(room.launchId&&room.meta)send(ws,{type:'launch',launchId:room.launchId,meta:room.meta,rider:room.rules?.rider||null,countdownMs:room.countdownMs||countdown,phase:roomPhase(room)});else if(room.launched&&room.meta&&!core.compatible(room.meta,m.meta))send(ws,{type:'travel',meta:room.meta});return;
        }
        const room=ws.room;if(!room)throw Error('Join a room first');
        if(m.type==='requestRestart'){requestRestart(room,ws,m);return;}
        if(m.type==='restartVote'){
          const vote=room.restartVote;
          if(!vote||m.id!==vote.id||m.launchId!==room.launchId||!vote.voters.has(ws.id))return;
          if(typeof m.yes!=='boolean')throw Error('Choose Yes or No');
          if(!m.yes){endVote(room,'declined');state(room);return;}
          if(!vote.yes.has(ws.id)){vote.yes.add(ws.id);state(room);acceptVote(room);}
          return;
        }
        if(m.type==='chat'){
          const text=String(m.text||'').replace(/\s+/g,' ').trim().slice(0,200);
          if(!text)return;
          const now=Date.now();
          ws.chatTimes=(ws.chatTimes||[]).filter(t=>now-t<5000);
          if(ws.chatTimes.length>=5)throw Error('Chat is limited to 5 messages every 5 seconds.');
          ws.chatTimes.push(now);
          const payload={type:'chat',id:ws.id,name:ws.name,text};
          for(const p of room.players.values())send(p,payload);
          return;
        }
        if(m.type==='profile'){
          let renamed=false;
          if(typeof m.name==='string'){
            const name=m.name.trim().slice(0,24);
            if(name&&name!==ws.name){ws.name=name;renamed=true;}
          }
          const avatar=typeof m.avatar==='string'?m.avatar.replace(/\s+/g,'').slice(0,120000):'';
          if(avatar){
            if(!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar))throw Error('Invalid profile');
            ws.avatar=avatar;
          }
          if(renamed)state(room);
          if(ws.avatar)broadcast(room,{type:'profile',id:ws.id,name:ws.name,avatar:ws.avatar},ws);
          return;
        }
        if(m.type==='mode'){
          if(ws.id!==room.hostId)throw Error('Only the host can change the mode');
          if(!['ghost','shared'].includes(m.mode))throw Error('Invalid multiplayer mode');
          if(room.start||room.check||(room.launchId&&!room.results))throw Error('Change mode before starting a ready check');
          room.mode=m.mode;resetReady(room);state(room);return;
        }
        if(m.type==='collide'){
          if(ws.id!==room.hostId)throw Error('Only the host can change bumps');
          if(room.mode!=='shared')throw Error('Bumps are only for Shared Physics');
          room.collide=!!m.on;state(room);return;
        }
        if(m.type==='authorityState'&&room.mode==='shared'&&room.launchId&&!room.start&&m.full&&m.launchId===room.launchId){
          if(room.phase!=='loading')return;
          if(ws.id!==room.hostId)throw Error('Only the host can publish the world');
          if(!authority.validateState(m,new Set(room.players.keys())))throw Error('Invalid authoritative state');
          const ids=new Set((m.players||[]).map(p=>p.id));
          if(![...room.players.keys()].every(id=>ids.has(id)))throw Error('Roster is incomplete');
          for(const row of m.players){const member=room.players.get(row.id);if(!member||member.confirmed!==row.character||(member.skin||'')!==(row.skin||''))throw Error('Roster character does not match');}
          broadcast(room,{...m,id:ws.id,launchId:room.launchId},ws);return;
        }
        if(['authorityInput','authorityRequest','authorityState'].includes(m.type)){
          if(room.mode!=='shared'||!room.start||m.epoch!==room.start||(m.launchId!=null&&m.launchId!==room.launchId))return;
          if(m.type==='authorityState'){
            if(ws.id!==room.hostId)throw Error('Only the host can publish the world');
            if(!authority.validateState(m,new Set(room.players.keys())))throw Error('Invalid authoritative state');
            if(ws.authorityEpoch===room.start&&(m.revision<ws.authorityRevision||m.revision===ws.authorityRevision&&m.tick<=ws.authorityTick))return;
            ws.authorityEpoch=room.start;ws.authorityRevision=m.revision;ws.authorityTick=m.tick;
            broadcast(room,{...m,id:ws.id,launchId:room.launchId},ws);survivalState(room,m);return;
          }
          if(ws.id===room.hostId)throw Error('Host controls stay local');
          if(!(m.type==='authorityInput'?authority.validateInput(m):authority.validateRequest(m)))throw Error('Invalid authoritative controls');
          const key=m.type==='authorityInput'?'authorityInputSeq':'authorityRequestSeq';
          if(ws.controlEpoch!==room.start){ws.controlEpoch=room.start;ws.authorityInputSeq=-1;ws.authorityRequestSeq=-1;}
          if(m.seq<=ws[key])return;ws[key]=m.seq;
          if(m.type==='authorityRequest'&&room.rules?.play==='survival'){requestRestart(room,ws,{launchId:room.launchId});return;}
          send(room.players.get(room.hostId),m.type==='authorityInput'?{type:m.type,id:ws.id,epoch:room.start,launchId:room.launchId,seq:m.seq,life:m.life,enabled:m.enabled!==false,keys:m.keys,applied:m.applied&&typeof m.applied==='object'?m.applied:undefined,recover:Array.isArray(m.recover)?m.recover.slice(0,16):undefined}:{type:m.type,id:ws.id,epoch:room.start,launchId:room.launchId,seq:m.seq,character:m.character,skin:typeof m.skin==='string'?m.skin:''});return;
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
        if(m.type==='restart'){
          if(ws.id!==room.hostId)throw Error('Only the host can reset the world');
          if(room.mode!=='shared')throw Error('Reset world is only for Shared Physics');
          if(!room.meta)throw Error('Load a level first');
          if(room.players.size<2)throw Error('Need another racer before starting');
          if(room.rules?.play==='survival'&&(room.start||room.results)){requestRestart(room,ws,{launchId:room.launchId});return;}
          if(m.meta&&validMeta(m.meta)&&core.compatible(room.meta,m.meta))room.meta=m.meta;
          launchRoom(room);
          return;
        }
        if(m.type==='pick'){
          if(ws.id!==room.hostId)throw Error('Only the host can pick a level');
          if(!validMeta(m.meta))throw Error('Load a published level first');
          const rules=cleanRules(m.rules);
          if(rules.seats&&room.players.size>rules.seats)throw Error('Too many players for this map');
          clearResultsTimer(room);
          room.results=null;room.lingerUntil=null;room.rules=rules;
          room.countdownMs=rules.waitSec?rules.waitSec*1000:null;
          room.lingerMs=rules.lingerMs||45000;
          if(rules.seats)room.capacity=rules.seats;
          const picked={protocol:m.meta.protocol,level:m.meta.level,hash:m.meta.hash,title:String(m.meta.title||'').slice(0,80),author:String(m.meta.author||'').slice(0,40)};
          room.meta=picked;room.pick=picked;ws.meta=picked;
          resetReady(room);
          clearAttempt(room);
          state(room);
          return;
        }
        if(m.type==='returnToLobby'){
          if(ws.id!==room.hostId)throw Error('Only the host can return everyone to the lobby');
          returnToLobby(room);
          return;
        }
        if(m.type==='launch'||m.type==='again'){
          if(ws.id!==room.hostId)throw Error('Only the host can start the level');
          if(!room.meta)throw Error('Pick a level first');
          if(room.players.size<2)throw Error('Need another racer before starting');
          if(room.rules?.play==='survival'&&(room.start||room.results)){requestRestart(room,ws,{launchId:room.launchId});return;}
          if(!room.results&&!room.launched&&!allLobbyReady(room))throw Error('Wait for everyone to ready up');
          launchRoom(room);
          return;
        }
        if(m.type==='kick'){
          if(ws.id!==room.hostId)throw Error('Only the host can remove a player');
          const target=room.players.get(String(m.id||''));
          if(!target||target===ws)throw Error('That player is not in the room');
          send(target,{type:'kicked',message:'The host removed you from the room.'});
          target.close(4000,'Kicked');
          return;
        }
        if(m.type==='promote'){
          if(ws.id!==room.hostId)throw Error('Only the host can hand off the room');
          const target=room.players.get(String(m.id||''));
          if(!target||target===ws)throw Error('That player is not in the room');
          if(room.start||(room.launchId&&!room.results))throw Error('Hand off the room from the lobby');
          room.hostId=target.id;
          state(room);
          return;
        }
        if(m.type==='lock'){
          if(ws.id!==room.hostId)throw Error('Only the host can lock the room');
          room.locked=!!m.on;
          state(room);
          return;
        }
        if(m.type==='summon'){
          if(ws.id!==room.hostId)throw Error('Only the host can bring everyone to a level');
          if(!validMeta(m.meta))throw Error('Load a published level first');
          if(room.rules?.play==='survival'&&core.compatible(room.meta,m.meta)&&(room.start||room.results)){requestRestart(room,ws,{launchId:room.launchId});return;}
          if(!core.compatible(room.meta,m.meta)){
            const rules=cleanRules(m.rules);
            if(rules.seats&&room.players.size>rules.seats)throw Error('Too many players for this map');
            room.rules=rules;room.countdownMs=rules.waitSec?rules.waitSec*1000:null;room.lingerMs=rules.lingerMs||45000;
            if(rules.seats)room.capacity=rules.seats;
          }
          room.meta=m.meta;room.pick=m.meta;ws.meta=m.meta;
          launchRoom(room);
          return;
        }
        if(m.type==='level'){
          if(!validMeta(m.meta))throw Error('Invalid level');
          if(room.launchId){
            if(room.meta&&core.compatible(room.meta,m.meta)){ws.meta=m.meta;state(room);}
            return;
          }
          if(room.start&&room.meta&&!core.compatible(room.meta,m.meta)){cancel(room,'Level changed. All racers must ready up again.');return;}
          if(room.meta&&core.compatible(room.meta,m.meta)){ws.meta=m.meta;ws.phase='ingame';state(room);return;}
          state(room);
          return;
        }
        if(m.type==='ready'){
          if(!room.meta||!validMeta(m.meta)||!core.compatible(room.meta,m.meta))throw Error('Level does not match this room');
          if(!room.launched){
            if(ws.id===room.hostId){
              if(room.players.size<2)throw Error('Need another racer before starting');
              resetReady(room);room.check=true;ws.ready=true;ws.meta=m.meta;state(room);
              broadcast(room,{type:'readyCheck',name:ws.name,meta:room.meta});
              return;
            }
            if(!room.check)throw Error('Wait for the host to ask if everyone is ready');
            if(room.start)throw Error('Race already starting');
            ws.ready=true;ws.meta=m.meta;state(room);
            if(allLobbyReady(room))launchRoom(room);
            return;
          }
          if(room.launchId)throw Error('The race starts when everyone has finished loading');
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
          if(!room.start||room.mode==='shared'||(room.launchId&&m.launchId!==room.launchId))return;
          if(!core.validFrame(m.frame)||!Array.isArray(m.textures)||m.textures.length>4096||!m.textures.every(core.validTexture)||m.frame.parts.some(p=>p[1]>=m.textures.length))return;
          if(m.frame.t<ws.lastTime)return;ws.lastTime=m.frame.t;broadcast(room,{type:'frame',launchId:room.launchId||0,id:ws.id,frame:m.frame,textures:m.textures},ws);survivalState(room,{players:[{id:ws.id,dead:!!m.frame.dead}]});return;
        }
        if(m.type==='finish'){
          if(room.rules?.play==='survival')return;
          if(m.launchId!=null&&m.launchId!==room.launchId)return;
          if(!room.start||(room.launchId&&m.launchId!==room.launchId)||ws.finished||typeof m.time!=='number'||!Number.isFinite(m.time)||m.time<0||m.time>Date.now()-room.start+2000)throw Error('Invalid finish');
          ws.finished=true;ws.finishTime=m.time;totals.finishes++;broadcast(room,{type:'finish',launchId:room.launchId||0,id:ws.id,name:ws.name,time:m.time});
          if([...room.players.values()].every(p=>p.finished))publishResults(room);
          else armResults(room);
          return;
        }
        throw Error('Unknown message');
      }catch(e){send(ws,{type:'error',message:e.message});}
    });
  });
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);heartbeat.unref();
  wss.on('close',()=>clearInterval(heartbeat));
  http.listen(port,host);
  return {wss,http,rooms,close:()=>new Promise(resolve=>{for(const room of rooms.values()){clearResultsTimer(room);endVote(room,'cancelled');}for(const ws of wss.clients)ws.terminate();wss.close(()=>http.close(resolve));})};
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
