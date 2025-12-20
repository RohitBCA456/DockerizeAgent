// frontend/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  loginWithGoogle: () => ipcRenderer.send('login-google'),
  onAuthSuccess: (callback) => ipcRenderer.on('auth-success', (_event, value) => callback(value)),

  openFolderDialog: () => ipcRenderer.invoke('dialog:openDirectory'),

  openExternalLink: (url) => ipcRenderer.send('open-external-link', url)
});