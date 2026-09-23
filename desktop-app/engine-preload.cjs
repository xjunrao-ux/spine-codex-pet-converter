const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopEngine", {
  reportProgress: (progress) => ipcRenderer.send("engine-progress", progress),
});
