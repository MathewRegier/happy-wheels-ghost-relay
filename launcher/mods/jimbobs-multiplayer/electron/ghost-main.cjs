'use strict';
// Development-only local inspection channel. Never exposed over the network.
const {app, BrowserWindow, ipcMain, session, shell} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const sockets=new Map();
const GAME_ORIGIN='https://totaljerkface.com/__hw_app__/';
function childPrefs(){
  return {preload:path.join(__dirname,'preload.js'),devTools:false,contextIsolation:true,nodeIntegration:false,sandbox:false,backgroundThrottling:false,spellcheck:false,enableWebSQL:false,webviewTag:false};
}
function check(event){if(!event.senderFrame?.url.startsWith('https://totaljerkface.com/__hw_app__/'))throw Error('Invalid ghost sender');}
ipcMain.handle('ghost:connect',async(event,url)=>{
  check(event);const parsed=new URL(url);
  if(!['ws:','wss:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Invalid relay address');
  const id=event.sender.id;
  const previous=sockets.get(id);
  if(previous){previous.removeAllListeners('close');previous.removeAllListeners('error');previous.removeAllListeners('message');previous.close();}
  const ws=new WebSocket(parsed.href,{maxPayload:512*1024,perMessageDeflate:false,handshakeTimeout:8000,followRedirects:false});sockets.set(id,ws);
  const emit=(type,data)=>{if(sockets.get(id)===ws&&!event.sender.isDestroyed())event.sender.send('ghost:network',{type,data});};
  ws.on('message',data=>emit('message',data.toString()));ws.on('error',()=>emit('error','Relay connection failed'));
  ws.on('close',()=>{if(sockets.get(id)===ws){emit('close');sockets.delete(id);}});
  event.sender.once('destroyed',()=>ws.close());
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});return true;
});
ipcMain.on('ghost:send',(event,data)=>{check(event);const ws=sockets.get(event.sender.id);if(typeof data==='string'&&Buffer.byteLength(data)<=512*1024&&ws?.readyState===1&&ws.bufferedAmount<1024*1024)ws.send(data);});
ipcMain.on('ghost:disconnect',event=>{check(event);sockets.get(event.sender.id)?.close();});
ipcMain.handle('ghost:open-peer',event=>{
  check(event);
  const win=new BrowserWindow({width:1000,height:700,backgroundColor:'#000000',webPreferences:childPrefs()});
  win.loadURL(event.sender.getURL()||'https://totaljerkface.com/__hw_app__/index.html');
  return true;
});
app.on('web-contents-created',(_event,contents)=>{
  contents.setWindowOpenHandler(({url})=>{
    if(url.startsWith(GAME_ORIGIN))return{action:'allow',overrideBrowserWindowOptions:{width:1000,height:700,backgroundColor:'#000000',webPreferences:childPrefs()}};
    if(/^https?:/.test(url))shell.openExternal(url);
    return{action:'deny'};
  });
});
app.whenReady().then(()=>{
  session.defaultSession.on('will-download',(event,item)=>{
    if(/^happy-wheels-ghost-\d+\.json$/.test(item.getFilename())&&item.getURL().startsWith('blob:')){
      const dir=path.resolve(process.resourcesPath,'../../recordings');fs.mkdirSync(dir,{recursive:true});
      item.setSavePath(path.join(dir,Date.now()+'-'+item.getFilename()));
    }
  });
});
app.on('will-quit',()=>{for(const ws of sockets.values())ws.close();});
if (process.env.HW_GHOST_DEV === '1') {
  const dir = path.resolve(process.resourcesPath, '../../dev');
  fs.mkdirSync(dir, {recursive:true});
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    const request = path.join(dir, 'request.json');
    if (!fs.existsSync(request)) return;
    busy = true;
    let id;
    try {
      const command = JSON.parse(fs.readFileSync(request, 'utf8'));
      fs.unlinkSync(request);
      id = command.id;
      const windows=BrowserWindow.getAllWindows().sort((a,b)=>a.id-b.id);
      const win = windows[command.window||0];
      if (!win) throw new Error('Game window not ready');
      const result = await win.webContents.executeJavaScript(command.code, true);
      fs.writeFileSync(path.join(dir, 'response.json'), JSON.stringify({id,result}));
    } catch (error) {
      fs.writeFileSync(path.join(dir, 'response.json'), JSON.stringify({id,error:String(error)}));
    } finally {busy = false;}
  }, 100);
  app.on('will-quit', () => clearInterval(timer));
}
