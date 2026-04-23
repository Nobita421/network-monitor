import { useEffect, useState, useRef } from 'react'

export interface TrafficStats {
  rx_sec: number
  tx_sec: number
  iface: string
  operstate: string
  ping?: number
}

const THROTTLE_MS = 1000

export function useTrafficStats() {
  const [stats, setStats] = useState<TrafficStats | null>(null)
  const lastUpdateRef = useRef(0)
  const pendingRef = useRef<TrafficStats | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const loadInitialStats = async () => {
      try {
        const initialStats = await window.desktop.getTrafficStats()
        if (initialStats) {
          setStats(initialStats)
          lastUpdateRef.current = Date.now()
        }
      } catch (error) {
        console.error('Failed to fetch traffic stats:', error)
      }
    }

    void loadInitialStats()

    const unsubscribe = window.desktop.onTrafficUpdate((nextStats: TrafficStats) => {
      const now = Date.now()
      const elapsed = now - lastUpdateRef.current

      if (elapsed >= THROTTLE_MS) {
        lastUpdateRef.current = now
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
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

    return () => {
      unsubscribe()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return stats
}
