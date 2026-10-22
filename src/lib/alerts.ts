import type { AlertLogEntry } from '../types'
import type { AlertPayload } from './ipc'

export interface ResolvedAlert {
  time: string
  direction: AlertLogEntry['direction']
  rate: string
  rateBps: number
}

const RATE_UNITS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  TB: 1024 * 1024 * 1024 * 1024,
}

/** Parses legacy formatted labels such as "1.2 MB/s" into bytes/sec. */
export function parseRateToBps(rate: string) {
  const match = rate.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB)\/s$/i)
  if (!match) return 0

  const value = Number(match[1])
  const multiplier = RATE_UNITS[match[2].toUpperCase()]
  return Number.isFinite(value) && multiplier ? value * multiplier : 0
}

/**
 * Resolves a structured alert log entry from an IPC payload.
 * Prefers structured fields (direction/rateBps) sent by main;
 * falls back to legacy title/body string parsing.
 */
export function resolveAlertEntry(data: AlertPayload): ResolvedAlert {
  const direction: AlertLogEntry['direction'] =
    data.direction ?? (data.title.toLowerCase().includes('download') ? 'rx' : 'tx')
  const rateMatch = data.body.match(/speed: (.*)/i)
  const rate = data.rateLabel ?? (rateMatch ? rateMatch[1] : 'High')
  const directionalRate = direction === 'rx' ? data.rxSec : data.txSec
  const structuredRate = data.rateBps ?? directionalRate
  const rateBps = typeof structuredRate === 'number' && Number.isFinite(structuredRate)
    ? Math.max(0, structuredRate)
    : parseRateToBps(rate)
  const time = data.time ? new Date(data.time).toLocaleTimeString() : new Date().toLocaleTimeString()
  return { time, direction, rate, rateBps }
}
