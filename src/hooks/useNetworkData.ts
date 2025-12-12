import { useState, useEffect, useCallback } from 'react'
import { NetworkStat, ProcessUsageEntry, HistoryPoint, Settings } from '../types'
import { formatBytes, loadStoredNumber } from '../lib/utils'
import { TELEMETRY_RESUME_KEY } from '../lib/constants'
import { db } from '../lib/db'
import { useTrafficStats } from './useTrafficStats'
import { useConnectionList } from './useConnectionList'

export function useNetworkData(settings: Settings) {
  // Use the new split hooks
  const trafficStats = useTrafficStats();
  const connectionList = useConnectionList();

  const [stats, setStats] = useState<NetworkStat | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  // const [connections, setConnections] = useState<Connection[]>([]) // Replaced by connectionList
  const [processUsage, setProcessUsage] = useState<ProcessUsageEntry[]>([])
  
  const [sessionUsage, setSessionUsage] = useState({ rx: 0, tx: 0 })
  const [maxSpikes, setMaxSpikes] = useState({ rx: 0, tx: 0 })
  const [alertLog, setAlertLog] = useState<{ time: string; direction: 'rx' | 'tx'; rate: string }[]>([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [alertIndicator, setAlertIndicator] = useState(false)

  const [telemetryResumeAt, setTelemetryResumeAt] = useState<number | null>(() => {
    const stored = loadStoredNumber(TELEMETRY_RESUME_KEY)
    if (!stored) return null
    return stored > Date.now() ? stored : null
  })
  
  const telemetryPaused = telemetryResumeAt ? telemetryResumeAt > Date.now() : false
  const [pauseCountdown, setPauseCountdown] = useState(() => {
    if (!telemetryResumeAt) return 0
    return Math.max(0, Math.ceil((telemetryResumeAt - Date.now()) / 1000))
  })

  // Normalize settings.pauseMinutes to ensure it's a number (handle string inputs if any)
  const pauseDurationMinutes = Number(settings.pauseMinutes) > 0 ? Number(settings.pauseMinutes) : 5;

  // Persist telemetry resume time
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (telemetryResumeAt && telemetryResumeAt > Date.now()) {
      localStorage.setItem(TELEMETRY_RESUME_KEY, telemetryResumeAt.toString())
    } else {
      localStorage.removeItem(TELEMETRY_RESUME_KEY)
    }
  }, [telemetryResumeAt])

  // Sync Pause State to Main Process
  useEffect(() => {
    // Only send if the window/ipc exists
    if (typeof window === 'undefined' || !window.ipcRenderer) return;

      if (telemetryPaused && telemetryResumeAt) {
          const remaining = telemetryResumeAt - Date.now();
          window.ipcRenderer.send('set-paused', remaining);
      } else {
          window.ipcRenderer.send('set-paused', 0);
      }
  }, [telemetryPaused, telemetryResumeAt]);

  // Listen for Backend Alerts to update UI log
  useEffect(() => {
      // Check if ipcRenderer exists (SSR safety)
      if (typeof window === 'undefined' || !window.ipcRenderer) return;

      const handleAlert = (_event: any, data: { title: string, body: string, time: string }) => {
          setAlertIndicator(true);
          const direction = data.title.toLowerCase().includes('download') ? 'rx' : 'tx';
          // Extract rate from body if possible? body is "Download speed: 1.2 MB/s"
          const rateMatch = data.body.match(/speed: (.*)/);
          const rate = rateMatch ? rateMatch[1] : 'High';
          
          setAlertLog(prev => [{ time: new Date().toLocaleTimeString(), direction, rate }, ...prev].slice(0, 50));
          setTimeout(() => setAlertIndicator(false), 2000);
      };

      window.ipcRenderer.on('alert-triggered', handleAlert);
      return () => {
          window.ipcRenderer.off('alert-triggered', handleAlert);
      };
  }, []);

  // Countdown timer for pause
  useEffect(() => {
    if (!telemetryResumeAt) {
      setPauseCountdown(0)
      return
    }

    const interval = setInterval(() => {
      const remaining = telemetryResumeAt - Date.now()
      if (remaining <= 0) {
        setTelemetryResumeAt(null)
        setPauseCountdown(0)
      } else {
        setPauseCountdown(Math.ceil(remaining / 1000))
      }
    }, 1000)

    return () => { clearInterval(interval) }
  }, [telemetryResumeAt])

  // Process Traffic Stats (Update logs/history/session only)
  // Logic here assumes trafficStats is updated via the other hook from IPC
  useEffect(() => {
    if (!trafficStats) return;

    const data = trafficStats;
    const netStat: NetworkStat = {
        rx_sec: data.rx_sec,
        tx_sec: data.tx_sec,
        iface: data.iface,
        operstate: data.operstate,
    };

    setStats(netStat);
    setElapsedSeconds((prev) => prev + 1);

    // Persist to DB (Only if not paused? Or always logging? User said "Pause Notifications", usually means stop logging alerts, but stats might still flow.
    // Let's assume stats continue but alerts stop.
    if (!telemetryPaused) {
         db.traffic_logs.add({
            timestamp: Date.now(),
            rx: data.rx_sec,
            tx: data.tx_sec
        }).catch(err => { console.error('Failed to persist stats:', err) });
    }

    setHistory((prev) => {
        const newPoint = { time: new Date().toLocaleTimeString(), rx: data.rx_sec, tx: data.tx_sec };
        const nextHistory = [...prev, newPoint];
        if (nextHistory.length > 300) nextHistory.shift();
        return nextHistory;
    });

    setSessionUsage((prev) => ({ rx: prev.rx + data.rx_sec, tx: prev.tx + data.tx_sec }));
    setMaxSpikes((prev) => ({ rx: Math.max(prev.rx, data.rx_sec), tx: Math.max(prev.tx, data.tx_sec) }));

  }, [trafficStats, telemetryPaused]);

  // Process Connection List (5s interval from hook)
  useEffect(() => {
      // Calculate Process Usage on the client side
      const aggregated = new Map<number, { name: string; pid: number; connections: number; tcp: number; udp: number }>();
      
      connectionList.forEach((conn) => {
          const pid = typeof conn.pid === 'number' ? conn.pid : -1;
          const existing = aggregated.get(pid) || { name: conn.process || 'System', pid, connections: 0, tcp: 0, udp: 0 };
          existing.connections += 1;
          const protocol = (conn.protocol || '').toLowerCase();
          if (protocol.startsWith('tcp')) {
              existing.tcp += 1;
          } else if (protocol.startsWith('udp')) {
              existing.udp += 1;
          }
          existing.name = conn.process || existing.name;
          aggregated.set(pid, existing);
      });

      const totals = Array.from(aggregated.values());
      const connectionTotal = totals.reduce((sum, entry) => sum + entry.connections, 0) || 1;
      
      const rxSec = trafficStats?.rx_sec || 0;
      const txSec = trafficStats?.tx_sec || 0;

      const ranked = totals
          .map((entry) => {
              const ratio = entry.connections / connectionTotal;
              return {
                  pid: entry.pid,
                  name: entry.name,
                  connections: entry.connections,
                  tcp: entry.tcp,
                  udp: entry.udp,
                  rx: rxSec * ratio, // Approximation
                  tx: txSec * ratio, // Approximation
                  activityScore: ratio,
              };
          })
          .sort((a, b) => b.activityScore - a.activityScore)
          .slice(0, 8);

      setProcessUsage(ranked);

  }, [connectionList, trafficStats]);

  const toggleTelemetry = useCallback(() => {
    if (telemetryPaused) {
      setTelemetryResumeAt(null)
    } else {
      // Pause for configured minutes (converted to ms)
      // Fix: Use pauseDurationMinutes explicitly
      setTelemetryResumeAt(Date.now() + pauseDurationMinutes * 60 * 1000)
    }
  }, [telemetryPaused, pauseDurationMinutes])

  return {
    stats,
    history,
    connections: connectionList, 
    processUsage,
    sessionUsage,
    maxSpikes,
    alertLog,
    elapsedSeconds,
    alertIndicator,
    telemetryPaused,
    pauseCountdown,
    toggleTelemetry
  }
}
