import { ipcRenderer, contextBridge } from 'electron'
import type {
  AlertPayload,
  DesktopApi,
  LatencyPayload,
  OverlayMode,
} from '../src/lib/ipc'
import type { NetworkStat } from '../src/types'

// Keep in sync with IPC_CHANNELS in src/lib/ipc.ts. Inlining these values keeps
// each sandboxed preload self-contained (sandboxed preloads cannot require
// shared local chunks).
const OVERLAY_CHANNELS = {
  alertTriggered: 'alert-triggered',
  getOverlayMode: 'get-overlay-mode',
  getTrafficStats: 'get-traffic-stats',
  latencyUpdate: 'latency-update',
  overlayModeChanged: 'overlay-mode-changed',
  setOverlayMode: 'set-overlay-mode',
  trafficUpdate: 'traffic-update',
} as const

function subscribe<T>(channel: string, listener: (payload: T) => void) {
  const wrappedListener = (_event: Electron.IpcRendererEvent, payload: T) => {
    listener(payload)
  }

  ipcRenderer.on(channel, wrappedListener)
  return () => {
    ipcRenderer.off(channel, wrappedListener)
  }
}

/**
 * Overlay window bridge. Deliberately omits process control, settings, and
 * connection-list APIs so the always-on-top window has the smallest surface.
 */
const overlayApi: Pick<
  DesktopApi,
  | 'getOverlayMode'
  | 'getTrafficStats'
  | 'onAlertTriggered'
  | 'onLatencyUpdate'
  | 'onOverlayModeChange'
  | 'onTrafficUpdate'
  | 'setOverlayMode'
> = {
  getOverlayMode: () => ipcRenderer.invoke(OVERLAY_CHANNELS.getOverlayMode) as Promise<OverlayMode>,
  getTrafficStats: () => ipcRenderer.invoke(OVERLAY_CHANNELS.getTrafficStats) as Promise<NetworkStat | null>,
  onAlertTriggered: (listener: (payload: AlertPayload) => void) => subscribe(OVERLAY_CHANNELS.alertTriggered, listener),
  onLatencyUpdate: (listener: (payload: LatencyPayload) => void) => subscribe(OVERLAY_CHANNELS.latencyUpdate, listener),
  onOverlayModeChange: (listener: (mode: OverlayMode) => void) => subscribe(OVERLAY_CHANNELS.overlayModeChanged, listener),
  onTrafficUpdate: (listener: (stats: NetworkStat) => void) => subscribe(OVERLAY_CHANNELS.trafficUpdate, listener),
  setOverlayMode: (mode: OverlayMode) => ipcRenderer.invoke(OVERLAY_CHANNELS.setOverlayMode, mode) as Promise<boolean>,
}

contextBridge.exposeInMainWorld('desktop', overlayApi)
