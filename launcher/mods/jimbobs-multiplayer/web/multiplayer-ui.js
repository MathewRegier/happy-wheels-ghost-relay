(() => {
  'use strict';
  window.HWMultiplayerUI=(lab,actions)=>{
    const config=window.HWGhostConfig;
    const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
    const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
    let opened=false,tab='join',lastPlayers='',lastCode=null,lastStart=null,goUntil=0,lastToast='',toastUntil=0;
    const screen=document.createElement('section');screen.id='hw-multiplayer';screen.hidden=true;
    screen.setAttribute('aria-label','Multiplayer');
    screen.innerHTML=`<style>
      #hw-multiplayer{position:fixed;inset:0;z-index:9999;background:radial-gradient(ellipse at 20% 0%,#32434d,#172127 75%);color:#f2eee3;overflow:auto;font:17px/1.45 Georgia,serif;box-sizing:border-box;padding:clamp(20px,5vh,56px) max(24px,calc((100vw - 800px)/2))}
      #hw-multiplayer[hidden],#hw-mp-access[hidden]{display:none!important}
      #hw-multiplayer *{box-sizing:border-box}#hw-multiplayer h1{font:clamp(32px,6vw,58px)/1.1 'Clarendon LT Std Bold',Georgia,serif;color:#fd8081;margin:0 0 12px;text-shadow:0 3px 2px #0008}
      #hw-multiplayer .eyebrow{font:12px/1.4 Georgia,serif;letter-spacing:3px;text-transform:uppercase;color:#b4c5cd;margin:0 0 8px}
      #hw-multiplayer button,#hw-multiplayer input{font:inherit}#hw-multiplayer button{cursor:pointer;border:1px solid #6c8793;background:transparent;color:#bce0f3;padding:9px 18px;border-radius:2px}#hw-multiplayer button:hover{background:#314551}#hw-multiplayer button:focus-visible,#hw-multiplayer input:focus-visible{outline:2px solid #fd8081;outline-offset:3px}#hw-multiplayer button:disabled{opacity:.45;cursor:default}
      #hw-multiplayer .primary{background:#a4d8ef;color:#16222a;border-color:#a4d8ef}#hw-multiplayer .primary:hover{background:#d0ecf8}#hw-multiplayer .back{float:right;border:0;padding:5px;color:#ddd5c7}#hw-multiplayer .tabs{display:flex;gap:24px;border-bottom:1px solid #60717a;margin:30px 0 24px}#hw-multiplayer .tabs button{border:0;border-bottom:3px solid transparent;border-radius:0;padding:10px 4px;font-size:23px;color:#b5bfc3}#hw-multiplayer .tabs button[aria-selected=true]{color:#fd8081;border-bottom-color:#fd8081}
      #hw-multiplayer input{width:100%;background:#101b21;border:1px solid #657d89;color:#fff;padding:12px;margin:7px 0 16px}#hw-multiplayer #mp-code{text-transform:uppercase;letter-spacing:2px}#hw-multiplayer label{display:block;color:#ddd5c7}#hw-multiplayer p{margin:12px 0 20px}#hw-multiplayer .muted{color:#b4c5cd;font-size:15px}#hw-multiplayer .actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}#hw-multiplayer #mp-status{min-height:24px;color:#e8d7bc;margin:18px 0;font-size:16px}#hw-multiplayer details{border-top:1px solid #465b65;margin-top:26px;padding-top:14px;color:#b4c5cd;font-size:15px}#hw-multiplayer summary{cursor:pointer}#hw-multiplayer details label{margin-top:12px}#hw-multiplayer .room-code{font:clamp(18px,4vw,30px)/1.4 Georgia,serif;letter-spacing:2px;color:#fff;user-select:all}#hw-multiplayer ul{list-style:none;padding:0;margin:20px 0}#hw-multiplayer li{display:flex;justify-content:space-between;gap:15px;border-bottom:1px solid #40545e;padding:10px 0}#hw-multiplayer li span:last-child{color:#a4d8ef;font-size:14px}#hw-multiplayer [hidden]{display:none!important}
      #hw-mp-access{position:fixed;right:14px;top:12px;z-index:9998;border:1px solid #758895;background:#1c2930ed;color:#fd8081;padding:9px 16px;font:17px Georgia,serif;cursor:pointer}#hw-mp-toast{pointer-events:none;position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9998;background:#172127e8;color:#f5e8d2;padding:8px 15px;font:16px Georgia,serif;max-width:80%;text-align:center}#hw-mp-toast:empty{display:none}#hw-mp-count{pointer-events:none;position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;font:900 clamp(96px,18vw,180px)/1 Georgia,serif;color:#fd8081;text-shadow:0 6px 0 #0008,0 0 40px #000a;letter-spacing:4px}#hw-mp-count[hidden]{display:none!important}#hw-mp-count.go{color:#a4d8ef;font-size:clamp(72px,14vw,140px)}
      #hw-mp-readyask{position:fixed;inset:0;z-index:10003;display:flex;align-items:center;justify-content:center;background:#0b1216c4;color:#f2eee3;font:18px/1.45 Georgia,serif;padding:24px}
      #hw-mp-readyask[hidden]{display:none!important}
      #hw-mp-readyask .card{width:min(420px,92vw);background:#172127;border:1px solid #6c8793;padding:28px 24px 22px;text-align:center;box-shadow:0 16px 40px #000a}
      #hw-mp-readyask h2{margin:0 0 10px;font:clamp(28px,5vw,40px)/1.1 Georgia,serif;color:#fd8081}
      #hw-mp-readyask p{margin:0 0 20px;color:#ddd5c7}
      #hw-mp-readyask .actions{display:flex;justify-content:center;flex-wrap:wrap;gap:10px}
      #hw-mp-readyask button{font:inherit;cursor:pointer;border:1px solid #6c8793;background:transparent;color:#bce0f3;padding:9px 18px}
      #hw-mp-readyask .primary{background:#a4d8ef;color:#16222a;border-color:#a4d8ef}
    </style>
    <button class="back" id="mp-back">Back</button><p class="eyebrow">Jimbob's Multiplayer Mod · v${config.version||'0.2.3'}</p><h1>Multiplayer</h1>
    <p class="muted">Created by Jimbob · Discord jimbob1111</p>
    <div id="mp-entry"><label for="mp-name">Your name</label><input id="mp-name" maxlength="24" autocomplete="nickname" spellcheck="false" placeholder="Racer">
    <div class="tabs" role="tablist" aria-label="Room options"><button id="mp-join-tab" role="tab" aria-selected="true">Join</button><button id="mp-host-tab" role="tab" aria-selected="false">Host</button></div>
    <form id="mp-join"><label for="mp-code">Enter room ID</label><input id="mp-code" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Room code from your friend"><button class="primary" id="mp-connect" type="submit">Connect</button></form>
    <div id="mp-host" hidden><p>Create a room and send the code to your friends.<br>You can choose a level after everyone joins.</p><div class="actions"><button class="primary" id="mp-create">Create room</button></div></div></div>
    <div id="mp-lobby" hidden><p class="muted">Your room code</p><div class="room-code" id="mp-room-code"></div><button id="mp-copy">Copy code</button><ul id="mp-players" aria-label="Players"></ul><p id="mp-level" class="muted"></p><div class="actions"><button id="mp-choose">Choose a level</button><button id="mp-summon" class="primary">Bring everyone to my level</button><button id="mp-ready" class="primary">Ready</button><button id="mp-not-ready">Not yet</button><button id="mp-leave">Leave room</button></div></div>
    <p id="mp-status" role="status" aria-live="polite"></p>
    <details id="mp-settings"><summary>Server settings</summary><label for="mp-server">Server address</label><input id="mp-server" spellcheck="false"><div class="actions"><button id="mp-save">Save</button><button id="mp-reset">Use default server</button><button id="mp-local">Test localhost</button><button id="mp-second-settings">Open second window</button></div><p class="muted">Test localhost uses ws://127.0.0.1:19799 after you start the local relay. Open second window starts another game on this computer so you can join your own room.</p></details>`;
    const ask=document.createElement('section');ask.id='hw-mp-readyask';ask.hidden=true;ask.setAttribute('aria-label','Ready check');
    ask.innerHTML=`<div class="card"><h2>Ready?</h2><p id="mp-ready-copy">The host is ready. Are you ready to race?</p><div class="actions"><button class="primary" id="mp-ready-yes">Yes</button><button id="mp-ready-no">Not yet</button></div></div>`;
    const access=document.createElement('button');access.id='hw-mp-access';access.textContent='Multiplayer';access.hidden=true;access.tabIndex=-1;
    const toast=document.createElement('div');toast.id='hw-mp-toast';
    const count=document.createElement('div');count.id='hw-mp-count';count.hidden=true;count.setAttribute('aria-live','assertive');
    const hud=document.createElement('div');hud.id='hw-mp-hud';hud.hidden=true;hud.innerHTML=`<style>
      #hw-mp-hud{pointer-events:none;position:fixed;inset:0;z-index:9996;font:14px/1.2 Georgia,serif;color:#f3ead6}
      #hw-mp-board{pointer-events:auto}
      #hw-mp-hud[hidden]{display:none!important}
      #hw-mp-board{position:absolute;top:12px;left:12px;min-width:220px;background:#121916e6;border:1px solid #3b4a44;box-shadow:0 8px 24px #0008;padding:10px 12px 8px}
      #hw-mp-board .stamp{display:inline-block;border:1px solid #fd7f7c;color:#fd7f7c;font:700 10px/1 Georgia,serif;letter-spacing:.16em;text-transform:uppercase;padding:3px 6px;margin-bottom:8px}
      #hw-mp-board table{width:100%;border-collapse:collapse}
      #hw-mp-board th{font:700 10px/1 Georgia,serif;letter-spacing:.08em;text-transform:uppercase;color:#8b968e;text-align:left;padding:0 8px 6px 0}
      #hw-mp-board th:nth-child(2),#hw-mp-board th:nth-child(3),#hw-mp-board td:nth-child(2),#hw-mp-board td:nth-child(3){text-align:right}
      #hw-mp-board td{padding:4px 8px 4px 0;border-top:1px solid #2a3530;white-space:nowrap}
      #hw-mp-board tbody tr{cursor:pointer}
      #hw-mp-board tbody tr:hover td{color:#fd7f7c}
      #hw-mp-board .watching td{color:#a4d8ef}
      #hw-mp-spec{margin-top:8px;color:#9aa79e;font:11px/1.3 Georgia,serif}
      #hw-mp-board .you{color:#c8e6c0}
      #hw-mp-board .dead{color:#fd7f7c}
      #hw-mp-track{position:absolute;left:8%;right:8%;bottom:18px;height:54px}
      #hw-mp-track .rail{position:absolute;left:0;right:0;top:32px;height:8px;background:linear-gradient(90deg,#1a2320,#3b4a44 12%,#fd7f7c 92%,#f3ead6);border:1px solid #2a3530;box-shadow:inset 0 1px 0 #fff2}
      #hw-mp-track .racer{position:absolute;top:0;transform:translateX(-50%);text-align:center;width:72px}
      #hw-mp-track .tag{display:block;font:700 11px/1 Georgia,serif;text-shadow:0 1px 0 #000,1px 0 0 #000,-1px 0 0 #000,0 -1px 0 #000;margin-bottom:3px;white-space:nowrap}
      #hw-mp-track .head{display:inline-block;width:22px;height:22px;border-radius:50%;border:2px solid #f3ead6;box-shadow:0 0 0 1px #0008,0 2px 6px #0008;opacity:.78;position:relative}
      #hw-mp-track .head:after{content:"";position:absolute;left:6px;top:5px;width:8px;height:6px;border-radius:50%;background:#fff6}
      #hw-mp-track .you .head{opacity:1;box-shadow:0 0 0 2px #fd7f7c,0 2px 6px #0008}
    </style><aside id="hw-mp-board" aria-label="Race scoreboard"><div class="stamp">Live board</div><table><thead><tr><th>Racer</th><th>Died</th><th>Best</th></tr></thead><tbody></tbody></table><p class="spec" id="hw-mp-spec" hidden></p></aside><div id="hw-mp-track" aria-label="Race progress"><div class="rail"></div><div class="markers"></div></div>`;
    document.body.append(screen,access,toast,count,hud,ask);
    function hueFor(id){let h=0;for(const ch of String(id||''))h=ch.charCodeAt(0)+((h<<5)-h);return Math.abs(h)%360;}
    function paintHud(){
      const board=lab.raceBoard?.();
      const racing=!!board?.racing&&!!board.players?.length;
      hud.hidden=!racing||opened;
      if(!racing)return;
      const rows=[...board.players].sort((a,b)=>(b.best-a.best)||(a.deaths-b.deaths)||a.name.localeCompare(b.name));
      const body=hud.querySelector('#hw-mp-board tbody');
      body.replaceChildren(...rows.map(p=>{
        const tr=document.createElement('tr');
        if(p.id===board.spectateId)tr.className='watching';
        tr.innerHTML=`<td class="${p.you?'you':''}${p.dead?' dead':''}">${p.name}${p.you?' (you)':''}${p.finished?' · in':''}</td><td>${p.deaths}</td><td>${Math.round((p.best||0)*100)}%</td>`;
        tr.onclick=()=>lab.spectatePlayer?.(p.id);
        return tr;
      }));
      const spec=hud.querySelector('#hw-mp-spec');
      spec.hidden=!board.spectating;
      spec.textContent=board.spectating?(board.spectateName==='yourself'?'Watching yourself · [ ] cycle · click a name · R respawn':board.spectateName?'Spectating '+board.spectateName+' · [ ] cycle · click your name to return':'Finished · click a racer or press [ ] to spectate'):'';
      const markers=hud.querySelector('#hw-mp-track .markers');
      markers.replaceChildren(...rows.map((p,i)=>{
        const node=document.createElement('div');
        node.className='racer'+(p.you?' you':'');
        const pct=Math.max(0,Math.min(1,p.progress||0))*100;
        node.style.left=pct+'%';
        node.style.zIndex=String(20+i);
        node.style.top=i%2?'6px':'0';
        const color=`hsl(${hueFor(p.id)} 58% 62%)`;
        node.innerHTML=`<span class="tag">${p.name}</span><span class="head" style="background:${color}"></span>`;
        return node;
      }));
    }
    const el=id=>screen.querySelector('#mp-'+id);
    const localRelayUrl='ws://127.0.0.1:19799';
    const railwayUrl=config.defaultRelayUrl||'wss://web-production-79ef3.up.railway.app';
    const savedServer=read('hw-mp-server','');
    el('server').value=!savedServer||/^wss?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(savedServer)?railwayUrl:savedServer;
    el('name').value=read('hw-mp-name','Racer');
    const run=fn=>async e=>{e?.preventDefault();try{await fn();}catch(err){actions.message(err.message||String(err));}refresh();};
    function playerName(){const name=el('name').value.trim().slice(0,24)||'Racer';el('name').value=name;save('hw-mp-name',name);return name;}
    function open(){opened=true;screen.hidden=false;refresh();if(!lab.lobby().room)el('name').focus();}
    function close(){opened=false;screen.hidden=true;document.activeElement?.blur();refresh();}
    function select(value){tab=value;el('join').hidden=tab!=='join';el('host').hidden=tab!=='host';el('join-tab').setAttribute('aria-selected',tab==='join');el('host-tab').setAttribute('aria-selected',tab==='host');}
    function connect(code){actions.message('Connecting\u2026');actions.connect(el('server').value.trim(),code,playerName());}
    el('join-tab').onclick=()=>select('join');el('host-tab').onclick=()=>select('host');
    el('join').onsubmit=run(()=>{const code=el('code').value.trim();if(!/^[a-f0-9]{16}$/i.test(code))throw Error('Enter the 16-character room code from your friend.');connect(code);});
    el('create').onclick=run(()=>connect(''));
    el('back').onclick=close;access.onclick=open;
    el('leave').onclick=run(()=>{actions.leave();lastCode=null;select('join');});
    function hideReadyAsk(){ask.hidden=true;}
    function hideForLevel(){opened=false;screen.hidden=true;document.activeElement?.blur();}
    function askReady(name){ask.querySelector('#mp-ready-copy').textContent=(name||'The host')+' is ready. Are you ready to race?';ask.hidden=false;}
    el('ready').onclick=run(()=>{
      if(lab.lobby().isHost)actions.ready();
      else (actions.readyVote||actions.ready)(true);
      close();
    });
    el('not-ready').onclick=run(()=>{actions.readyVote?.(false);close();});
    el('summon').onclick=run(actions.summon);
    ask.querySelector('#mp-ready-yes').onclick=run(()=>{hideReadyAsk();(actions.readyVote||actions.ready)(true);});
    ask.querySelector('#mp-ready-no').onclick=run(()=>{hideReadyAsk();actions.readyVote?.(false);});
    el('choose').onclick=run(()=>{const hw=lab.state.rootApp.screenManager.currentScreen?.happyWheels;if(!hw)throw Error('Wait for the game to load.');if(hw.sessionController)hw.closeSessionController();else if(!hw.mainMenu)hw.openMainMenu();close();});
    el('copy').onclick=run(async()=>{const code=lab.lobby().room?.code;if(!code)return;try{await navigator.clipboard.writeText(code);}catch{const input=document.createElement('textarea');input.value=code;screen.append(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw Error('Select the room code and press Ctrl+C to copy.');}actions.message('Room code copied. Send it to your friends.');});
    el('name').addEventListener('change',()=>playerName());
    el('save').onclick=run(()=>{const url=new URL(el('server').value.trim());if(!['ws:','wss:'].includes(url.protocol))throw Error('Use a ws:// or wss:// server address.');save('hw-mp-server',url.href);save('hw-mp-name',playerName());el('settings').open=false;actions.message('Settings saved. They apply to your next connection.');});
    el('reset').onclick=()=>{el('server').value=railwayUrl;save('hw-mp-server',railwayUrl);};
    el('local').onclick=run(()=>{el('server').value=localRelayUrl;actions.message('Using local test server '+localRelayUrl+' for this session. Start the local relay first.');});
    const openSecond=run(async()=>{if(!actions.openSecond)throw Error('Second window is not available.');await actions.openSecond();actions.message('Second window opened. Join this room from that window.');});
    el('second-settings').onclick=openSecond;
    function typing(el){const tag=(el?.tagName||'').toLowerCase();return tag==='input'||tag==='textarea';}
    for(const event of ['keydown','keyup'])window.addEventListener(event,e=>{
      if(!opened){
        if(event==='keydown'&&!typing(e.target)){
          if(document.activeElement&&(screen.contains(document.activeElement)||document.activeElement===access))document.activeElement.blur();
          if(e.defaultPrevented)return;
          if(e.code==='KeyR'){lab.onLocalRestart?.();return;}
          if(e.key==='Escape'){lab.allowGameMenu?.();return;}
          if(e.key==='['||e.key===']'){e.preventDefault();e.stopImmediatePropagation();lab.cycleSpectate?.(e.key===']');}
        }
        return;
      }
      if(e.key==='Escape'){e.preventDefault();close();}
      e.stopImmediatePropagation();
    },true);
    // Reuse the game's own button class, typography, hover animation and layout list.
    function nodeVisible(node){
      if(!node)return false;
      if(node.visible===false||node.alpha===0)return false;
      if(typeof node.worldVisible==='boolean'&&!node.worldVisible)return false;
      return true;
    }
    function collectTexts(node,out,depth,seen){
      if(!node||depth>8||seen.has(node)||!nodeVisible(node))return;
      seen.add(node);
      const text=node.text??node.textField?.text??node.label;
      if(text)out.push(String(text).replace(/\s+/g,' ').trim());
      for(const child of node.children||[])collectTexts(child,out,depth+1,seen);
      if(node.pixiSprite)collectTexts(node.pixiSprite,out,depth+1,seen);
      if(node.textField)collectTexts(node.textField,out,depth+1,seen);
    }
    function explorerOpen(hw){
      const texts=[];
      try{
        collectTexts(hw,texts,0,new Set());
        collectTexts(lab.state.rootApp?.stage,texts,0,new Set());
      }catch{}
      return texts.some(text=>/featured\s*levels?|user\s*levels?|level\s*browser|play\s*now|view\s*level\s*replay/i.test(text));
    }
    function isTitleMenu(){
      const hw=lab.state.rootApp.screenManager.currentScreen?.happyWheels;
      const menu=hw?.mainMenu;
      if(!menu?.optionsBtn)return false;
      if(hw.sessionController)return false;
      const session=lab.state.currentSession;
      if(session&&!session.isMenu&&(session.m_world||session.containerSprite))return false;
      if(!nodeVisible(menu)||!nodeVisible(menu.optionsBtn)||!nodeVisible(menu.optionsBtn.pixiSprite||menu.pixiSprite))return false;
      if(explorerOpen(hw))return false;
      try{
        for(const [key,val] of Object.entries(hw)){
          if(!val||val===menu)continue;
          if(/browser|Browser|Selector|selector|featured|Featured|userLevel|levelList|searchMenu|levelMenu|levelExplorer/i.test(key)&&nodeVisible(val))return false;
        }
        for(const child of hw.children||[]){
          if(!child||child===menu||child===menu.pixiSprite||!nodeVisible(child))continue;
          const name=String(child.name||child.constructor?.name||'');
          if(/browser|featured|selector|userlevel|levelmenu|explorer/i.test(name))return false;
        }
      }catch{}
      return true;
    }
    function showMenuButton(button,on){
      if(!button)return;
      for(const node of [button,button.pixiSprite,button.textField,button.textField?.pixiSprite]){
        if(!node)continue;
        try{node.visible=on;}catch{}
        try{node.renderable=on;}catch{}
        try{node.alpha=on?1:0;}catch{}
      }
      try{button.interactive=on;}catch{}
      try{button.eventMode=on?'static':'none';}catch{}
    }
    function placeMenuButton(menu,on){
      const button=menu.multiplayerBtn;
      if(!button)return;
      const list=menu.buttons;
      const index=list?list.indexOf(button):-1;
      if(on){
        if(list&&index<0){
          const at=list.indexOf(menu.optionsBtn);
          list.splice(at<0?list.length:at,0,button);
          menu.spaceHeight=(menu.spaceHeight||0)+(menu.buttonSpacing||0);
          try{menu.organizeButtons();}catch{}
        }
        showMenuButton(button,true);
        button.x=menu.optionsBtn.x;
      }else{
        if(list&&index>=0){
          list.splice(index,1);
          menu.spaceHeight=Math.max(0,(menu.spaceHeight||0)-(menu.buttonSpacing||0));
          try{menu.organizeButtons();}catch{}
        }
        showMenuButton(button,false);
      }
    }
    function installMenu(){
      const menu=lab.state.rootApp.screenManager.currentScreen?.happyWheels?.mainMenu;
      if(!menu?.optionsBtn)return;
      const onTitle=isTitleMenu();
      if(menu.multiplayerBtn){
        placeMenuButton(menu,onTitle);
        return;
      }
      if(!onTitle)return;
      const reference=menu.optionsBtn,format=reference.textField.defaultTextFormat;
      const button=new reference.constructor('MULTIPLAYER',format.size,format.color);
      button.x=reference.x;button.addEventListener('click',open);
      menu.multiplayerBtn=button;menu.addChild(button);menu.buttons.splice(menu.buttons.indexOf(reference),0,button);
      menu.spaceHeight+=menu.buttonSpacing;menu.organizeButtons();
    }
    function refresh(){
      const s=lab.lobby(),room=s.room,host=room?.hostId===s.selfId;
      el('entry').hidden=!!room;el('lobby').hidden=!room;
      el('connect').disabled=s.connecting;el('create').disabled=s.connecting;
      el('status').textContent=s.status||'';
      el('settings').hidden=false;
      if(!room)hideReadyAsk();
      if(room){
        el('room-code').textContent=room.code;
        const players=JSON.stringify(room.players)+s.phase+s.allInGame;if(players!==lastPlayers){lastPlayers=players;el('players').replaceChildren(...room.players.map(p=>{const li=document.createElement('li'),name=document.createElement('span'),state=document.createElement('span');name.textContent=p.name+(p.id===s.selfId?' (you)':'');const phase=p.id===s.selfId?s.phase:p.phase;const step=!room.meta?'In lobby':phase==='ingame'||p.loaded?'On level':phase==='loading'?'Loading':'Selecting character';state.textContent=[p.id===room.hostId?'Host':'',p.ready?'Ready':'',step].filter(Boolean).join(' \u00b7 ');li.append(name,state);return li;}));}
        el('level').textContent=s.link||(room.meta?'Room level: '+room.meta.level:'No level selected yet.');
        el('choose').hidden=!host;el('summon').hidden=!host;el('summon').disabled=!s.inLevel||s.loading;
        el('ready').hidden=!!s.raceStart;
        el('ready').disabled=host?(!s.canReady||s.ready):(!s.canVoteReady||s.ready);
        el('ready').textContent=s.ready?'Waiting for players\u2026':(host&&!s.allInGame?'Waiting for characters':'Ready');
        el('not-ready').hidden=host||!!s.raceStart||s.ready;
        el('not-ready').disabled=!(s.canDecline||s.canVoteReady);
        const hostPlayer=room.players.find(p=>p.id===room.hostId);
        if(!host&&!s.ready&&!s.raceStart&&(s.readyCheck||s.checking))askReady(hostPlayer?.name);
        else if(host||s.ready||s.raceStart||!(s.readyCheck||s.checking))hideReadyAsk();
        if(lastCode!==room.code){lastCode=room.code;if(s.phase!=='selecting'&&s.phase!=='loading')open();return;}
        if(opened&&(s.phase==='selecting'||s.phase==='loading'))hideForLevel();
      }
      access.hidden=opened||isTitleMenu()||s.phase==='selecting'||s.phase==='loading';
      const status=s.status||'';
      if(status&&status!==lastToast){lastToast=status;toastUntil=Date.now()+3500;}
      toast.textContent=!opened&&room&&status&&Date.now()<toastUntil&&!/^Race countdown:/.test(status)?status:'';
      const start=s.raceStart;const started=start&&start!==lastStart;lastStart=start;if(started)close();
      if(start&&!s.released&&s.remaining!=null){
        count.hidden=false;
        if(s.remaining>80){count.classList.remove('go');count.textContent=String(Math.max(1,Math.ceil(s.remaining/1000)));}
        else{count.classList.add('go');count.textContent='GO';goUntil=Date.now()+800;}
      }else if(Date.now()<goUntil){count.hidden=false;count.classList.add('go');count.textContent='GO';}
      else if(!count.hidden){count.hidden=true;count.textContent='';count.classList.remove('go');}
      paintHud();
    }
    setInterval(()=>{try{installMenu();refresh();}catch(e){if(lab.errors.length<30)lab.errors.push('Multiplayer menu: '+e.message);}},200);
    return {open,close,refresh,askReady,hideReadyAsk,hideForLevel};
  };
})();
