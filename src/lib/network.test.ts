import { describe, expect, it } from 'vitest'
import { aggregateTrafficStats, buildProcessUsage, getHistorySampleStep, isPrivateOrLocalIp } from './network'
import type { Connection } from '../types'

describe('aggregateTrafficStats', () => {
  it('aggregates active interfaces and ignores idle disconnected ones', () => {
    const aggregated = aggregateTrafficStats([
      { iface: 'Ethernet', operstate: 'up', rx_sec: 100, tx_sec: 25 },
      { iface: 'Wi-Fi', operstate: 'down', rx_sec: 50, tx_sec: 5 },
      { iface: 'VPN', operstate: 'up', rx_sec: 20, tx_sec: 10 },
      { iface: 'Loopback', operstate: 'down', rx_sec: 0, tx_sec: 0 },
    ])

    expect(aggregated).toEqual({
      iface: 'Ethernet',
      operstate: 'up',
      rx_sec: 170,
      tx_sec: 40,
    })
  })

  it('falls back to a merged placeholder when nothing is active', () => {
    expect(aggregateTrafficStats([])).toEqual({
      iface: 'merged',
      operstate: 'down',
      rx_sec: 0,
      tx_sec: 0,
    })
  })
})

describe('buildProcessUsage', () => {
  const connections: Connection[] = [
    {
      pid: 1001,
      process: 'chrome.exe',
      protocol: 'tcp4',
      localAddress: '127.0.0.1',
      localPort: '50000',
      peerAddress: '8.8.8.8',
      peerPort: '443',
      state: 'ESTABLISHED',
    },
    {
      pid: 1001,
      process: 'chrome.exe',
      protocol: 'udp4',
      localAddress: '127.0.0.1',
      localPort: '50001',
      peerAddress: '8.8.4.4',
      peerPort: '443',
      state: 'ESTABLISHED',
    },
    {
      pid: 2002,
      process: 'spotify.exe',
      protocol: 'tcp4',
      localAddress: '127.0.0.1',
      localPort: '50002',
      peerAddress: '1.1.1.1',
      peerPort: '443',
      state: 'ESTABLISHED',
    },
  ]

  it('ranks processes by connection share and derives approximate throughput', () => {
    const ranked = buildProcessUsage(connections, { rx_sec: 300, tx_sec: 150 })

    expect(ranked).toHaveLength(2)
    expect(ranked[0]).toMatchObject({
      pid: 1001,
      name: 'chrome.exe',
      connections: 2,
      tcp: 1,
      udp: 1,
      rx: 200,
      tx: 100,
    })
    expect(ranked[1]).toMatchObject({
      pid: 2002,
      name: 'spotify.exe',
      connections: 1,
      tcp: 1,
      udp: 0,
      rx: 100,
      tx: 50,
    })
  })
})

describe('isPrivateOrLocalIp', () => {
  it('detects loopback, link-local, and private IPv4 ranges', () => {
    expect(isPrivateOrLocalIp('127.0.0.1')).toBe(true)
    expect(isPrivateOrLocalIp('::1')).toBe(true)
    expect(isPrivateOrLocalIp('10.0.0.8')).toBe(true)
    expect(isPrivateOrLocalIp('172.20.5.4')).toBe(true)
    expect(isPrivateOrLocalIp('192.168.1.10')).toBe(true)
    expect(isPrivateOrLocalIp('169.254.10.20')).toBe(true)
  })

  it('leaves public addresses alone', () => {
    expect(isPrivateOrLocalIp('8.8.8.8')).toBe(false)
    expect(isPrivateOrLocalIp('172.32.0.1')).toBe(false)
  })
})

describe('getHistorySampleStep', () => {
  it('returns the expected sample cadence for each history range', () => {
    expect(getHistorySampleStep('1h')).toBe(1)
    expect(getHistorySampleStep('24h')).toBe(60)
    expect(getHistorySampleStep('7d')).toBe(300)
  })
})
