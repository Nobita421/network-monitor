import type { Connection, NetworkStat, Settings } from '../types'

export interface IpLocation {
  lat: number
  lon: number
  country: string
  city: string
  isp?: string
  asn?: string
}

export interface AlertPayload {
  title: string
  body: string
  time: string
}

export interface LatencyPayload {
  ping: number
  sampledAt: number
}

export type OverlayMode = 'locked' | 'unlocked'

export const IPC_CHANNELS = {
  alertTriggered: 'alert-triggered',
  appBeforeQuit: 'app-before-quit',
  connectionsUpdate: 'connections-update',
  getAppVersion: 'get-app-version',
  getIpLocations: 'get-ip-locations',
  getNetworkConnections: 'get-network-connections',
  getTrafficStats: 'get-traffic-stats',
  killProcess: 'kill-process',
  latencyUpdate: 'latency-update',
  setOverlayMode: 'set-overlay-mode',
  setTelemetryPaused: 'set-telemetry-paused',
  toggleOverlay: 'toggle-overlay',
  trafficUpdate: 'traffic-update',
  updateSettings: 'update-settings',
} as const

export interface DesktopApi {
  getAppVersion: () => Promise<string>
  getIpLocations: (ips: string[]) => Promise<Record<string, IpLocation | null>>
  getNetworkConnections: () => Promise<Connection[]>
  getTrafficStats: () => Promise<NetworkStat | null>
  killProcess: (pid: number) => Promise<boolean>
  onLatencyUpdate: (listener: (payload: LatencyPayload) => void) => () => void
  onAlertTriggered: (listener: (payload: AlertPayload) => void) => () => void
  onAppBeforeQuit: (listener: () => void) => () => void
  onConnectionsUpdate: (listener: (connections: Connection[]) => void) => () => void
  onTrafficUpdate: (listener: (stats: NetworkStat) => void) => () => void
  setOverlayMode: (mode: OverlayMode) => Promise<boolean>
  setTelemetryPaused: (durationMs: number) => void
  toggleOverlay: () => Promise<boolean>
  updateSettings: (settings: Settings) => void
}

/** Guard: returns true if the desktop bridge is available (Electron context) */
export function isDesktopAvailable(): boolean {
  return typeof window !== 'undefined' && 'desktop' in window && window.desktop != null
}
