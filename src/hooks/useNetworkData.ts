import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { AlertLogEntry, NetworkStat, ProcessUsageEntry, HistoryPoint, Settings } from '../types'
import { loadStoredNumber } from '../lib/utils'
import { HISTORY_RETENTION_MS, TELEMETRY_RESUME_KEY } from '../lib/constants'
import { db, type TrafficLog } from '../lib/db'
import { buildProcessUsage } from '../lib/network'
import type { AlertPayload } from '../lib/ipc'
import { useTrafficStats } from './useTrafficStats'
import { useConnectionList } from './useConnectionList'
import { toast } from '../components/ui/Toast'

const MAX_HISTORY = 120
const HISTORY_WRITE_BATCH_MS = 5000

export function useNetworkData(settings: Settings) {
  const trafficStats   = useTrafficStats()
  const connectionList = useConnectionList()

  const [history,         setHistory]         = useState<HistoryPoint[]>([])
  const [sessionUsage,    setSessionUsage]    = useState({ rx: 0, tx: 0 })
  const [maxSpikes,       setMaxSpikes]       = useState({ rx: 0, tx: 0 })
  const [alertLog,        setAlertLog]        = useState<AlertLogEntry[]>([])
  const [alertIndicator,  setAlertIndicator]  = useState(false)
  const [dbError,         setDbError]         = useState<string | null>(null)

  const lastPruneAtRef             = useRef(0)
  const alertIndicatorTimeoutRef   = useRef<number | null>(null)
  const dbErrorToastShownRef       = useRef(false)
  const dbErrorRef                 = useRef<string | null>(null)
  const lastTrafficSampleRef       = useRef<string | null>(null)
  const lastTrafficSampleTimeRef   = useRef<number | null>(null)
  const lastCounterRef             = useRef<{ rx: number; tx: number } | null>(null)
  const pendingLogsRef             = useRef<TrafficLog[]>([])
  const flushLogsTimerRef          = useRef<number | null>(null)

  useEffect(() => {
    dbErrorRef.current = dbError
  }, [dbError])

  const flushHistoryLogs = useCallback(async () => {
    if (flushLogsTimerRef.current) {
      window.clearTimeout(flushLogsTimerRef.current)
      flushLogsTimerRef.current = null
    }

    const logs = pendingLogsRef.current
    pendingLogsRef.current = []
    if (logs.length === 0) return

    try {
      await db.traffic_logs.bulkAdd(logs)

      if (dbErrorRef.current) {
        setDbError(null)
        dbErrorToastShownRef.current = false
      }

      const newestTimestamp = logs[logs.length - 1]?.timestamp ?? Date.now()
      if (newestTimestamp - lastPruneAtRef.current < 60 * 1000) return
      lastPruneAtRef.current = newestTimestamp
      await db.traffic_logs
        .where('timestamp').below(newestTimestamp - HISTORY_RETENTION_MS).delete()
    } catch (error: unknown) {
      pendingLogsRef.current = [...logs, ...pendingLogsRef.current].slice(-MAX_HISTORY)
      console.error('Failed to persist stats:', error)
      const msg = error instanceof Error ? error.message : 'Storage quota may be full'
      setDbError(msg)

      if (!dbErrorToastShownRef.current) {
        dbErrorToastShownRef.current = true
        toast.warning('History not saving', `DB write failed: ${msg}`)
      }
    }
  }, [])

  const queueHistoryLog = useCallback((log: TrafficLog) => {
    pendingLogsRef.current.push(log)
    if (flushLogsTimerRef.current) return
    flushLogsTimerRef.current = window.setTimeout(() => {
      void flushHistoryLogs()
    }, HISTORY_WRITE_BATCH_MS)
  }, [flushHistoryLogs])

  useEffect(() => {
    return () => {
      if (flushLogsTimerRef.current) window.clearTimeout(flushLogsTimerRef.current)
      if (pendingLogsRef.current.length > 0) void flushHistoryLogs()
    }
  }, [flushHistoryLogs])

  const [telemetryResumeAt, setTelemetryResumeAt] = useState<number | null>(() => {
    const stored = loadStoredNumber(TELEMETRY_RESUME_KEY)
    if (!stored) return null
    return stored > Date.now() ? stored : null
  })

  const [pauseCountdown, setPauseCountdown] = useState(() => {
    if (!telemetryResumeAt) return 0
    return Math.max(0, Math.ceil((telemetryResumeAt - Date.now()) / 1000))
  })

  const telemetryPaused = useMemo(() => pauseCountdown > 0, [pauseCountdown])
  const pauseDurationMinutes = Number(settings.pauseMinutes) > 0 ? Number(settings.pauseMinutes) : 5

  // Persist telemetry resume timestamp
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (telemetryResumeAt && telemetryResumeAt > Date.now()) {
      localStorage.setItem(TELEMETRY_RESUME_KEY, telemetryResumeAt.toString())
    } else {
      localStorage.removeItem(TELEMETRY_RESUME_KEY)
    }
  }, [telemetryResumeAt])

  // Sync pause state to main process
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (telemetryPaused && telemetryResumeAt) {
      const remaining = telemetryResumeAt - Date.now()
      window.desktop.setTelemetryPaused(Math.max(remaining, 0))
    } else {
      window.desktop.setTelemetryPaused(0)
    }
  }, [telemetryPaused, telemetryResumeAt])

  // Subscribe to alert events
  useEffect(() => {
    const unsubscribe = window.desktop.onAlertTriggered((data: AlertPayload) => {
      const direction: AlertLogEntry['direction'] = data.title.toLowerCase().includes('download') ? 'rx' : 'tx'
      const rateMatch = data.body.match(/speed: (.*)/i)
      const time = data.time ? new Date(data.time).toLocaleTimeString() : new Date().toLocaleTimeString()

      setAlertIndicator(true)
      setAlertLog((prev) => [{ time, direction, rate: rateMatch ? rateMatch[1] : 'High' }, ...prev].slice(0, 50))

      if (alertIndicatorTimeoutRef.current) window.clearTimeout(alertIndicatorTimeoutRef.current)
      alertIndicatorTimeoutRef.current = window.setTimeout(() => { setAlertIndicator(false) }, 2000)
    })

    // Listen for app-before-quit to gracefully unsubscribe
    const unsubscribeQuit = window.desktop.onAppBeforeQuit(() => {
      unsubscribe()
    })

    return () => {
      unsubscribe()
      unsubscribeQuit()
      if (alertIndicatorTimeoutRef.current) window.clearTimeout(alertIndicatorTimeoutRef.current)
    }
  }, [])

  // Pause countdown
  useEffect(() => {
    if (!telemetryResumeAt) { setPauseCountdown(0); return }

    const refreshCountdown = () => {
      const remaining = telemetryResumeAt - Date.now()
      if (remaining <= 0) { setTelemetryResumeAt(null); setPauseCountdown(0) }
      else setPauseCountdown(Math.ceil(remaining / 1000))
    }

    refreshCountdown()
    const interval = setInterval(refreshCountdown, 1000)
    return () => { clearInterval(interval) }
  }, [telemetryResumeAt])

  // Process traffic stats
  useEffect(() => {
    if (!trafficStats) return

    const data = trafficStats
    const timestamp = data.sampledAt ?? Date.now()
    const sampleKey = `${timestamp}:${data.rx_sec}:${data.tx_sec}:${data.rx_bytes ?? ''}:${data.tx_bytes ?? ''}`
    if (lastTrafficSampleRef.current === sampleKey) return

    const previousSampleTime = lastTrafficSampleTimeRef.current
    lastTrafficSampleRef.current = sampleKey
    lastTrafficSampleTimeRef.current = timestamp

    if (!telemetryPaused) {
      const isoTime   = new Date(timestamp).toISOString()

      queueHistoryLog({ timestamp, rx: data.rx_sec, tx: data.tx_sec })

      setHistory((prev) => {
        const newPoint: HistoryPoint = {
          time:    new Date(timestamp).toLocaleTimeString(),
          isoTime,
          rx: data.rx_sec,
          tx: data.tx_sec,
        }
        const next = prev.concat(newPoint)
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
      })
    }

    const rxBytes = data.rx_bytes
    const txBytes = data.tx_bytes
    const hasCounters = typeof rxBytes === 'number' && typeof txBytes === 'number'
    const previousCounters = lastCounterRef.current
    let rxDelta = 0
    let txDelta = 0

    if (hasCounters) {
      if (previousCounters && rxBytes >= previousCounters.rx && txBytes >= previousCounters.tx) {
        rxDelta = rxBytes - previousCounters.rx
        txDelta = txBytes - previousCounters.tx
      }
      lastCounterRef.current = { rx: rxBytes, tx: txBytes }
    } else if (previousSampleTime) {
      const elapsedSeconds = Math.max((timestamp - previousSampleTime) / 1000, 0)
      rxDelta = data.rx_sec * elapsedSeconds
      txDelta = data.tx_sec * elapsedSeconds
      lastCounterRef.current = null
    }

    if (!telemetryPaused && (rxDelta > 0 || txDelta > 0)) {
      setSessionUsage((prev) => ({ rx: prev.rx + rxDelta, tx: prev.tx + txDelta }))
    }
    setMaxSpikes((prev)   => ({ rx: Math.max(prev.rx, data.rx_sec), tx: Math.max(prev.tx, data.tx_sec) }))
  }, [trafficStats, telemetryPaused, queueHistoryLog])

  const processUsage = useMemo<ProcessUsageEntry[]>(
    () => buildProcessUsage(connectionList, trafficStats),
    [connectionList, trafficStats],
  )

  const stats = useMemo<NetworkStat | null>(() => {
    if (!trafficStats) return null
    return {
      rx_sec:     trafficStats.rx_sec,
      tx_sec:     trafficStats.tx_sec,
      rx_bytes:   trafficStats.rx_bytes,
      tx_bytes:   trafficStats.tx_bytes,
      sampledAt:  trafficStats.sampledAt,
      iface:      trafficStats.iface,
      operstate:  trafficStats.operstate,
      ping:       trafficStats.ping,
    }
  }, [trafficStats])

  const toggleTelemetry = useCallback(() => {
    if (telemetryPaused) {
      setTelemetryResumeAt(null)
    } else {
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
    alertIndicator,
    telemetryPaused,
    pauseCountdown,
    dbError,
    toggleTelemetry,
  }
}
