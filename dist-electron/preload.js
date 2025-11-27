"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  },
  // Specific APIs
  getNetworkStats: () => electron.ipcRenderer.invoke("get-network-stats"),
  getNetworkConnections: () => electron.ipcRenderer.invoke("get-network-connections"),
  getProcessUsage: () => electron.ipcRenderer.invoke("get-process-usage"),
  killProcess: (pid) => electron.ipcRenderer.invoke("kill-process", pid),
  getIpLocation: (ip) => electron.ipcRenderer.invoke("get-ip-location", ip),
  toggleOverlay: () => electron.ipcRenderer.invoke("toggle-overlay")
});
