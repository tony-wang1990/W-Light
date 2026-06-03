const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('wLightDesktop', {
  platform: process.platform,
});
