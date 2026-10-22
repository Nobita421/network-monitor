import { useEffect, useMemo, useRef } from 'react'
import type { Connection } from '../types'
import { getDesktop } from '../lib/ipc'
import { findNewSightings, findWatchedConnections } from '../lib/watchlist'
import { toast } from '../components/ui/Toast'

/**
 * Tracks watched processes against the live connection list.
 * Fires an in-app toast plus an OS notification the moment a watched process
 * appears that wasn't present in the previous sample (absent→present
 * transitions only, so a steady connection doesn't spam; main additionally
 * rate-limits OS notifications per process).
 */
export function useProcessWatch(connections: Connection[], watchlist: string[]) {
  const prevWatchedRef = useRef<Connection[]>([])

  const watched = useMemo(
    () => findWatchedConnections(connections, watchlist),
    [connections, watchlist],
  )

  useEffect(() => {
    const prev = prevWatchedRef.current
    prevWatchedRef.current = watched
    if (watchlist.length === 0) return
    const fresh = findNewSightings(prev, watched)
    if (fresh.length === 0) return
    const desktop = getDesktop()
    for (const name of fresh) {
      toast.warning(`Watched process active: ${name}`, 'Process Watchlist')
      try {
        desktop?.notifyWatchSighting(name)
      } catch (error) {
        console.error('Failed to notify watch sighting:', error)
      }
    }
  }, [watched, watchlist])

  return { watched }
}
