import type { Connection } from '../types'

export const MAX_WATCHLIST_ENTRIES = 50
const MAX_WATCH_ENTRY_LENGTH = 100
/** Minimum gap between OS notifications for the same watched process. */
export const WATCH_SIGHTING_NOTIFY_COOLDOWN_MS = 10 * 60 * 1000

/** Normalizes a watchlist entry; returns null when unusable. */
export function normalizeWatchEntry(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const normalized = name.trim().toLowerCase()
  if (!normalized || normalized.length > MAX_WATCH_ENTRY_LENGTH) return null
  return normalized
}

/** Sanitizes unknown input (settings payloads, drafts) into a watchlist. */
export function sanitizeWatchlist(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const entry of value) {
    const normalized = normalizeWatchEntry(entry)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      if (seen.size >= MAX_WATCHLIST_ENTRIES) break
    }
  }
  return [...seen]
}

export function isWatchedProcess(processName: string | undefined, watchlist: string[]) {
  if (!processName || watchlist.length === 0) return false
  return watchlist.includes(processName.trim().toLowerCase())
}

export function findWatchedConnections(connections: Connection[], watchlist: string[]) {
  if (watchlist.length === 0) return []
  return connections.filter((conn) => isWatchedProcess(conn.process, watchlist))
}

/**
 * Names present in `next` but absent from `prev` (both already filtered to
 * watched connections). Used for absent→present sighting alerts.
 */
export function findNewSightings(prevWatched: Connection[], nextWatched: Connection[]) {
  const prevNames = new Set(prevWatched.map((conn) => (conn.process ?? '').toLowerCase()))
  const fresh = new Set<string>()
  for (const conn of nextWatched) {
    const name = (conn.process ?? '').toLowerCase()
    if (name && !prevNames.has(name)) fresh.add(conn.process ?? '')
  }
  return [...fresh]
}

/**
 * Whether an OS notification is due for a sighting, given the last time we
 * notified for this process. Pure (takes `now`) for testability; main owns
 * the timestamp map.
 */
export function isWatchSightingDue(
  lastNotifiedAt: number | undefined,
  now: number,
  cooldownMs = WATCH_SIGHTING_NOTIFY_COOLDOWN_MS,
) {
  return lastNotifiedAt === undefined || now - lastNotifiedAt >= cooldownMs
}
