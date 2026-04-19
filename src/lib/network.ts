import type { Connection, NetworkStat, ProcessUsageEntry } from '../types'

export type StoredHistoryRange = '1h' | '24h' | '7d'

type TrafficSnapshot = Pick<NetworkStat, 'rx_sec' | 'tx_sec'> | null | undefined

type InterfaceTraffic = Partial<Pick<NetworkStat, 'iface' | 'operstate' | 'rx_sec' | 'tx_sec'>>

export const HISTORY_SAMPLE_STEPS: Record<StoredHistoryRange, number> = {
  '1h': 1,
  '24h': 60,
  '7d': 300,
}

export function getHistorySampleStep(range: StoredHistoryRange) {
  return HISTORY_SAMPLE_STEPS[range]
}

export function aggregateTrafficStats(networkStats: InterfaceTraffic[]): NetworkStat {
  let totalRx = 0
  let totalTx = 0
  let activeIface = ''
  let hasActiveInterface = false

  for (const iface of networkStats) {
    const rx = iface.rx_sec ?? 0
    const tx = iface.tx_sec ?? 0
    const isActive = iface.operstate === 'up' || rx > 0 || tx > 0

    if (!isActive) {
      continue
    }

    totalRx += rx
    totalTx += tx
    hasActiveInterface = true

    if (!activeIface && iface.iface) {
      activeIface = iface.iface
    }
  }

  return {
    rx_sec: totalRx,
    tx_sec: totalTx,
    iface: activeIface || 'merged',
    operstate: hasActiveInterface ? 'up' : 'down',
  }
}

export function buildProcessUsage(
  connections: Connection[],
  trafficStats: TrafficSnapshot,
  limit = 8,
): ProcessUsageEntry[] {
  const aggregated = new Map<number, { name: string; pid: number; connections: number; tcp: number; udp: number }>()

  for (const conn of connections) {
    const pid = typeof conn.pid === 'number' ? conn.pid : -1
    const existing = aggregated.get(pid) ?? {
      name: conn.process || 'System',
      pid,
      connections: 0,
      tcp: 0,
      udp: 0,
    }

    existing.connections += 1
    existing.name = conn.process || existing.name

    const protocol = (conn.protocol || '').toLowerCase()
    if (protocol.startsWith('tcp')) {
      existing.tcp += 1
    } else if (protocol.startsWith('udp')) {
      existing.udp += 1
    }

    aggregated.set(pid, existing)
  }

  const totals = Array.from(aggregated.values())
  const connectionTotal = totals.reduce((sum, entry) => sum + entry.connections, 0) || 1
  const rxSec = trafficStats?.rx_sec || 0
  const txSec = trafficStats?.tx_sec || 0

  return totals
    .map((entry) => {
      const ratio = entry.connections / connectionTotal
      return {
        pid: entry.pid,
        name: entry.name,
        connections: entry.connections,
        tcp: entry.tcp,
        udp: entry.udp,
        rx: rxSec * ratio,
        tx: txSec * ratio,
        activityScore: ratio,
      }
    })
    .sort((a, b) => b.activityScore - a.activityScore)
    .slice(0, limit)
}

function isPrivateIpv4(ip: string) {
  const octets = ip.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  if (octets[0] === 10 || octets[0] === 127) {
    return true
  }

  if (octets[0] === 169 && octets[1] === 254) {
    return true
  }

  if (octets[0] === 192 && octets[1] === 168) {
    return true
  }

  return octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31
}

export function isPrivateOrLocalIp(ip: string) {
  const normalizedIp = ip.trim().toLowerCase()

  if (!normalizedIp) {
    return true
  }

  if (normalizedIp === '::1' || normalizedIp.startsWith('fe80:') || normalizedIp.startsWith('fc') || normalizedIp.startsWith('fd')) {
    return true
  }

  if (normalizedIp.includes(':')) {
    return false
  }

  return isPrivateIpv4(normalizedIp)
}
