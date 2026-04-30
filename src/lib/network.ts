import type { Connection, NetworkStat, ProcessUsageEntry } from '../types'

export type StoredHistoryRange = '1h' | '24h' | '7d'

type TrafficSnapshot = Pick<NetworkStat, 'rx_sec' | 'tx_sec'> | null | undefined

type InterfaceTraffic = {
  iface?: string
  operstate?: string
  rx_sec?: number | null
  tx_sec?: number | null
  rx_bytes?: number | null
  tx_bytes?: number | null
}

const VALID_PROTOCOL_RE = /^(tcp|udp)(4|6)?$/i
const MAPPABLE_STATES = new Set(['ESTABLISHED', 'CLOSE_WAIT', 'SYN_SENT', 'SYN_RECV', 'SYN_RECEIVED'])

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
  let totalRxBytes = 0
  let totalTxBytes = 0
  let activeIface = ''
  let hasActiveInterface = false
  let hasByteCounters = false

  for (const iface of networkStats) {
    const rx = toFiniteNonNegativeNumber(iface.rx_sec)
    const tx = toFiniteNonNegativeNumber(iface.tx_sec)
    const rxBytes = toFiniteNonNegativeNumber(iface.rx_bytes)
    const txBytes = toFiniteNonNegativeNumber(iface.tx_bytes)
    const isActive = iface.operstate === 'up' || rx > 0 || tx > 0

    if (!isActive) {
      continue
    }

    totalRx += rx
    totalTx += tx
    totalRxBytes += rxBytes
    totalTxBytes += txBytes
    hasByteCounters ||= rxBytes > 0 || txBytes > 0
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
    ...(hasByteCounters ? { rx_bytes: totalRxBytes, tx_bytes: totalTxBytes } : {}),
  }
}

export function buildProcessUsage(
  connections: Connection[],
  trafficStats: TrafficSnapshot,
  limit = 8,
): ProcessUsageEntry[] {
  const aggregated = new Map<number, { name: string; pid: number; connections: number; tcp: number; udp: number }>()

  for (const conn of connections) {
    if (!isActiveTrafficConnection(conn)) continue

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
        isEstimated: true,
      }
    })
    .sort((a, b) => b.activityScore - a.activityScore)
    .slice(0, limit)
}

function toFiniteNonNegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

export function normalizeIpAddress(ip: string) {
  let normalizedIp = ip.trim().toLowerCase()

  if (normalizedIp.startsWith('[') && normalizedIp.endsWith(']')) {
    normalizedIp = normalizedIp.slice(1, -1)
  }

  if (normalizedIp.startsWith('::ffff:')) {
    normalizedIp = normalizedIp.slice('::ffff:'.length)
  }

  return normalizedIp
}

function isIpv4Address(ip: string) {
  const octets = ip.split('.').map(Number)
  return octets.length === 4 && octets.every((octet) =>
    Number.isInteger(octet) && octet >= 0 && octet <= 255
  )
}

function isPrivateIpv4(ip: string) {
  const octets = ip.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  if (
    octets[0] === 0 ||
    octets[0] === 10 ||
    octets[0] === 127 ||
    octets[0] >= 224
  ) {
    return true
  }

  if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) {
    return true
  }

  if (octets[0] === 169 && octets[1] === 254) {
    return true
  }

  if (octets[0] === 192 && octets[1] === 168) {
    return true
  }

  if (octets[0] === 192 && octets[1] === 0 && octets[2] === 0) {
    return true
  }

  if (octets[0] === 192 && octets[1] === 0 && octets[2] === 2) {
    return true
  }

  if (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19)) {
    return true
  }

  if (octets[0] === 198 && octets[1] === 51 && octets[2] === 100) {
    return true
  }

  if (octets[0] === 203 && octets[1] === 0 && octets[2] === 113) {
    return true
  }

  return (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    ip === '255.255.255.255'
}

export function isPrivateOrLocalIp(ip: string) {
  const normalizedIp = normalizeIpAddress(ip)

  if (!normalizedIp) {
    return true
  }

  if (
    normalizedIp === '::' ||
    normalizedIp === '::1' ||
    normalizedIp.startsWith('fe80:') ||
    normalizedIp.startsWith('fc') ||
    normalizedIp.startsWith('fd') ||
    normalizedIp.startsWith('ff') ||
    normalizedIp.startsWith('2001:db8:')
  ) {
    return true
  }

  if (normalizedIp.includes(':')) {
    return false
  }

  return isPrivateIpv4(normalizedIp)
}

export function isPublicRoutableIp(ip: string) {
  const normalizedIp = normalizeIpAddress(ip)
  if (!normalizedIp || isPrivateOrLocalIp(normalizedIp)) return false
  return normalizedIp.includes(':') || isIpv4Address(normalizedIp)
}

export function isValidConnection(conn: Connection) {
  const protocol = (conn.protocol || '').trim()
  const localAddress = normalizeIpAddress(conn.localAddress || '')
  const peerAddress = normalizeIpAddress(conn.peerAddress || '')

  if (!VALID_PROTOCOL_RE.test(protocol)) return false
  if (!localAddress && !peerAddress) return false
  if (localAddress === 'local' || peerAddress === 'address') return false
  if (conn.state.toLowerCase() === 'foreign') return false

  return true
}

export function isMappableConnection(conn: Connection) {
  if (!isValidConnection(conn)) return false
  const state = (conn.state || '').toUpperCase()
  if (state === 'LISTEN' || state === 'LISTENING') return false
  if (state && !MAPPABLE_STATES.has(state) && !(conn.protocol || '').toLowerCase().startsWith('udp')) return false
  return isPublicRoutableIp(conn.peerAddress)
}

export function isActiveTrafficConnection(conn: Connection) {
  if (!isValidConnection(conn)) return false
  const state = (conn.state || '').toUpperCase()
  if (state === 'LISTEN' || state === 'LISTENING' || state === 'TIME_WAIT') return false
  return Boolean(normalizeIpAddress(conn.peerAddress || ''))
}
