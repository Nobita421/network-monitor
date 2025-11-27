import { useState, useEffect, useCallback } from 'react'
import { NetworkStat, Connection, ProcessUsageEntry, HistoryPoint, Settings } from '../types'
import { formatBytes, loadStoredNumber } from '../lib/utils'
import { TELEMETRY_RESUME_KEY, LAST_ALERT_KEY } from '../lib/constants'
import { db } from '../lib/db'

export function useNetworkData(settings: Settings) {
  const [stats, setStats] = useState<NetworkStat | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
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

    return () => clearInterval(interval)
  }, [telemetryResumeAt])

  // Main data fetching loop
  useEffect(() => {
    const fetchData = async () => {
      if (telemetryPaused) return
      try {
        const data = await window.ipcRenderer.getNetworkStats()
        if (data) {
          setStats(data)
          setElapsedSeconds((prev) => prev + 1)

          // Persist to DB
          db.traffic_logs.add({
            timestamp: Date.now(),
            rx: data.rx_sec,
            tx: data.tx_sec
          }).catch(err => console.error('Failed to persist stats:', err))

          setHistory((prev) => {
            const newPoint = { time: new Date().toLocaleTimeString(), rx: data.rx_sec, tx: data.tx_sec }
            const nextHistory = [...prev, newPoint]
            if (nextHistory.length > 300) nextHistory.shift()
            return nextHistory
          })

          setSessionUsage((prev) => ({ rx: prev.rx + data.rx_sec, tx: prev.tx + data.tx_sec }))
          setMaxSpikes((prev) => ({ rx: Math.max(prev.rx, data.rx_sec), tx: Math.max(prev.tx, data.tx_sec) }))

          const threshold = settings.threshold
          const exceeded = data.rx_sec > threshold || data.tx_sec > threshold
          setAlertIndicator(exceeded)

          if (exceeded) {
            const now = Date.now()
            const cooldownMs = settings.cooldownMinutes * 60 * 1000
            const canAlert = !lastAlertAt || now - lastAlertAt > cooldownMs
            if (canAlert) {
              const direction: 'rx' | 'tx' = data.rx_sec > threshold ? 'rx' : 'tx'
              const stamp = new Date().toLocaleTimeString()
              const spikeValue = direction === 'rx' ? data.rx_sec : data.tx_sec
              new Notification('High Network Usage Detected', {
                body: `Usage exceeded ${formatBytes(threshold)}/s`,
              })
              setLastAlertAt(now)
              setAlertLog((prev) => [{ time: stamp, direction, rate: `${formatBytes(spikeValue)}/s` }, ...prev].slice(0, 4))
            }
          }
        }

        const [conns, processes] = await Promise.all([
          window.ipcRenderer.getNetworkConnections(),
          window.ipcRenderer.getProcessUsage(),
        ])
        setConnections(conns)
        setProcessUsage(processes)
      } catch (error) {
        console.error(error)
      }
    }

    fetchData()
    const interval = setInterval(() => {
      fetchData()
    }, 1000)

    return () => clearInterval(interval)
  }, [settings.threshold, settings.cooldownMinutes, telemetryPaused, lastAlertAt])

  const toggleTelemetry = useCallback(() => {
    if (telemetryPaused) {
      setTelemetryResumeAt(null)
      return
    }
    const resumeTimestamp = Date.now() + settings.pauseMinutes * 60 * 1000
    setTelemetryResumeAt(resumeTimestamp)
  }, [telemetryPaused, settings.pauseMinutes])

  return {
    stats,
    history,
    connections,
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
