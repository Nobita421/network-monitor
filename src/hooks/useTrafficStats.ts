import { useEffect, useState, useRef } from 'react'
import { getDesktop, invokeWithTimeout, type LatencyPayload } from '../lib/ipc'
import type { NetworkStat } from '../types'

const THROTTLE_MS = 1000

export function useTrafficStats() {
  const [stats, setStats] = useState<NetworkStat | null>(null)
  const lastUpdateRef = useRef(0)
  const pendingRef    = useRef<NetworkStat | null>(null)
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const receivedLiveRef = useRef(false)

  useEffect(() => {
    const desktop = getDesktop()
    if (!desktop) return

    const loadInitialStats = async () => {
      try {
        const initialStats = await invokeWithTimeout(() => desktop.getTrafficStats())
        // A live event may have arrived while this request was in flight. Never
        // let the older snapshot roll state (and counter baselines) backwards.
        if (initialStats && !receivedLiveRef.current) {
          setStats(initialStats)
        }
      } catch (error) {
        console.error('Failed to fetch traffic stats:', error)
      }
    }

    void loadInitialStats()

    const unsubscribe = desktop.onTrafficUpdate((nextStats: NetworkStat) => {
      receivedLiveRef.current = true
      const now     = Date.now()
      const elapsed = now - lastUpdateRef.current

      if (elapsed >= THROTTLE_MS) {
        lastUpdateRef.current = now
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
        pendingRef.current = null
        setStats(nextStats)
      } else {
        pendingRef.current = nextStats
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            if (pendingRef.current) {
              lastUpdateRef.current = Date.now()
              setStats(pendingRef.current)
              pendingRef.current = null
            }
          }, THROTTLE_MS - elapsed)
        }
      }
    })

    const unsubscribeLatency = desktop.onLatencyUpdate((payload: LatencyPayload) => {
      setStats((prev) => prev ? { ...prev, ping: payload.ping } : prev)
    })

    return () => {
      unsubscribe()
      unsubscribeLatency()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return stats
}
