import { describe, expect, it } from 'vitest'
import {
  findNewSightings,
  findWatchedConnections,
  isWatchedProcess,
  isWatchSightingDue,
  MAX_WATCHLIST_ENTRIES,
  normalizeWatchEntry,
  sanitizeWatchlist,
  WATCH_SIGHTING_NOTIFY_COOLDOWN_MS,
} from './watchlist'
import type { Connection } from '../types'

function conn(process: string | undefined, pid = 1): Connection {
  return {
    protocol: 'TCP', localAddress: '10.0.0.1', localPort: '1',
    peerAddress: '8.8.8.8', peerPort: '443', state: 'ESTABLISHED',
    process: process ?? '', pid,
  }
}

describe('normalizeWatchEntry', () => {
  it('lowercases and trims', () => {
    expect(normalizeWatchEntry('  Chrome.EXE ')).toBe('chrome.exe')
  })

  it('rejects empty, non-string, and overlong input', () => {
    expect(normalizeWatchEntry('')).toBeNull()
    expect(normalizeWatchEntry('   ')).toBeNull()
    expect(normalizeWatchEntry(123)).toBeNull()
    expect(normalizeWatchEntry('x'.repeat(101))).toBeNull()
  })
})

describe('sanitizeWatchlist', () => {
  it('dedupes, normalizes, and caps entries', () => {
    expect(sanitizeWatchlist(['Chrome.exe', 'chrome.EXE', '', 42, 'ssh'])).toEqual(['chrome.exe', 'ssh'])
  })

  it('returns [] for non-arrays and caps at the max', () => {
    expect(sanitizeWatchlist(null)).toEqual([])
    expect(sanitizeWatchlist('chrome')).toEqual([])
    const many = Array.from({ length: MAX_WATCHLIST_ENTRIES + 5 }, (_, i) => `proc${i}.exe`)
    expect(sanitizeWatchlist(many)).toHaveLength(MAX_WATCHLIST_ENTRIES)
  })
})

describe('isWatchedProcess / findWatchedConnections', () => {
  it('matches case-insensitively and handles empty watchlists', () => {
    expect(isWatchedProcess('Chrome.EXE', ['chrome.exe'])).toBe(true)
    expect(isWatchedProcess('other.exe', ['chrome.exe'])).toBe(false)
    expect(isWatchedProcess('chrome.exe', [])).toBe(false)
    expect(isWatchedProcess(undefined, ['chrome.exe'])).toBe(false)
  })

  it('filters connections to watched processes', () => {
    const connections = [conn('chrome.exe'), conn('ssh.exe'), conn(undefined)]
    expect(findWatchedConnections(connections, ['chrome.exe'])).toHaveLength(1)
    expect(findWatchedConnections(connections, [])).toEqual([])
  })
})

describe('findNewSightings', () => {
  it('returns names present now but absent before', () => {
    const prev = [conn('chrome.exe')]
    const next = [conn('chrome.exe'), conn('SSH.exe', 2)]
    expect(findNewSightings(prev, next)).toEqual(['SSH.exe'])
  })

  it('returns [] when nothing new appears', () => {
    const prev = [conn('chrome.exe')]
    expect(findNewSightings(prev, [conn('Chrome.EXE', 9)])).toEqual([])
    expect(findNewSightings([], [])).toEqual([])
  })
})

describe('isWatchSightingDue', () => {
  it('is due on first sighting and after the cooldown', () => {
    expect(isWatchSightingDue(undefined, 1000)).toBe(true)
    expect(isWatchSightingDue(0, WATCH_SIGHTING_NOTIFY_COOLDOWN_MS)).toBe(true)
    expect(isWatchSightingDue(0, WATCH_SIGHTING_NOTIFY_COOLDOWN_MS - 1)).toBe(false)
  })
})
