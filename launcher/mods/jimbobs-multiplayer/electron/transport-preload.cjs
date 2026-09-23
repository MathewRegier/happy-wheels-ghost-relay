(() => {
  const {contextBridge,ipcRenderer}=require('electron');
  contextBridge.exposeInMainWorld('hwGhostNet',{
    connect:url=>ipcRenderer.invoke('ghost:connect',url),
    send:data=>ipcRenderer.send('ghost:send',data),
    disconnect:()=>ipcRenderer.send('ghost:disconnect'),
    openPeer:()=>ipcRenderer.invoke('ghost:open-peer'),
    onEvent:fn=>{const listener=(_event,data)=>fn(data);ipcRenderer.on('ghost:network',listener);return()=>ipcRenderer.removeListener('ghost:network',listener);}
  });
})();
