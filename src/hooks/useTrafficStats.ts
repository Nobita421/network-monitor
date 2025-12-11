import { useState, useEffect } from 'react';

export interface TrafficStats {
  rx_sec: number;
  tx_sec: number;
  iface: string;
  operstate: string;
}

export function useTrafficStats() {
  const [stats, setStats] = useState<TrafficStats>({ rx_sec: 0, tx_sec: 0, iface: '', operstate: 'unknown' });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await window.ipcRenderer.getTrafficStats();
        if (data) {
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch traffic stats:", error);
      }
    };

    // Initial fetch
    fetchStats();

    // Poll every 1 second (High Frequency)
    const interval = setInterval(fetchStats, 1000);

    return () => clearInterval(interval);
  }, []);

  return stats;
}
