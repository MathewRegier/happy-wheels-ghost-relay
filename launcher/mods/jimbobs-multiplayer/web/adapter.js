(() => {
  'use strict';
  const boot=setInterval(()=>{
    const lab=window.HWGhost;
    if(!lab?.state?.rootApp?.renderer||!window.HWGhostCore||lab.installed)return;
    clearInterval(boot);lab.installed=true;initialize(lab);
  },100);
  function initialize(lab){
    const core=window.HWGhostCore,p=lab.require(99430);
    const Container=p.mcf,Sprite=p.kxk,Texture=p.gPd,Matrix=p.uqu,Rectangle=p.M_G;
    const app=lab.state.rootApp;
    let session=null,meta=null,recording=null,saved=null,playback=null,network=null;
    let ids=new WeakMap(),nextId=0,textureIds=new WeakMap(),textures=[],lastCapture=-1,lastIteration=-1;
    let sessionStart=0,lastFrame=null,room=null,ready=false,raceStart=null,released=false,clockOffset=0,finishSent=false,networkAt=0,lastSentAt=0,socketEpoch=0;
    let deaths=0,sawDead=false,bestProgress=0,liveProgress=0,trackBounds=null,spectateId=null,finishedRace=false,wantMenu=false,chromeSnapshot=null,hiddenChrome=[],readyCheck=false,lastShareKey='',lastShareAt=0,travelLock=null,travelAt=0,hostReadyAt=0,askSuppressAt=0,lastHostReady=false,lastChecking=false,pendingDecline=false,pendingStatus=false,lastPhase='',lastPresenceKey='',lastMapKey='';
    const peers=new Map(),textureLoad=new Map(),localSprites=new Map(),levelHashes=new Map();
    let pendingAction=null,recordedBytes=0,selfId=null,travelTarget=null,ui=null;
    const layer=new Container();layer.name="Jimbob's Multiplayer visuals";layer.interactiveChildren=false;app.stage.addChild(layer);
    const localGroup=new Container();layer.addChild(localGroup);
    if(!document.getElementById('hw-mp-tag-style')){
      const style=document.createElement('style');style.id='hw-mp-tag-style';
      style.textContent='#hw-mp-tags{position:fixed;inset:0;pointer-events:none;z-index:9997}.hw-mp-tag{position:absolute;transform:translate(-50%,-100%);font:700 15px/1.15 Georgia,serif;color:#f7efe0;text-shadow:0 1px 0 #000,1px 0 0 #000,-1px 0 0 #000,0 -1px 0 #000,0 0 6px #000a;white-space:nowrap;letter-spacing:.2px}';
      document.head.appendChild(style);
    }
    const tags=document.createElement('div');tags.id='hw-mp-tags';document.body.appendChild(tags);
    function playerName(id){return String(room?.players?.find(p=>p.id===id)?.name||'Racer').slice(0,24);}
    function ensureTag(peer,id){
      if(!peer.tag){peer.tag=document.createElement('div');peer.tag.className='hw-mp-tag';peer.tag.hidden=true;tags.appendChild(peer.tag);}
      const name=playerName(id);if(peer.tag.textContent!==name)peer.tag.textContent=name;
    }
    function placeTag(peer){
      if(!peer.tag||!peer.group.visible||!layer.visible){if(peer.tag)peer.tag.hidden=true;return;}
      let minX=Infinity,maxX=-Infinity,minY=Infinity,any=false;
      for(const sprite of peer.sprites.values()){
        if(!sprite.visible)continue;
        const b=sprite.getBounds(true);
        if(!(b.width||b.height))continue;
        minX=Math.min(minX,b.x);maxX=Math.max(maxX,b.x+b.width);minY=Math.min(minY,b.y);any=true;
      }
      if(!any){peer.tag.hidden=true;return;}
      const view=app.renderer.view||app.view,rect=view.getBoundingClientRect();
      const sw=app.renderer.screen?.width||app.renderer.width||rect.width;
      const sh=app.renderer.screen?.height||app.renderer.height||rect.height;
      peer.tag.hidden=false;
      peer.tag.style.left=Math.round(rect.left+((minX+maxX)/2)*(rect.width/sw))+'px';
      peer.tag.style.top=Math.round(rect.top+minY*(rect.height/sh)-8)+'px';
    }
    function dropTag(peer){peer.tag?.remove();peer.tag=null;}
    function hideTags(){for(const peer of peers.values())if(peer.tag)peer.tag.hidden=true;}
    lab.stats={captured:0,parts:0,ghostParts:0,unsupported:0};
    lab.textures=()=>textures;
    const message=text=>{lab.status=text;status.textContent=text;ui?.refresh();};
    const rect=r=>r?[r.x,r.y,r.width,r.height]:null;
    const quant=x=>Math.round(x*1000)/1000;
    function textureId(texture){
      if(textureIds.has(texture))return textureIds.get(texture);
      const url=texture.baseTexture?.resource?.url;if(!url)return null;
      const desc={url:new URL(url,location.href).pathname.split('/__hw_app__/')[1],frame:rect(texture.frame),orig:rect(texture.orig),trim:rect(texture.trim),rotate:texture.rotate||0};
      if(!core.validTexture(desc))return null;
      const id=textures.length;textures.push(desc);textureIds.set(texture,id);return id;
    }
    function roots(character){
      const wrappers=new Set(),seen=new Set();
      function visit(obj,depth=0){
        if(!obj||typeof obj!=='object'||seen.has(obj)||depth>5)return;seen.add(obj);
        if(obj.pixiSprite){if(obj.parent)wrappers.add(obj);return;}
        if(Array.isArray(obj)){for(const v of obj)visit(v,depth+1);return;}
        for(const [k,v] of Object.entries(obj)){
          if(/MCs?$/.test(k)||['son','daughter','dad','mom','elf1','elf2','elves','composites','rider','passenger','characters'].includes(k))visit(v,depth+1);
          if(k==='paintVector'&&Array.isArray(v))for(const body of v)visit(body?.GetUserData?.(),depth+1);
        }
      }
      visit(character);
      return [...wrappers].filter(w=>{for(let a=w.parent;a;a=a.parent)if(wrappers.has(a))return false;return true;})
        .sort((a,b)=>(a.parent?.children?.indexOf(a)||0)-(b.parent?.children?.indexOf(b)||0));
    }
    function poseTime(){
      if(raceStart&&released)return Math.max(0,(Date.now()+clockOffset)-raceStart);
      const iter=Number(session?.iteration),step=Number(session?.m_timeStep||session?.timeStep);
      if(Number.isFinite(iter)&&Number.isFinite(step)&&step>0){
        const t=(iter-sessionStart)*step*1000;
        if(Number.isFinite(t))return Math.max(0,t);
      }
      if(raceStart)return Math.max(0,(Date.now()+clockOffset)-raceStart);
      return 0;
    }
    function bodyX(obj){
      try{
        const p=obj?.GetPosition?.()||obj?.GetWorldCenter?.();
        if(p&&Number.isFinite(p.x))return p.x;
      }catch{}
      return null;
    }
    function measureBounds(s){
      const xs=[];
      try{
        for(let b=s?.m_world?.GetBodyList?.();b;b=b.GetNext()){
          const x=bodyX(b);if(x!=null&&Math.abs(x)<1e6)xs.push(x);
        }
      }catch{}
      if(xs.length<2)return trackBounds;
      xs.sort((a,b)=>a-b);
      const lo=xs[Math.floor((xs.length-1)*0.02)];
      const hi=xs[Math.ceil((xs.length-1)*0.98)];
      return hi>lo?{minX:lo,maxX:hi}:trackBounds;
    }
    function happyWheels(){return app.screenManager.currentScreen?.happyWheels;}
    function sessionController(){return happyWheels()?.sessionController;}
    function inPostFinish(){return !!(network&&released&&(finishedRace||finishSent||session?.replayData?.completed));}
    function noteChrome(){
      const hw=happyWheels();
      chromeSnapshot=hw?.children?new Set(hw.children):null;
      hiddenChrome=[];
    }
    function restoreChrome(){
      for(const node of hiddenChrome)try{node.visible=true;}catch{}
      hiddenChrome=[];
    }
    function hideNode(node){
      if(!node||node.visible===false)return;
      try{node.visible=false;hiddenChrome.push(node);}catch{}
    }
    function hideFinishChrome(s){
      if(wantMenu){restoreChrome();return;}
      if(!inPostFinish()&&!(network&&released&&s?.replayData?.completed))return;
      finishedRace=true;
      thawWorld(s);
      const hw=happyWheels();
      const hide=(node,depth=0)=>{
        if(!node||depth>5)return;
        const name=String(node.name||node.constructor?.name||'');
        if(/complete|result|finish|endlevel|levelend|winpanel|postgame/i.test(name)&&node!==s?.containerSprite&&node!==s?.containerSprite?.pixiSprite)hideNode(node);
        for(const child of node.children||[])hide(child,depth+1);
      };
      hide(hw);hide(app.stage);
      try{s.containerSprite.visible=true;}catch{}
      try{s.containerSprite.pixiSprite.visible=true;}catch{}
    }
    function revealNode(node,depth=0,seen){
      if(!node||typeof node!=='object'||depth>14||seen.has(node))return;
      seen.add(node);
      try{
        if(node.visible===false)node.visible=true;
        if(node.renderable===false)node.renderable=true;
      }catch{}
      if(node.pixiSprite)revealNode(node.pixiSprite,depth+1,seen);
      for(const child of node.children||[])revealNode(child,depth+1,seen);
    }
    function revealWorld(s){
      const seen=new Set();
      revealNode(s?.containerSprite,0,seen);
      revealNode(s?.containerSprite?.pixiSprite,0,seen);
      try{
        for(let b=s?.m_world?.GetBodyList?.();b;b=b.GetNext()){
          try{revealNode(b.GetUserData?.(),0,seen);}catch{}
        }
      }catch{}
      for(const key of ['specials','items','shapes','levelObjects','gameObjects','triggers','groups','paintVector']){
        const list=s?.[key];
        if(Array.isArray(list))for(const item of list)revealNode(item,0,seen);
      }
    }
    function steerCamera(s,focus){
      if(!s||!focus)return;
      const character=s.character;
      const bodies=new Set([character,character?.body,character?.centralBody,character?.pelvis,character?.chest,character?.m_body].filter(Boolean));
      const keys=['cameraFocus','cameraTarget','followTarget','camTarget','lookAt'];
      for(const obj of [s,character,sessionController()]){
        if(!obj)continue;
        for(const key of keys){
          const val=obj[key];
          if(!val||typeof val!=='object'||bodies.has(val))continue;
          if(typeof val.SetPosition==='function')continue;
          try{if(typeof val.x==='number'){val.x=focus.x;val.y=focus.y;}}catch{}
          try{val.position?.set?.(focus.x,focus.y);}catch{}
        }
        try{if(typeof obj.cameraX==='number'){obj.cameraX=focus.x;obj.cameraY=focus.y;}}catch{}
      }
    }
    function livePeerIds(){
      const now=performance.now();
      return [...peers.keys()].filter(id=>{const peer=peers.get(id);return peer?.lastArrival&&now-peer.lastArrival<8000;});
    }
    function spectateIds(){
      const ids=livePeerIds();
      if(selfId&&!ids.includes(selfId))ids.unshift(selfId);
      return ids;
    }
    function watchingOther(){return !!(spectateId&&selfId&&spectateId!==selfId&&peers.get(spectateId));}
    function cycleSpectate(next){
      const ids=spectateIds();
      if(!ids.length){spectateId=selfId||null;return;}
      const current=spectateId||selfId;
      const i=ids.indexOf(current);
      spectateId=i<0?ids[0]:ids[(i+(next?1:-1)+ids.length)%ids.length];
    }
    function spectatePlayer(id){if(id&&(id===selfId||peers.has(id)))spectateId=id;}
    function resetWatch(){spectateId=null;finishedRace=false;wantMenu=false;restoreChrome();}
    function resumeGameAudio(){
      try{
        const muted=!!lab.state?.sharedObject?.data?.muted;
        const Howler=window.Howler;
        if(Howler&&!muted){
          if(typeof Howler.mute==='function')Howler.mute(false);
          Howler.ctx?.resume?.();
          Howler._ctx?.resume?.();
        }
      }catch{}
      for(const obj of [lab.state,happyWheels(),session,sessionController()]){
        if(!obj)continue;
        for(const key of ['sound','sounds','soundManager','audio','audioManager']){
          const snd=obj[key];
          if(!snd)continue;
          try{snd.systemUnMute?.();}catch{}
          try{snd.unMute?.();}catch{}
          try{snd.unmute?.();}catch{}
          try{if(typeof snd.resume==='function')snd.resume();}catch{}
        }
      }
    }
    function onLocalRestart(){
      resetWatch();
      resumeGameAudio();
    }
    function manualRestart(){
      onLocalRestart();
      const controller=sessionController();
      if(!controller?.restartLevel)return false;
      try{controller.restartLevel();resumeGameAudio();return true;}catch{return false;}
    }
    function allowGameMenu(){
      wantMenu=true;
      restoreChrome();
      const view=app.view||app.canvas||document.querySelector('canvas');
      try{view?.focus?.();}catch{}
      return true;
    }
    function manualMenu(){return allowGameMenu();}
    function peerFocus(peer){
      if(!peer)return null;
      const frame=core.liveSample(peer.frames,performance.now(),peer.lastArrival)||peer.frames.at(-1);
      if(!frame?.parts?.length)return null;
      let x=0,y=0,n=0;
      for(const part of frame.parts){x+=part[6];y+=part[7];n++;}
      return n?{x:x/n,y:y/n}:null;
    }
    function alignWorldLayer(s){
      const spr=s?.containerSprite?.pixiSprite;if(!spr)return;
      layer.transform.setFromMatrix(spr.worldTransform.clone().prepend(app.stage.worldTransform.clone().invert()));
    }
    function paintPeers(){
      const now=performance.now();
      for(const [id,peer] of peers){
        const fresh=peer.lastArrival&&now-peer.lastArrival<8000;
        peer.group.visible=fresh;
        if(!fresh){if(peer.tag)peer.tag.hidden=true;continue;}
        draw(peer.group,peer.sprites,core.liveSample(peer.frames,now,peer.lastArrival),peer.textures);
        ensureTag(peer,id);placeTag(peer);
      }
    }
    function applySpectate(s,early){
      if(wantMenu||!inPostFinish()||!s?.containerSprite?.pixiSprite)return;
      if(!spectateId)spectateId=selfId;
      if(!watchingOther())return;
      const focus=peerFocus(peers.get(spectateId));if(!focus)return;
      steerCamera(s,focus);
      revealWorld(s);
      if(early)return;
      paintPeers();
      alignWorldLayer(s);
      const spr=s.containerSprite.pixiSprite;
      try{spr.updateTransform();}catch{}
      const m=spr.worldTransform;
      const sx=m.a*focus.x+m.c*focus.y+m.tx;
      const sy=m.b*focus.x+m.d*focus.y+m.ty;
      const view=app.renderer.screen||{width:app.renderer.width,height:app.renderer.height};
      spr.position.set(spr.x+(view.width/2)-sx,spr.y+(view.height/2)-sy);
      try{spr.updateTransform();}catch{}
      revealWorld(s);
      alignWorldLayer(s);
    }
    function characterX(s){
      const c=s?.character;if(!c)return null;
      for(const obj of [c,c.body,c.centralBody,c.cameraFocus,c.pelvis,c.chest,c.hip,c.torso,c.m_body]){
        const x=bodyX(obj);if(x!=null)return x;
      }
      const seen=new Set();
      function walk(obj,depth){
        if(!obj||typeof obj!=='object'||seen.has(obj)||depth>4)return null;
        seen.add(obj);
        const x=bodyX(obj);if(x!=null)return x;
        for(const key of ['body','centralBody','cameraFocus','pelvis','chest','hip','torso','m_body']){
          const found=walk(obj[key],depth+1);if(found!=null)return found;
        }
        return null;
      }
      return walk(c,0);
    }
    function localProgress(s){
      if(s?.replayData?.completed)return 1;
      if(!trackBounds)trackBounds=measureBounds(s);
      const x=characterX(s);
      if(x==null||!trackBounds)return liveProgress;
      return Math.max(0,Math.min(1,(x-trackBounds.minX)/(trackBounds.maxX-trackBounds.minX)));
    }
    function markDead(){
      if(sawDead)return;
      sawDead=true;
      deaths++;
    }
    function decorate(frame,s){
      if(!frame)return null;
      liveProgress=localProgress(s);
      if(liveProgress>bestProgress)bestProgress=liveProgress;
      if(s?.character?.dead||frame.dead)markDead();
      frame.progress=bestProgress;
      frame.current=liveProgress;
      frame.deaths=deaths;
      frame.best=bestProgress;
      return frame;
    }
    function tintOf(n){
      const v=n?.tint;
      if(typeof v==='number'&&Number.isFinite(v))return v&0xffffff;
      if(v&&typeof v.toNumber==='function'){const n=Number(v.toNumber());if(Number.isFinite(n))return n&0xffffff;}
      return 0xffffff;
    }
    function capture(){
      if(!session?.character||!session.containerSprite)return null;
      const inv=session.containerSprite.pixiSprite.worldTransform.clone().invert(),parts=[],seen=new Set();let unsupported=0;
      function visit(n){
        if(!n||seen.has(n)||!n.visible||n.isMask||n.worldAlpha<=0)return;seen.add(n);
        if(n.texture&&n.renderable){
          const tid=textureId(n.texture);
          if(tid!==null){
            if(!ids.has(n))ids.set(n,nextId++);
            const m=n.worldTransform.clone().prepend(inv);
            const part=[ids.get(n),tid,...[m.a,m.b,m.c,m.d,m.tx,m.ty].map(quant),quant(Math.max(0,Math.min(1,Number(n.worldAlpha)||0))),tintOf(n),Number(n.anchor?.x)||0,Number(n.anchor?.y)||0];
            if(part.every(x=>Number.isFinite(x)))parts.push(part);else unsupported++;
          }else unsupported++;
        }else if(n.geometry&&n.renderable)unsupported++;
        for(const child of n.children||[])visit(child);
      }
      for(const w of roots(session.character))visit(w.pixiSprite);
      lab.stats.parts=parts.length;lab.stats.unsupported=unsupported;
      const frame={t:poseTime(),parts,dead:!!session.character.dead,finished:!!session.replayData?.completed};
      return decorate(core.validFrame(frame)?frame:null,session);
    }
    function resolveTexture(desc){
      const key=JSON.stringify(desc);if(textureLoad.has(key))return textureLoad.get(key);
      const cached=Object.values(p.WpD.TextureCache).find(t=>t?.baseTexture?.resource?.url?.endsWith('/'+desc.url)&&JSON.stringify(rect(t.frame))===JSON.stringify(desc.frame)&&t.rotate===desc.rotate);
      if(cached){textureLoad.set(key,cached);return cached;}
      textureLoad.set(key,null);
      const base=Texture.from('./'+desc.url).baseTexture;
      const make=()=>{try{textureLoad.set(key,new Texture(base,new Rectangle(...desc.frame),new Rectangle(...desc.orig),desc.trim?new Rectangle(...desc.trim):null,desc.rotate));}catch(e){lab.errors.push(String(e));}};
      if(base.valid)make();else base.once('loaded',make);return textureLoad.get(key);
    }
    function draw(group,sprites,frame,manifest){
      for(const sprite of sprites.values())sprite.visible=false;
      if(!frame)return;
      for(const a of frame.parts){
        const desc=manifest[a[1]];if(!desc)continue;const texture=resolveTexture(desc);if(!texture)continue;
        let sprite=sprites.get(a[0]);if(!sprite){sprite=new Sprite(texture);sprites.set(a[0],sprite);group.addChild(sprite);}
        sprite.texture=texture;sprite.visible=true;sprite.alpha=a[8]*.42;sprite.tint=a[9];sprite.anchor.set(a[10],a[11]);
        sprite.transform.setFromMatrix(new Matrix(...a.slice(2,8)));group.setChildIndex(sprite,group.children.length-1);
      }
      for(const [id,sprite]of sprites)if(!sprite.visible){sprite.destroy();sprites.delete(id);}
    }
    function clear(group,sprites){for(const sprite of sprites.values())sprite.destroy();sprites.clear();}
    function freezeWorld(s){
      if(!s||s.isMenu)return;
      try{if(typeof s.pause==='function'&&!s.paused)s.pause();}catch{}
      if(s.paused===false)try{s.paused=true;}catch{}
    }
    function thawWorld(s){
      if(!s)return;
      try{
        if(typeof s.unpause==='function')s.unpause();
        else if(typeof s.resume==='function')s.resume();
        else s.paused=false;
      }catch{try{s.paused=false;}catch{}}
      resumeGameAudio();
    }
    function remainingMs(){return raceStart==null?null:raceStart-(Date.now()+clockOffset);}
    function holdForCountdown(s){
      if(!raceStart||released||!s||s.isMenu)return;
      const remaining=remainingMs();
      if(remaining>50){
        freezeWorld(s);
        const n=String(Math.max(1,Math.ceil(remaining/1000)));
        const text='Race countdown: '+n;
        if(lab.status!==text)message(text);
        return;
      }
      released=true;ready=false;thawWorld(s);
      sessionStart=s.iteration;lastFrame=capture()||lastFrame;publishFrame(true);
      resetWatch();noteChrome();
      message('GO! Race on.');
    }
    function fingerprint(s){
      const geometry=[];
      for(let b=s.m_world.GetBodyList();b;b=b.GetNext()){
        const shapes=[];for(let sh=b.GetShapeList();sh;sh=sh.GetNext())shapes.push({type:sh.m_type,radius:sh.m_radius,vertices:sh.m_vertices?.map(v=>[v.x,v.y]),filter:sh.m_filter});
        geometry.push({position:[b.GetPosition().x,b.GetPosition().y],angle:b.GetAngle(),shapes});
      }
      return crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(geometry))).then(b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join(''));
    }
    function playingLevelId(){
      if(!session||session.isMenu||session.isEditorTest)return '';
      const index=String(lab.state.levelIndex||'');
      return /^[1-9][0-9]{0,8}$/.test(index)?index:'';
    }
    function levelPlayable(){
      return !!(session&&!session.isMenu&&!session.isEditorTest&&(session.m_world||session.containerSprite)&&(session.character||session.containerSprite));
    }
    function characterSelected(){
      return !!(levelPlayable()&&(session.character||session.m_world));
    }
    function characterMenuOpen(){
      const hw=happyWheels();
      if(!hw)return false;
      const nodes=[hw,...hw.children||[]];
      try{for(const val of Object.values(hw))if(val&&typeof val==='object')nodes.push(val);}catch{}
      for(const node of nodes){
        const name=String(node?.name||node?.constructor?.name||'');
        if(/character\s*menu|charactermenu/i.test(name)&&node.visible!==false)return true;
      }
      return false;
    }
    function selectingCharacter(){
      if(characterSelected())return false;
      if(characterMenuOpen())return true;
      if(!room?.meta&&!travelTarget&&!lab.download?.level)return false;
      if(lab.download?.loading)return false;
      return !!(room?.meta||travelTarget);
    }
    function localLevelIds(){
      const ids=[];
      const play=playingLevelId();
      if(play)ids.push(play);
      if(meta?.level)ids.push(String(meta.level));
      if(lab.download?.level)ids.push(String(lab.download.level));
      if(travelTarget?.level)ids.push(String(travelTarget.level));
      return ids;
    }
    function onRoomLevel(){
      if(!levelPlayable())return false;
      if(!room?.meta?.level)return true;
      const ids=localLevelIds();
      if(!ids.length)return true;
      return ids.includes(String(room.meta.level));
    }
    function loadingHostLevel(){
      const level=room?.meta?.level;
      if(!level)return false;
      if(travelTarget&&String(travelTarget.level)===String(level))return true;
      if(travelLock===level&&Date.now()-travelAt<8000)return true;
      if(lab.download?.loading&&String(lab.download.level)===String(level))return true;
      return false;
    }
    function settleGuestLoad(){
      if(!room||room.hostId===selfId||!onRoomLevel())return false;
      adoptHostLevel();
      travelTarget=null;
      travelLock=null;
      publishPresence();
      return true;
    }
    function noteHostReady(next){
      const hostReady=!!next?.players?.find(p=>p.id===next.hostId)?.ready;
      const checking=!!next?.checking;
      if((checking&&!lastChecking)||(hostReady&&!lastHostReady))hostReadyAt=Date.now();
      if(!checking&&!hostReady)hostReadyAt=0;
      lastChecking=checking;
      lastHostReady=hostReady;
    }
    function hostChecking(next){
      const current=next||room;
      return !!(current&&current.checking);
    }
    function shouldAskReady(){
      if(!room||room.hostId===selfId||ready||raceStart)return false;
      if(hostChecking())return true;
      if(!onRoomLevel())return false;
      return hostReadyAt>0&&hostReadyAt>=askSuppressAt;
    }
    function shareHostLevel(){
      if(!network||!room||room.hostId!==selfId)return false;
      if(characterMenuOpen()||!session||session.isMenu)return false;
      let next=null;
      if(meta&&session&&!session.isMenu&&!session.isEditorTest&&playingLevelId()===meta.level)next=meta;
      else if(lab.download?.hash&&lab.download.level&&!lab.download.loading)next={protocol:core.VERSION,game:'1.99',level:lab.download.level,hash:lab.download.hash,character:lab.state.characterIndex,fingerprint:'download-sha256'};
      if(!next?.hash||!/^[a-f0-9]{64}$/.test(next.hash))return false;
      if(raceStart)return false;
      if(room.meta&&room.meta.level===next.level)return false;
      const moved=!room.meta||room.meta.level!==next.level;
      const key=(moved?'summon:':'level:')+next.level+':'+next.hash,now=performance.now();
      if(key===lastShareKey&&now-lastShareAt<2000)return false;
      lastShareKey=key;lastShareAt=now;
      if(moved){ready=false;readyCheck=false;ui?.hideReadyAsk?.();}
      send({type:moved?'summon':'level',meta:next});
      if(moved)message('Bringing everyone to level '+next.level+'…');
      return true;
    }
    function samePublishedLevel(){
      if(!room?.meta?.level)return false;
      const id=String(room.meta.level);
      return String(lab.state.levelIndex)===id||(meta&&String(meta.level)===id)||lab.download?.level===id;
    }
    function localCharacterEdit(){
      return !!(room?.meta&&samePublishedLevel()&&(characterMenuOpen()||!session||session.isMenu));
    }
    function playerPhase(){
      if(!room)return 'offline';
      if(characterSelected())return 'ingame';
      if(localCharacterEdit()&&(lastPhase==='ingame'||meta))return 'ingame';
      if(!room.meta&&!travelTarget)return 'lobby';
      if(selectingCharacter()&&!(meta&&samePublishedLevel()))return 'selecting';
      if(loadingHostLevel()||lab.download?.loading)return 'loading';
      return room.meta?'loading':'lobby';
    }
    function everyoneInGame(){
      if(!room?.players?.length||!characterSelected())return false;
      return room.players.every(p=>{
        if(p.id===selfId)return characterSelected();
        if(p.phase==='ingame'||p.loaded)return true;
        if(p.phase==='selecting'||p.phase==='loading'||p.phase==='lobby')return false;
        return false;
      });
    }
    function reportPhase(){return publishPresence();}
    function publishPresence(){
      if(!network||!room)return playerPhase();
      const phase=playerPhase();
      if(phase==='selecting'||phase==='loading')ui?.hideForLevel?.();
      const mapKey=room.meta?String(room.meta.level)+':'+String(room.meta.hash):'';
      if(mapKey!==lastMapKey){
        lastMapKey=mapKey;
        lastPhase='';
        lastPresenceKey='';
      }
      if(phase!==lastPhase){
        lastPhase=phase;
        pendingStatus=true;
        send({type:'status',phase});
      }
      if(phase==='ingame'&&room.meta){
        if(room.hostId!==selfId)adoptHostLevel();
        if(meta&&(room.hostId===selfId||core.compatible(meta,room.meta))){
          const key=mapKey+'|ingame';
          if(key!==lastPresenceKey){
            lastPresenceKey=key;
            send({type:'level',meta});
          }
        }
      }
      return phase;
    }
    function pullGuestLevel(){
      if(!network||!room||room.hostId===selfId||!room.meta)return;
      if(localCharacterEdit())return;
      if(settleGuestLoad())return;
      if(selectingCharacter())return;
      if(hostChecking()&&levelPlayable()){adoptHostLevel();return;}
      if(loadingHostLevel())return;
      travel(room.meta);
    }
    function hookLoader(){
      const hw=happyWheels();
      if(!hw||typeof hw.loadLevelByID!=='function'||hw._mpHooked)return;
      const orig=hw.loadLevelByID.bind(hw);
      hw._mpHooked=true;
      hw.loadLevelByID=function(id){
        const out=orig(id);
        if(room&&room.hostId===selfId&&id){
          setTimeout(()=>{try{shareHostLevel();}catch{}},400);
          setTimeout(()=>{try{shareHostLevel();}catch{}},1800);
        }
        return out;
      };
    }
    async function changed(s){
      const action=pendingAction;pendingAction=null;
      const keepStart=raceStart,keepReady=ready,keepReleased=released,prevMeta=meta;
      const downloadLevel=lab.download?.level;
      const switchedAway=!!downloadLevel&&!!prevMeta&&downloadLevel!==prevMeta.level&&String(downloadLevel)!==String(room?.meta?.level||'');
      if(room&&prevMeta&&!switchedAway&&(!s||s.isMenu||characterMenuOpen())){
        session=s;lab.session=s;
        meta=prevMeta;lab.meta=meta;
        raceStart=keepStart;ready=keepReady;released=keepReleased;
        if(action)action();
        return;
      }
      const sameRoomLevel=!!prevMeta&&!switchedAway&&(
        String(lab.state.levelIndex)===prevMeta.level||
        (room?.meta&&String(room.meta.level)===prevMeta.level)
      );
      const respawn=!!(s&&!s.isMenu&&sameRoomLevel&&(keepStart||(room&&room.meta)));
      if(recording)stop();session=s;lab.session=s;playback=null;clear(localGroup,localSprites);layer.visible=!!s;
      if(respawn){
        if(keepReleased)markDead();
        sawDead=false;resetWatch();
        ready=false;raceStart=keepStart;released=keepReleased;finishSent=keepStart?finishSent:false;
        ids=new WeakMap();nextId=0;textureIds=new WeakMap();textures=[];lastCapture=-1;sessionStart=s.iteration||0;lastIteration=s.iteration||0;
        meta=prevMeta;lab.meta=meta;
        if(!released)freezeWorld(s);
        else resumeGameAudio();
        lastFrame=capture();
        if(released)publishFrame(true);
        if(action)action();
        return;
      }
      if(!keepStart){deaths=0;sawDead=false;bestProgress=0;liveProgress=0;trackBounds=null;resetWatch();chromeSnapshot=null;}
      if(!keepStart)for(const peer of peers.values()){peer.frames=[];clear(peer.group,peer.sprites);}
      meta=null;lab.meta=null;ready=false;raceStart=null;released=keepStart?keepReleased:false;finishSent=keepStart?finishSent:false;
      ids=new WeakMap();nextId=0;textureIds=new WeakMap();textures=[];lastCapture=-1;sessionStart=s?.iteration||0;lastIteration=s?.iteration||0;
      if(!s||s.isMenu){message(room?'Lobby connected. The host can choose a level.':'Open Multiplayer to join or host a room.');return;}
      const current=s,host=travelTarget||(room?.hostId!==selfId?room?.meta:null);
      const key=String(lab.state.levelIndex);
      const downloadedHash=lab.download?.level===key?lab.download.hash:null;
      const hash=downloadedHash||levelHashes.get(key)||await fingerprint(s);if(session!==current)return;
      levelHashes.set(key,hash);
      meta={protocol:core.VERSION,game:'1.99',level:key,hash,character:lab.state.characterIndex,fingerprint:downloadedHash?'download-sha256':'initial-world-sha256'};
      lab.meta=meta;
      if(host&&!s.isEditorTest){
        if(key!==host.level){message('Waiting for host level '+host.level+' to load…');return;}
        meta={...meta,level:host.level,hash:host.hash,fingerprint:host.fingerprint||meta.fingerprint};lab.meta=meta;travelTarget=null;travelLock=null;
      }else if(travelTarget){
        if(key!==travelTarget.level){message('Waiting for host level '+travelTarget.level+' to load…');return;}
        travelTarget=null;travelLock=null;
      }
      const sameLevel=core.compatible(prevMeta,meta);
      if(keepStart&&sameLevel){raceStart=keepStart;ready=keepReady||!keepReleased;if(!released)freezeWorld(s);}
      else{
        if(!sameLevel){raceStart=null;released=false;ready=false;readyCheck=false;}
        if(network&&room&&meta){
          if(sameRoomLevel||(room.meta&&String(room.meta.level)===String(meta.level))){
            if(room.hostId!==selfId)adoptHostLevel();
            resumeGameAudio();
          }else if(room.hostId===selfId)shareHostLevel();
          else if(room.meta&&(playingLevelId()===room.meta.level||onRoomLevel()||characterSelected())){adoptHostLevel();publishPresence();}
          else if(room.meta&&!selectingCharacter()&&!localCharacterEdit())travel(room.meta);
        }
      }
      if(!keepStart||!sameLevel)message(room?(room.hostId===selfId?'Level loaded. Friends will be brought here automatically.':shouldAskReady()?(room.players.find(p=>p.id===room.hostId)?.name||'The host')+' is ready. Are you ready?':'Host level loaded. Wait for the host to start a ready check.'):'Open Multiplayer to race with friends.');
      lastFrame=capture();
      if(action)action();
      ui?.refresh();
    }
    function record(){
      if(network)throw Error('Leave the live room before recording a local ghost');
      if(!session||!meta)throw Error('Load a level first');if(session.paused)throw Error('Resume the level first');
      recording={meta:{...meta},textures,frames:[]};recordedBytes=0;lab.recording=recording;sessionStart=session.iteration;lastCapture=-1;message('Recording — use Stop when finished.');
    }
    function stop(){
      if(recording?.frames.length){saved={...recording,textures:JSON.parse(JSON.stringify(textures))};lab.saved=saved;persist(saved);}
      recording=null;lab.recording=null;message(saved?'Run saved in memory. Restart the level, then Play ghost.':'No run recorded.');return saved;
    }
    function play(){if(!saved)throw Error('Record or import a run first');if(!core.compatible(meta,saved.meta))throw Error('This ghost belongs to different level data');playback={record:saved,start:session.iteration};message('Playing your recorded ghost.');}
    function restartThen(fn){
      const controller=lab.state.rootApp.screenManager.currentScreen?.happyWheels?.sessionController;
      if(!controller||!session)throw Error('Load a level first');
      pendingAction=fn;message('Restarting level…');controller.restartLevel();setTimeout(()=>{if(pendingAction!==fn)return;pendingAction=null;try{fn();}catch(e){message(e.message||String(e));}},1200);
    }
    function send(data){if(network?.readyState===1)network.send(JSON.stringify(data));}
    function makeSocket(url){
      const epoch=++socketEpoch;
      if(!window.hwGhostNet){
        const socket=new WebSocket(url);
        socket.epoch=epoch;
        return socket;
      }
      const socket={readyState:0,epoch,opened:false,send:data=>hwGhostNet.send(data)};
      const unsubscribe=hwGhostNet.onEvent(event=>{
        if(epoch!==socketEpoch)return;
        if(event.type==='message'){if(!socket.opened){socket.opened=true;socket.readyState=1;}socket.onmessage?.({data:event.data});}
        if(event.type==='error')socket.onerror?.(event.data);
        if(event.type==='close'){
          if(!socket.opened)return;
          socket.readyState=3;unsubscribe();socket.onclose?.();
        }
      });
      socket.close=()=>{if(epoch===socketEpoch)socketEpoch++;unsubscribe();socket.readyState=3;hwGhostNet.disconnect();};
      hwGhostNet.connect(url).then(()=>{
        if(epoch!==socketEpoch)return;
        socket.opened=true;socket.readyState=1;socket.onopen?.();
      }).catch(e=>{
        if(epoch!==socketEpoch)return;
        socket.readyState=3;unsubscribe();socket.onerror?.(e);socket.failed=true;socket.onclose?.();
      });
      return socket;
    }
    function connect(url,code,name){
      code=String(code||'').trim().toUpperCase();const endpoint=new URL(url);if(!['ws:','wss:'].includes(endpoint.protocol))throw Error('Use a ws:// or wss:// relay address');
      disconnect();playback=null;clear(localGroup,localSprites);const socket=makeSocket(endpoint.href);network=socket;lab.socket=network;
      network.onopen=()=>send({type:code?'join':'create',code:code.trim().toUpperCase(),name:String(name||'Racer').slice(0,24),protocol:core.VERSION,meta:session&&!session.isMenu&&!session.isEditorTest?meta:null});
      network.onerror=()=>message('Cannot reach the multiplayer server. Check Server settings and that the server is running.');
      network.onclose=()=>{
        if(network!==socket)return;
        if(ready||raceStart)thawWorld(session);
        const failed=socket.failed||!room;
        network=null;room=null;ready=false;raceStart=null;released=false;ui?.refresh();
        for(const peer of peers.values())peer.group.visible=false;
        message(failed?'Cannot reach the multiplayer server. Check Server settings and that the server is running.':'Disconnected from the multiplayer server.');
      };
      network.onmessage=e=>{try{receive(JSON.parse(e.data));}catch(err){lab.errors.push(String(err));}};
    }
    function disconnect(){if(network){network.onclose=null;network.close();network=null;}room=null;selfId=null;travelTarget=null;travelLock=null;pendingAction=null;raceStart=null;released=false;ready=false;readyCheck=false;hostReadyAt=0;askSuppressAt=0;lastHostReady=false;lastChecking=false;lastShareKey='';lastPhase='';lastPresenceKey='';lastMapKey='';pendingStatus=false;ui?.hideReadyAsk?.();resetWatch();for(const peer of peers.values()){dropTag(peer);peer.group.destroy({children:true});}peers.clear();}
    function followHostLevel(target){
      if(!target||room?.hostId===selfId)return;
      if(playingLevelId()===target.level&&session&&!session.isMenu&&!session.isEditorTest){
        travelTarget=null;travelLock=null;
        if(!core.compatible(meta,target))adoptHostLevel();
        if(meta)send({type:'level',meta});
        return;
      }
      travel(target);
    }
    function travel(target){
      if(!target||target.protocol!==core.VERSION||!/^[1-9][0-9]{0,8}$/.test(target.level))throw Error('Invalid host level');
      if(playingLevelId()===target.level&&session&&!session.isMenu&&!session.isEditorTest){
        travelTarget=null;travelLock=null;
        if(!core.compatible(meta,target))adoptHostLevel();
        if(meta)send({type:'level',meta});
        if(hostChecking())message((room.players.find(p=>p.id===room.hostId)?.name||'The host')+' is ready. Are you ready?');
        else message(room?.hostId===selfId?'Level is in the room.':'Host level loaded. Wait for the host to start a ready check.');
        return;
      }
      const now=Date.now();
      if(travelLock===target.level&&now-travelAt<8000)return;
      travelLock=target.level;travelAt=now;askSuppressAt=now;
      travelTarget=target;pendingAction=null;ready=false;readyCheck=false;ui?.hideReadyAsk?.();ui?.hideForLevel?.();raceStart=null;released=false;thawWorld(session);
      const hw=app.screenManager.currentScreen?.happyWheels;
      if(!hw?.loadLevelByID){travelLock=null;message('Waiting for the game to finish loading...');setTimeout(()=>{if(network&&travelTarget===target)travel(target);},500);return;}
      message('Loading host level '+target.level+'…');
      try{if(hw.sessionController)hw.closeSessionController();}catch{}
      hw.loadLevelByID(Number(target.level));
      try{hw.closeMainMenu?.();}catch{}
    }
    function summon(){if(!room||room.hostId!==selfId)throw Error('Only the host can bring everyone');if(!meta||!session||session.isMenu||session.isEditorTest||lab.download?.loading||String(lab.state.levelIndex)!==meta.level)throw Error('Wait for the new level to finish loading');send({type:'summon',meta});message('Sent level '+meta.level+' to the room.');}
    function receive(m){
      if(m.type==='identity'){selfId=m.id;return;}
      if(m.type==='travel'){travel(m.meta);return;}
      if(m.type==='error'){
        if((pendingDecline||pendingStatus)&&/unknown message/i.test(m.message||'')){pendingDecline=false;pendingStatus=false;return;}
        pendingDecline=false;pendingStatus=false;
        if(m.message==='Invalid pose'){if(lab.errors.length<30)lab.errors.push(m.message);return;}
        if(!room)disconnect();ready=false;if(session?.paused&&!raceStart)thawWorld(session);message(m.message);return;
      }
      if(m.type==='room'){
        room=m;panel.querySelector('#gh-summon').hidden=m.hostId!==selfId;codeInput.value=m.code;
        const waiting=m.players.filter(p=>!p.ready).length;
        roomLabel.textContent='Room '+m.code+' / Level '+(m.meta?.level||'not selected')+' / '+m.players.map(p=>p.name+(p.ready?' [READY]':' [not ready]')).join(', ');
        for(const [id,peer] of peers)ensureTag(peer,id);
        noteHostReady(m);
        if(m.meta&&!characterSelected())ui?.hideForLevel?.();
        if(m.meta&&m.hostId!==selfId&&!settleGuestLoad()&&!(m.checking&&levelPlayable())&&!loadingHostLevel()&&!selectingCharacter())travel(m.meta);
        readyCheck=shouldAskReady();
        publishPresence();
        if(!ready&&!raceStart){
          const hostName=m.players.find(p=>p.id===m.hostId)?.name||'The host';
          if(!m.meta)message(m.hostId===selfId?'Share your room code, then choose a level.':'Waiting for the host to choose a level.');
          else if(m.hostId===selfId)message(m.checking?'Waiting for the other racers to ready up.':'Level is shared. Click Ready when everyone has loaded.');
          else if(m.checking||readyCheck)message(hostName+' is ready. Are you ready?');
          else message('Wait for the host to start a ready check.');
        }
        else if(ready&&!raceStart)message(waiting?'Ready - waiting for '+waiting+' more.':'Ready - starting...');
        ui?.refresh();
        return;
      }
      if(m.type==='readyCheck'){
        hostReadyAt=Date.now();lastHostReady=true;lastChecking=true;
        if(room)room.checking=true;
        readyCheck=true;
        if(room&&room.hostId!==selfId&&!ready&&!raceStart){
          message((m.name||'The host')+' is ready. Are you ready?');
          ui?.askReady?.(m.name);
        }
        ui?.refresh();
        return;
      }
      if(m.type==='readyDeclined'){
        pendingDecline=false;
        abortReadyCheck(m.name,m.message);
        return;
      }
      if(m.type==='pong'){clockOffset=m.serverTime-(Date.now()+m.clientTime)/2;return;}
      if(m.type==='start'){
        readyCheck=false;hostReadyAt=0;lastHostReady=true;lastChecking=false;ui?.hideReadyAsk?.();
        raceStart=m.at;released=false;ready=true;finishSent=false;deaths=0;sawDead=false;bestProgress=0;liveProgress=0;resetWatch();if(session){sessionStart=session.iteration;trackBounds=measureBounds(session);}lastCapture=-1;noteChrome();
        for(const peer of peers.values()){peer.frames=[];peer.deaths=0;peer.best=0;peer.progress=0;clear(peer.group,peer.sprites);}
        const begin=()=>{freezeWorld(session);sessionStart=session?.iteration||sessionStart;lastFrame=capture()||lastFrame;};
        const controller=app.screenManager.currentScreen?.happyWheels?.sessionController;
        if(controller&&session){pendingAction=begin;try{controller.restartLevel();}catch{begin();}setTimeout(()=>{if(pendingAction===begin){pendingAction=null;begin();}},800);}else begin();
        message('Race countdown: 3');return;
      }
      if(m.type==='cancel'){
        if(/left/i.test(m.message||''))return;
        readyCheck=false;hostReadyAt=0;lastHostReady=false;lastChecking=false;ui?.hideReadyAsk?.();raceStart=null;released=false;ready=false;deaths=0;sawDead=false;bestProgress=0;liveProgress=0;resetWatch();thawWorld(session);for(const peer of peers.values()){peer.frames=[];peer.deaths=0;peer.best=0;peer.progress=0;clear(peer.group,peer.sprites);}message(m.message);return;
      }
      if(m.type==='left'){
        const peer=peers.get(m.id);if(peer){dropTag(peer);peer.group.destroy({children:true});peers.delete(m.id);}
        if(spectateId===m.id)spectateId=selfId;
        message((m.name||'A racer')+' left.');
        ui?.refresh();
        return;
      }
      if(m.type==='finish'){message(m.name+' finished in '+(m.time/1000).toFixed(2)+'s (client reported).');return;}
      if(m.type==='frame'&&core.validFrame(m.frame)&&Array.isArray(m.textures)&&m.textures.length<=4096&&m.textures.every(core.validTexture)){
        let peer=peers.get(m.id);if(!peer){const group=new Container();layer.addChild(group);peer={id:m.id,group,sprites:new Map(),frames:[],textures:[],lastArrival:0,deaths:0,best:0,progress:0};peers.set(m.id,peer);ensureTag(peer,m.id);}
        const prev=peer.frames.at(-1);
        if(peer.frames.length&&m.frame.t<prev.t)return;
        if(prev?.dead&&!m.frame.dead)peer.frames=[];
        peer.textures=m.textures;peer.lastArrival=performance.now();
        peer.deaths=Number.isFinite(m.frame.deaths)?Math.max(peer.deaths,m.frame.deaths|0):peer.deaths;
        peer.progress=Number.isFinite(m.frame.current)?m.frame.current:(Number.isFinite(m.frame.progress)?m.frame.progress:peer.progress);
        peer.best=Number.isFinite(m.frame.best)?Math.max(peer.best,m.frame.best):(Number.isFinite(m.frame.progress)?Math.max(peer.best,m.frame.progress):peer.best);
        if(!peer.frames.length||m.frame.t>peer.frames.at(-1).t)peer.frames.push(m.frame);
        while(peer.frames.length>100)peer.frames.shift();
      }
    }
    function adoptHostLevel(){
      const host=travelTarget||room?.meta;
      if(!host||!levelPlayable())return false;
      meta={protocol:host.protocol||core.VERSION,game:host.game||'1.99',level:host.level,hash:host.hash,character:lab.state.characterIndex,fingerprint:'host-aligned'};
      lab.meta=meta;travelTarget=null;travelLock=null;return true;
    }
    function bindGuestToRoom(){
      if(!network||!room)return {ok:false,why:'offline'};
      if(!room.meta)return {ok:false,why:'nolevel'};
      if(onRoomLevel()||(hostChecking()&&levelPlayable())){
        if(!adoptHostLevel())return {ok:false,why:'offline'};
        send({type:'level',meta});
        return {ok:true,why:'synced'};
      }
      if(loadingHostLevel())return {ok:false,why:'loading'};
      travel(room.meta);
      return {ok:false,why:'travel'};
    }
    function ensureLevelSynced(){
      if(!network||!room)return false;
      if(room.hostId!==selfId)return bindGuestToRoom().ok;
      if(!levelPlayable()||!meta)return false;
      shareHostLevel();
      return !!room.meta&&room.meta.level===meta.level;
    }
    function linkState(){
      const connected=!!(network&&room);
      const level=room?.meta?.level||'';
      const phase=playerPhase();
      const synced=connected&&(!level||onRoomLevel());
      const loading=phase==='loading';
      let label='Not connected';
      if(network&&!room)label='Connecting…';
      else if(connected&&!level)label='Connected · waiting for the host to pick a level';
      else if(phase==='selecting')label='Select your character for level '+level;
      else if(phase==='ingame'&&everyoneInGame())label='Connected · everyone is on level '+level;
      else if(phase==='ingame')label='Connected · on level '+level+' · waiting for others to select a character';
      else if(loading)label='Connected · loading host level '+level;
      else if(synced)label='Connected · on host level '+level;
      else if(connected)label='Connected · not on host level '+level;
      return {connected,synced,loading,label};
    }
    function readyUp(){
      if(!network||!room)throw Error('Join a room first');
      if(room.hostId!==selfId)return readyVote(true);
      if(!ensureLevelSynced())throw Error('Wait for the level to finish loading');
      if(!everyoneInGame())throw Error('Wait for everyone to select a character');
      raceStart=null;released=false;ready=true;readyCheck=true;freezeWorld(session);send({type:'ready',meta});message('Asked the other racers if they are ready.');
    }
    function abortReadyCheck(name,text){
      readyCheck=false;hostReadyAt=0;lastHostReady=false;lastChecking=false;ready=false;raceStart=null;released=false;
      thawWorld(session);
      ui?.hideReadyAsk?.();
      message(text||((name||'A racer')+' declined ready. The host will have to ask again.'));
    }
    function readyVote(yes){
      if(!network||!room)throw Error('Join a room first');
      if(room.hostId===selfId)return readyUp();
      if(!yes){
        const name=room.players.find(p=>p.id===selfId)?.name||'A racer';
        pendingDecline=true;
        abortReadyCheck(name,name+' declined ready. The host will have to ask again.');
        send({type:'notReady'});
        return;
      }
      const link=bindGuestToRoom();
      if(!link.ok){
        if(link.why==='nolevel')throw Error('The host has not shared a level yet.');
        if(link.why==='loading'||link.why==='travel')throw Error('Still loading the host level. Press Yes again when the map is in.');
        throw Error('Not connected to the room.');
      }
      ready=true;freezeWorld(session);send({type:'ready',meta});message('Ready — waiting for the other racers.');
    }
    lab.lobby=()=>({room,selfId,ready,connecting:!!network&&!room,meta,status:lab.status,inLevel:levelPlayable(),loading:!onRoomLevel()&&(!!travelTarget||!!lab.download?.loading),phase:playerPhase(),allInGame:everyoneInGame(),canReady:!!room&&room.hostId===selfId&&characterSelected()&&!!meta&&everyoneInGame(),canVoteReady:!!room&&room.hostId!==selfId&&!ready&&!raceStart&&characterSelected()&&(hostChecking()||onRoomLevel()),canDecline:!!room&&room.hostId!==selfId&&!ready&&!raceStart&&(hostChecking()||readyCheck),readyCheck:shouldAskReady(),checking:hostChecking(),link:linkState().label,isHost:!!room&&room.hostId===selfId,raceStart,released,remaining:remainingMs()});
    lab.raceBoard=()=>{
      const racing=!!(raceStart&&(released||(raceStart-(Date.now()+clockOffset))<=0));
      const players=(room?.players||[]).map(p=>{
        if(p.id===selfId)return {id:p.id,name:p.name,you:true,deaths,progress:liveProgress,best:bestProgress,dead:!!session?.character?.dead,finished:finishSent};
        const peer=peers.get(p.id),f=peer?.frames?.at(-1);
        return {id:p.id,name:p.name,you:false,deaths:peer?.deaths||0,progress:peer?.progress||0,best:peer?.best||0,dead:!!f?.dead,finished:!!f?.finished};
      });
      return {racing,players,spectating:inPostFinish(),spectateId:spectateId||selfId,spectateName:spectateId&&spectateId!==selfId?playerName(spectateId):(selfId?'yourself':'')};
    };
    lab.inPostFinish=inPostFinish;lab.manualRestart=manualRestart;lab.onLocalRestart=onLocalRestart;lab.manualMenu=manualMenu;lab.allowGameMenu=allowGameMenu;lab.cycleSpectate=cycleSpectate;lab.spectatePlayer=spectatePlayer;
    lab.record=record;lab.stop=stop;lab.play=play;lab.capture=capture;lab.connect=connect;lab.disconnect=disconnect;lab.ready=readyUp;lab.readyVote=readyVote;lab.summon=summon;lab.restartThen=restartThen;
    lab.importRecording=r=>{saved=core.validateRecording(r);lab.saved=saved;persist(saved);message('Ghost imported. Load its level, then Play ghost.');};
    lab.diagnostics=()=>({meta,stats:lab.stats,status:lab.status,errors:lab.errors.slice(-5),recordedFrames:saved?.frames.length||recording?.frames.length||0,room:room?.code,peers:peers.size,visuals:{visible:layer.visible,attached:layer.parent===app.stage,parts:[...peers.values()].reduce((n,p)=>n+[...p.sprites.values()].filter(s=>s.visible).length,0)},raceStart,released,remaining:remainingMs(),paused:session?.paused});
    function publishFrame(force){
      if(!network||network.readyState!==1||!raceStart||!released||!lastFrame)return;
      if(!core.validFrame(lastFrame)||!Array.isArray(textures)||textures.length>4096||!textures.every(core.validTexture)||lastFrame.parts.some(p=>p[1]>=textures.length))return;
      const now=performance.now();
      if(!force&&now-lastSentAt<45)return;
      lastSentAt=now;
      if(lastFrame.finished&&!finishSent){finishSent=true;finishedRace=true;send({type:'frame',frame:lastFrame,textures});send({type:'finish',time:lastFrame.t});if(!spectateId)cycleSpectate(true);return;}
      if(inPostFinish())return;
      send({type:'frame',frame:lastFrame,textures});
    }
    function netTick(){
      if(!network||network.readyState!==1)return;
      const now=performance.now();
      publishFrame(false);
      if(now-networkAt>3000){networkAt=now;send({type:'ping',clientTime:Date.now(),phase:playerPhase()});}
    }
    function update(){
      try{hookLoader();if(room?.hostId===selfId)shareHostLevel();else pullGuestLevel();publishPresence();}catch(e){if(lab.errors.length<30)lab.errors.push(String(e));}
      const s=lab.state.currentSession;
      const requestedLevel=lab.download?.level;
      // loadLevelByID changes levelIndex before its downloaded session replaces the old one.
      // Keep the old session out of room metadata/Ready while that request is pending.
      if(lab.download?.loading&&requestedLevel===String(lab.state.levelIndex)){if(!s||s.isMenu||!s.m_world){layer.visible=false;hideTags();}return;}
      if(lab.download?.loading&&(!s||s.isMenu||!s.m_world)){layer.visible=false;hideTags();return;}
      if(s!==session||(meta&&String(lab.state.levelIndex)!==meta.level)||(meta&&lab.download?.hash&&lab.download.level===meta.level&&meta.fingerprint==='download-sha256'&&meta.hash!==lab.download.hash)||(travelTarget&&lab.download?.level===travelTarget.level&&!lab.download.loading&&!!lab.download.hash&&meta?.hash!==travelTarget.hash)){changed(s).catch(e=>{lab.errors.push(String(e));session=null;});return;}
      if(!s||s.isMenu||!s.m_world||!s.containerSprite){if(!s||s.isMenu){layer.visible=false;hideTags();}return;}
      if(s.iteration<lastIteration){changed(s);return;}lastIteration=s.iteration;const now=performance.now();
      layer.visible=true;if(layer.parent!==app.stage)app.stage.addChild(layer);app.stage.setChildIndex(layer,app.stage.children.length-1);
      holdForCountdown(s);
      if(s.replayData?.completed&&network&&released){finishedRace=true;if(!spectateId)cycleSpectate(true);}
      layer.transform.setFromMatrix(s.containerSprite.pixiSprite.worldTransform.clone().prepend(app.stage.worldTransform.clone().invert()));
      if(now-lastCapture>=50&&(!s.paused||(network&&released))){
        lastCapture=now;
        const next=capture();
        if(next)lastFrame=next;
        else if(lastFrame)decorate(lastFrame,s);
        if(lastFrame)lab.stats.captured++;
        if(recording&&lastFrame&&!s.paused){recording.frames.push(lastFrame);recordedBytes+=JSON.stringify(lastFrame).length;if(recording.frames.length>=3600||recordedBytes>48*1024*1024)stop();}
        publishFrame(false);
      }
      if(playback){const time=(s.iteration-playback.start)*s.m_timeStep*1000;draw(localGroup,localSprites,core.sample(playback.record.frames,time),playback.record.textures);lab.stats.ghostParts=[...localSprites.values()].filter(x=>x.visible).length;}
      let liveParts=0;
      for(const [id,peer] of peers){
        const fresh=peer.lastArrival&&now-peer.lastArrival<8000;
        peer.group.visible=fresh;
        if(!fresh){if(peer.tag)peer.tag.hidden=true;continue;}
        draw(peer.group,peer.sprites,core.liveSample(peer.frames,now,peer.lastArrival),peer.textures);
        liveParts+=[...peer.sprites.values()].filter(x=>x.visible).length;
        ensureTag(peer,id);placeTag(peer);
      }
      if(network&&raceStart&&!ready)lab.stats.ghostParts=liveParts;
    }
    const render=app.renderer.render;
    app.renderer.render=function(...args){
      try{
        const s=lab.state.currentSession;
        if(s&&!s.isMenu){
          if(s.replayData?.completed&&network&&released){finishedRace=true;if(!spectateId)cycleSpectate(true);}
          hideFinishChrome(s);
          applySpectate(s,false);
        }
      }catch(e){if(lab.errors.length<30)lab.errors.push(String(e));}
      const value=render.apply(this,args);
      try{update();}catch(e){if(lab.errors.length<30)lab.errors.push(String(e));}
      return value;
    };
    if(app.ticker?.update){
      const tick=app.ticker.update.bind(app.ticker);
      app.ticker.update=function(...args){
        try{
          const s=lab.state.currentSession;
          if(s&&!s.isMenu&&inPostFinish())applySpectate(s,true);
        }catch(e){if(lab.errors.length<30)lab.errors.push(String(e));}
        return tick(...args);
      };
    }
    setInterval(()=>{try{netTick();}catch(e){if(lab.errors.length<30)lab.errors.push(String(e));}},50);
    const panel=document.createElement('section');panel.id='hw-ghost-panel';
    panel.innerHTML=`<style>#hw-ghost-panel{position:fixed;right:12px;top:12px;width:296px;background:#17212bef;color:#f1f5f9;border:1px solid #607080;border-radius:8px;padding:12px;font:13px/1.4 system-ui;z-index:10000}#hw-ghost-panel button,#hw-ghost-panel input{font:inherit;border:1px solid #63758a;border-radius:4px;padding:5px 7px;margin:3px 1px;background:#28384b;color:#fff}#hw-ghost-panel button{cursor:pointer}#hw-ghost-panel input{box-sizing:border-box;width:100%}#hw-ghost-panel small{color:#b8c6d6}#hw-ghost-panel details{margin-top:8px}#hw-ghost-panel p{margin:6px 0}#hw-ghost-panel .row{display:flex;flex-wrap:wrap;gap:3px}</style><strong>Jimbob's Multiplayer Mod</strong><button id="gh-collapse" style="float:right" title="Hide controls">−</button><div id="gh-body"><p id="gh-status">Finding the game…</p><div class="row"><button id="gh-record">Record</button><button id="gh-stop">Stop</button><button id="gh-play">Play ghost</button></div><div class="row"><button id="gh-export">Export run</button><button id="gh-import">Import run</button><button id="gh-clear">Hide ghosts</button></div><details><summary>Race with a friend</summary><button id="gh-second">Open second window</button><small>Join a room to load the host level automatically, then Ready.</small><input id="gh-url" aria-label="Relay address" value=""><input id="gh-name" aria-label="Racer name" value="Racer" maxlength="24"><input id="gh-code" aria-label="Room code" placeholder="Room code (blank creates a room)"><div class="row"><button id="gh-connect">Connect</button><button id="gh-ready">Ready</button><button id="gh-leave">Leave</button><button id="gh-summon" hidden>Bring everyone to my level</button></div><p id="gh-room"></p></details><small>Visual ghosts only · F8 toggles controls</small></div>`;
    document.body.appendChild(panel);panel.hidden=!window.HWGhostConfig?.development;
    panel.querySelector('#gh-url').value=window.HWGhostConfig?.defaultRelayUrl||'wss://web-production-79ef3.up.railway.app';
    const status=panel.querySelector('#gh-status'),codeInput=panel.querySelector('#gh-code'),roomLabel=panel.querySelector('#gh-room');
    const act=(id,fn)=>panel.querySelector('#gh-'+id).onclick=async()=>{try{await fn();}catch(e){message(e.message||String(e));}};
    act('record',()=>{if(network)throw Error('Leave the room before recording');restartThen(record);});act('stop',stop);act('play',()=>{if(network)throw Error('Leave the room before local playback');if(!saved)throw Error('Record or import a run first');if(!core.compatible(meta,saved.meta))throw Error('Load the recorded level first');restartThen(play);});
    act('clear',()=>{playback=null;clear(localGroup,localSprites);message('Local ghost hidden.');});
    act('connect',()=>connect(panel.querySelector('#gh-url').value,codeInput.value,panel.querySelector('#gh-name').value));act('ready',readyUp);
    act('leave',()=>{disconnect();thawWorld(session);message('Left room.');});
    act('summon',summon);
    async function openSecond(){if(window.hwGhostNet?.openPeer){await hwGhostNet.openPeer();return;}lab.testPeer=window.open(location.href,'ghost-local-peer','width=1000,height=700');if(!lab.testPeer)throw Error('The second window was blocked');}
    act('second',openSecond);
    act('export',()=>{if(recording)stop();if(!saved)throw Error('Record a run first');const blob=new Blob([JSON.stringify(saved)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='happy-wheels-ghost-'+saved.meta.level+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);});
    act('import',()=>{const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>64*1024*1024)throw Error('Ghost file exceeds 64 MB');lab.importRecording(JSON.parse(await file.text()));}catch(e){message(e.message);}};input.click();});
    act('collapse',()=>{const body=panel.querySelector('#gh-body');body.hidden=!body.hidden;});
    panel.addEventListener('keydown',e=>e.stopPropagation());panel.addEventListener('keyup',e=>e.stopPropagation());
    window.addEventListener('keydown',e=>{if(window.HWGhostConfig?.development&&e.code==='F8'){panel.hidden=!panel.hidden;e.preventDefault();}},true);
    ui=window.HWMultiplayerUI(lab,{connect,leave:()=>{disconnect();thawWorld(session);message('Left room.');},ready:readyUp,readyVote,summon,openSecond,message});
    lab.ui=ui;
    message('Open Multiplayer to join or host a room.');
    let db=null;
    const request=indexedDB.open('hw-ghost-recordings',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('runs');
    request.onsuccess=()=>{db=request.result;const get=db.transaction('runs').objectStore('runs').get('last');get.onsuccess=()=>{if(get.result&&!saved){try{saved=core.validateRecording(get.result);lab.saved=saved;}catch{}}};};
    function persist(run){if(db){const tx=db.transaction('runs','readwrite');tx.objectStore('runs').put(run,'last');tx.onerror=()=>message('Recording is in memory; use Export run to keep it.');}}
  }
})();
