import { useEffect, useState } from 'react'

export interface TrafficStats {
  rx_sec: number
  tx_sec: number
  iface: string
  operstate: string
  ping?: number
}

export function useTrafficStats() {
  const [stats, setStats] = useState<TrafficStats | null>(null)

  useEffect(() => {
    const loadInitialStats = async () => {
      try {
        const initialStats = await window.desktop.getTrafficStats()
        if (initialStats) {
          setStats(initialStats)
        }
      } catch (error) {
        console.error('Failed to fetch traffic stats:', error)
      }
    }

    void loadInitialStats()
    const unsubscribe = window.desktop.onTrafficUpdate((nextStats: TrafficStats) => {
      setStats(nextStats)
    })

    return unsubscribe
  }, [])

  return stats
}
