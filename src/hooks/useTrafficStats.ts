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
    // Listen for updates from Main process (pushed every 1s)
    const handleUpdate = (_event: any, data: TrafficStats) => {
        setStats(data);
    };

    window.ipcRenderer.on('traffic-update', handleUpdate);

    return () => {
        window.ipcRenderer.off('traffic-update', handleUpdate);
    };
  }, []);

  return stats;
}
