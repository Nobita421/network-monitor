import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // Specific APIs
  getTrafficStats: () => ipcRenderer.invoke('get-traffic-stats'),
  getNetworkConnections: () => ipcRenderer.invoke('get-network-connections'),
  // getProcessUsage is deprecated, logic moved to renderer
  killProcess: (pid: number) => ipcRenderer.invoke('kill-process', pid),
  getIpLocations: (ips: string[]) => ipcRenderer.invoke('get-ip-locations', ips),
  toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),
})
