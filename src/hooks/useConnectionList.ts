import { useEffect, useState } from 'react'
import type { Connection } from '../types'

export function useConnectionList() {
  const [connections, setConnections] = useState<Connection[]>([])

  useEffect(() => {
    const loadConnections = async () => {
      try {
        const data = await window.desktop.getNetworkConnections()
        if (Array.isArray(data)) {
          setConnections(data)
        }
      } catch (error) {
        console.error('Failed to fetch connections:', error)
      }
    }

    void loadConnections()
    const unsubscribe = window.desktop.onConnectionsUpdate((nextConnections: Connection[]) => {
      setConnections(nextConnections)
    })

    return unsubscribe
  }, [])

  return connections
}
