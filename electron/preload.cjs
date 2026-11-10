const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ruang', {
  hasApiKey: () => ipcRenderer.invoke('settings:has-key'),
  setApiKey: (key) => ipcRenderer.invoke('settings:set-key', key),
  chat: (request) => ipcRenderer.invoke('ai:chat', request),
})
