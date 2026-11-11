const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('afterTheRainDesktop', {
  getFullscreen: () => ipcRenderer.invoke('display:get-fullscreen'),
  toggleFullscreen: () => ipcRenderer.invoke('display:toggle-fullscreen'),
  onFullscreenChange: callback => {
    ipcRenderer.on('display:fullscreen-changed', (_event, fullscreen) => callback(fullscreen));
  },
  close: () => ipcRenderer.invoke('display:close'),
});
