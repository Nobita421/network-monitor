import { useState, useEffect, useCallback } from 'react'
import { NetworkStat, ProcessUsageEntry, HistoryPoint, Settings } from '../types'
import { formatBytes, loadStoredNumber } from '../lib/utils'
import { TELEMETRY_RESUME_KEY, LAST_ALERT_KEY } from '../lib/constants'
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
  
  const [lastAlertAt, setLastAlertAt] = useState<number | null>(() => loadStoredNumber(LAST_ALERT_KEY))

  // Persist telemetry resume time
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (telemetryResumeAt && telemetryResumeAt > Date.now()) {
      localStorage.setItem(TELEMETRY_RESUME_KEY, telemetryResumeAt.toString())
    } else {
      localStorage.removeItem(TELEMETRY_RESUME_KEY)
    }
  }, [telemetryResumeAt])

  // Persist last alert time
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (lastAlertAt) {
      localStorage.setItem(LAST_ALERT_KEY, lastAlertAt.toString())
    } else {
      localStorage.removeItem(LAST_ALERT_KEY)
    }
  }, [lastAlertAt])

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

  // Process Traffic Stats (1s interval from hook)
  useEffect(() => {
    if (telemetryPaused || !trafficStats) return;

    const data = trafficStats;
    // Map TrafficStats to NetworkStat (if needed, or just use TrafficStats directly)
    // Assuming NetworkStat has same shape or compatible
    const netStat: NetworkStat = {
        rx_sec: data.rx_sec,
        tx_sec: data.tx_sec,
        iface: data.iface,
        operstate: data.operstate,
    };

    setStats(netStat);
    setElapsedSeconds((prev) => prev + 1);

    // Persist to DB
    db.traffic_logs.add({
        timestamp: Date.now(),
        rx: data.rx_sec,
        tx: data.tx_sec
    }).catch(err => console.error('Failed to persist stats:', err));

    setHistory((prev) => {
        const newPoint = { time: new Date().toLocaleTimeString(), rx: data.rx_sec, tx: data.tx_sec };
        const nextHistory = [...prev, newPoint];
        if (nextHistory.length > 300) nextHistory.shift();
        return nextHistory;
    });

    setSessionUsage((prev) => ({ rx: prev.rx + data.rx_sec, tx: prev.tx + data.tx_sec }));
    setMaxSpikes((prev) => ({ rx: Math.max(prev.rx, data.rx_sec), tx: Math.max(prev.tx, data.tx_sec) }));

    // Alert Logic
    const threshold = settings.threshold;
    if (threshold > 0) {
        const now = Date.now();
        // Simple rate limiting for alerts (e.g., once every 10s)
        if (!lastAlertAt || now - lastAlertAt > 10000) {
            if (data.rx_sec > threshold) {
                setAlertIndicator(true);
                setAlertLog(prev => [{ time: new Date().toLocaleTimeString(), direction: 'rx' as const, rate: formatBytes(data.rx_sec) }, ...prev].slice(0, 50));
                setLastAlertAt(now);
                setTimeout(() => setAlertIndicator(false), 2000);
            }
            if (data.tx_sec > threshold) {
                setAlertIndicator(true);
                setAlertLog(prev => [{ time: new Date().toLocaleTimeString(), direction: 'tx' as const, rate: formatBytes(data.tx_sec) }, ...prev].slice(0, 50));
                setLastAlertAt(now);
                setTimeout(() => setAlertIndicator(false), 2000);
            }
        }
    }

  }, [trafficStats, telemetryPaused, settings.threshold, lastAlertAt]);

  // Process Connection List (5s interval from hook)
  // Also calculate Process Usage here since we removed it from Main
  useEffect(() => {
      if (telemetryPaused) return;
      
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
      
      // We need current traffic stats to distribute bandwidth (approximation)
      // Since we don't have per-process bandwidth from the OS in this light mode,
      // we can either skip it or distribute evenly/proportionally based on connection count (inaccurate but visual).
      // For now, let's just show connection counts which is accurate.
      
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

  }, [connectionList, trafficStats, telemetryPaused]);

  const toggleTelemetry = useCallback(() => {
    if (telemetryPaused) {
      setTelemetryResumeAt(null)
    } else {
      // Pause for 5 minutes
      setTelemetryResumeAt(Date.now() + 5 * 60 * 1000)
    }
  }, [telemetryPaused])

  return {
    stats,
    history,
    connections: connectionList, // Return the list from the hook
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
