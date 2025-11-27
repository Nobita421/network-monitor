export interface NetworkStat {
  rx_sec: number
  tx_sec: number
  iface: string
  operstate: string
}

export interface Connection {
  protocol: string
  localAddress: string
  localPort: string
  peerAddress: string
  peerPort: string
  state: string
  process: string
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
}

export type HistoryPoint = { time: string; rx: number; tx: number }
export type HistoryRange = '30s' | '60s' | '5m'

export type Settings = {
  threshold: number
  cooldownMinutes: number
  pauseMinutes: number
}
