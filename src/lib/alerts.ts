import type { AlertLogEntry } from '../types'
import type { AlertPayload } from './ipc'

export interface ResolvedAlert {
  time: string
  direction: AlertLogEntry['direction']
  rate: string
}

/**
 * Resolves a structured alert log entry from an IPC payload.
 * Prefers structured fields (direction/rateLabel) sent by main;
 * falls back to legacy title/body string parsing.
 */
export function resolveAlertEntry(data: AlertPayload): ResolvedAlert {
  const direction: AlertLogEntry['direction'] =
    data.direction ?? (data.title.toLowerCase().includes('download') ? 'rx' : 'tx')
  const rateMatch = data.body.match(/speed: (.*)/i)
  const rate = data.rateLabel ?? (rateMatch ? rateMatch[1] : 'High')
  const time = data.time ? new Date(data.time).toLocaleTimeString() : new Date().toLocaleTimeString()
  return { time, direction, rate }
}
