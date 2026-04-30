export interface NetworkStat {
  rx_sec: number
  tx_sec: number
  rx_bytes?: number
  tx_bytes?: number
  sampledAt?: number
  iface: string
  operstate: string
  ping?: number
}

export interface Connection {
  protocol: string
  localAddress: string
  localPort: string
  peerAddress: string
  peerPort: string
  state: string
  process: string
  pid?: number
}

export interface ProcessUsageEntry {
  pid: number
  name: string
  connections: number
  rx: number
  tx: number
  activityScore: number
  tcp: number
  udp: number
  isEstimated?: boolean
}

export interface AlertLogEntry {
  time: string
  direction: 'rx' | 'tx'
  rate: string
}

export type HistoryPoint = { time: string; isoTime: string; rx: number; tx: number }
export type HistoryRange = '30s' | '60s' | '5m'

export type Settings = {
  threshold: number
  cooldownMinutes: number
  pauseMinutes: number
}

/** Centralized Tab type — used across App, Header, Sidebar, CommandPalette */
export type Tab = 'dashboard' | 'connections' | 'map' | 'history'
