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

export type OverlayMode = 'locked' | 'unlocked'

export const IPC_CHANNELS = {
  alertTriggered: 'alert-triggered',
  connectionsUpdate: 'connections-update',
  getIpLocations: 'get-ip-locations',
  getNetworkConnections: 'get-network-connections',
  getTrafficStats: 'get-traffic-stats',
  killProcess: 'kill-process',
  setOverlayMode: 'set-overlay-mode',
  setTelemetryPaused: 'set-telemetry-paused',
  toggleOverlay: 'toggle-overlay',
  trafficUpdate: 'traffic-update',
  updateSettings: 'update-settings',
} as const

export interface DesktopApi {
  getIpLocations: (ips: string[]) => Promise<Record<string, IpLocation | null>>
  getNetworkConnections: () => Promise<Connection[]>
  getTrafficStats: () => Promise<NetworkStat | null>
  killProcess: (pid: number) => Promise<boolean>
  onAlertTriggered: (listener: (payload: AlertPayload) => void) => () => void
  onConnectionsUpdate: (listener: (connections: Connection[]) => void) => () => void
  onTrafficUpdate: (listener: (stats: NetworkStat) => void) => () => void
  setOverlayMode: (mode: OverlayMode) => Promise<boolean>
  setTelemetryPaused: (durationMs: number) => void
  toggleOverlay: () => Promise<boolean>
  updateSettings: (settings: Settings) => void
}
