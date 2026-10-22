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
  /** Structured direction — prefer over parsing title. Added to avoid fragile string matching. */
  direction?: 'rx' | 'tx'
  rxSec?: number
  txSec?: number
  rateBps?: number
  rateLabel?: string
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
  getIpLocations: 'get-ip-locations',
  getNetworkConnections: 'get-network-connections',
  getOverlayMode: 'get-overlay-mode',
  getOverlayOpen: 'get-overlay-open',
  getTrafficStats: 'get-traffic-stats',
  killProcess: 'kill-process',
  latencyUpdate: 'latency-update',
  overlayClosed: 'overlay-closed',
  overlayModeChanged: 'overlay-mode-changed',
  setOverlayMode: 'set-overlay-mode',
  setTelemetryPaused: 'set-telemetry-paused',
  toggleOverlay: 'toggle-overlay',
  trafficUpdate: 'traffic-update',
  updateSettings: 'update-settings',
  watchSighting: 'watch-sighting',
} as const

export interface DesktopApi {
  getIpLocations: (ips: string[]) => Promise<Record<string, IpLocation | null>>
  getNetworkConnections: () => Promise<Connection[]>
  getOverlayMode: () => Promise<OverlayMode>
  getOverlayOpen: () => Promise<boolean>
  getTrafficStats: () => Promise<NetworkStat | null>
  killProcess: (pid: number) => Promise<boolean>
  onLatencyUpdate: (listener: (payload: LatencyPayload) => void) => () => void
  onAlertTriggered: (listener: (payload: AlertPayload) => void) => () => void
  onAppBeforeQuit: (listener: () => void) => () => void
  onConnectionsUpdate: (listener: (connections: Connection[]) => void) => () => void
  onOverlayClosed: (listener: () => void) => () => void
  onOverlayModeChange: (listener: (mode: OverlayMode) => void) => () => void
  onTrafficUpdate: (listener: (stats: NetworkStat) => void) => () => void
  setOverlayMode: (mode: OverlayMode) => Promise<boolean>
  setTelemetryPaused: (durationMs: number) => void
  toggleOverlay: () => Promise<boolean>
  updateSettings: (settings: Settings) => void
  /** Fire-and-forget: asks main to show an OS notification for a watchlist hit. */
  notifyWatchSighting: (processName: string) => void
}

/** Guard: returns true if the desktop bridge is available (Electron context) */
export function isDesktopAvailable(): boolean {
  return getDesktop() !== null
}

/** Default timeout for IPC invoke calls — prevents renderer hangs if main is busy. */
export const IPC_TIMEOUT_MS = 5000

/** Returns the desktop bridge, or null outside Electron / if preload failed. */
export function getDesktop(): DesktopApi | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as unknown as { desktop?: DesktopApi }).desktop
  return candidate ?? null
}

/**
 * Races an IPC promise against a timeout so a stalled main process
 * can't hang the renderer forever. Rejects with Error on timeout.
 */
export function invokeWithTimeout<T>(task: () => Promise<T>, timeoutMs = IPC_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`IPC timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  return Promise.race([task(), timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
