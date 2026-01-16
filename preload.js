const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronNotifications', {
  send: (title, body) => ipcRenderer.send('show-notification', { title, body })
});
