import { useState, useEffect } from 'react';
import { Connection } from '../types';

export function useConnectionList() {
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const data = await window.ipcRenderer.getNetworkConnections();
        if (Array.isArray(data)) {
          setConnections(data);
        }
      } catch (error) {
        console.error("Failed to fetch connections:", error);
      }
    };

    // Initial fetch
    fetchConnections();

    // Poll every 5 seconds (Low Frequency)
    const interval = setInterval(fetchConnections, 5000);

    return () => clearInterval(interval);
  }, []);

  return connections;
}
