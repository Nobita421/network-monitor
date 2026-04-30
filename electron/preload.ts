import { ipcRenderer, contextBridge } from 'electron'
import { IPC_CHANNELS, type AlertPayload, type DesktopApi, type LatencyPayload, type OverlayMode } from '../src/lib/ipc'
import type { Connection, NetworkStat, Settings } from '../src/types'

function subscribe<T>(channel: string, listener: (payload: T) => void) {
  const wrappedListener = (_event: Electron.IpcRendererEvent, payload: T) => {
    listener(payload)
  }

  ipcRenderer.on(channel, wrappedListener)
  return () => {
    ipcRenderer.off(channel, wrappedListener)
  }
}

const desktopApi: DesktopApi = {
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.getAppVersion),
  getIpLocations: (ips: string[]) => ipcRenderer.invoke(IPC_CHANNELS.getIpLocations, ips),
  getNetworkConnections: () => ipcRenderer.invoke(IPC_CHANNELS.getNetworkConnections) as Promise<Connection[]>,
  getTrafficStats: () => ipcRenderer.invoke(IPC_CHANNELS.getTrafficStats) as Promise<NetworkStat | null>,
  killProcess: (pid: number) => ipcRenderer.invoke(IPC_CHANNELS.killProcess, pid),
  onAlertTriggered: (listener: (payload: AlertPayload) => void) => subscribe(IPC_CHANNELS.alertTriggered, listener),
  onAppBeforeQuit: (listener: () => void) => subscribe(IPC_CHANNELS.appBeforeQuit, listener),
  onConnectionsUpdate: (listener: (connections: Connection[]) => void) => subscribe(IPC_CHANNELS.connectionsUpdate, listener),
  onLatencyUpdate: (listener: (payload: LatencyPayload) => void) => subscribe(IPC_CHANNELS.latencyUpdate, listener),
  onTrafficUpdate: (listener: (stats: NetworkStat) => void) => subscribe(IPC_CHANNELS.trafficUpdate, listener),
  setOverlayMode: (mode: OverlayMode) => ipcRenderer.invoke(IPC_CHANNELS.setOverlayMode, mode),
  setTelemetryPaused: (durationMs: number) => {
    ipcRenderer.send(IPC_CHANNELS.setTelemetryPaused, durationMs)
  },
  toggleOverlay: () => ipcRenderer.invoke(IPC_CHANNELS.toggleOverlay),
  updateSettings: (settings: Settings) => {
    ipcRenderer.send(IPC_CHANNELS.updateSettings, settings)
  },
}

contextBridge.exposeInMainWorld('desktop', desktopApi)
