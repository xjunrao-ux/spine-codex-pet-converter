const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petTool", {
  chooseInput: () => ipcRenderer.invoke("choose-input"),
  chooseOutput: () => ipcRenderer.invoke("choose-output"),
  chooseConfig: () => ipcRenderer.invoke("choose-config"),
  inspect: (options) => ipcRenderer.invoke("inspect-model", options),
  convert: (options) => ipcRenderer.invoke("convert-model", options),
  openOutput: (folder) => ipcRenderer.invoke("open-output", folder),
  onProgress: (callback) => ipcRenderer.on("job-progress", (_event, value) => callback(value)),
  onLog: (callback) => ipcRenderer.on("job-log", (_event, value) => callback(value)),
});
