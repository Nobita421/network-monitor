import { useEffect, useState, useRef } from 'react'
import type { Connection } from '../types'

const THROTTLE_MS = 2000

export function useConnectionList() {
  const [connections, setConnections] = useState<Connection[]>([])
  const lastUpdateRef = useRef(0)
  const pendingRef = useRef<Connection[] | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const loadConnections = async () => {
      try {
        const data = await window.desktop.getNetworkConnections()
        if (Array.isArray(data)) {
          setConnections(data)
          lastUpdateRef.current = Date.now()
        }
      } catch (error) {
        console.error('Failed to fetch connections:', error)
      }
    }

    void loadConnections()

    const unsubscribe = window.desktop.onConnectionsUpdate((nextConnections: Connection[]) => {
      const now = Date.now()
      const elapsed = now - lastUpdateRef.current

      if (elapsed >= THROTTLE_MS) {
        lastUpdateRef.current = now
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        pendingRef.current = null
        setConnections(nextConnections)
      } else {
        pendingRef.current = nextConnections
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            if (pendingRef.current) {
              lastUpdateRef.current = Date.now()
              setConnections(pendingRef.current)
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

  return connections
}
