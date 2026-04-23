import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { AlertLogEntry, NetworkStat, ProcessUsageEntry, HistoryPoint, Settings } from '../types'
import { loadStoredNumber } from '../lib/utils'
import { HISTORY_RETENTION_MS, TELEMETRY_RESUME_KEY } from '../lib/constants'
import { db } from '../lib/db'
import { buildProcessUsage } from '../lib/network'
import type { AlertPayload } from '../lib/ipc'
import { useTrafficStats } from './useTrafficStats'
import { useConnectionList } from './useConnectionList'

const MAX_HISTORY = 120

export function useNetworkData(settings: Settings) {
  const trafficStats = useTrafficStats()
  const connectionList = useConnectionList()

  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [sessionUsage, setSessionUsage] = useState({ rx: 0, tx: 0 })
  const [maxSpikes, setMaxSpikes] = useState({ rx: 0, tx: 0 })
  const [alertLog, setAlertLog] = useState<AlertLogEntry[]>([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [alertIndicator, setAlertIndicator] = useState(false)
  const lastPruneAtRef = useRef(0)
  const alertIndicatorTimeoutRef = useRef<number | null>(null)

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (telemetryResumeAt && telemetryResumeAt > Date.now()) {
      localStorage.setItem(TELEMETRY_RESUME_KEY, telemetryResumeAt.toString())
    } else {
      localStorage.removeItem(TELEMETRY_RESUME_KEY)
    }
  }, [telemetryResumeAt])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (telemetryPaused && telemetryResumeAt) {
      const remaining = telemetryResumeAt - Date.now()
      window.desktop.setTelemetryPaused(Math.max(remaining, 0))
    } else {
      window.desktop.setTelemetryPaused(0)
    }
  }, [telemetryPaused, telemetryResumeAt])

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

    return () => {
      unsubscribe()
      if (alertIndicatorTimeoutRef.current) window.clearTimeout(alertIndicatorTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!telemetryResumeAt) {
      setPauseCountdown(0)
      return
    }

    const refreshCountdown = () => {
      const remaining = telemetryResumeAt - Date.now()
      if (remaining <= 0) {
        setTelemetryResumeAt(null)
        setPauseCountdown(0)
      } else {
        setPauseCountdown(Math.ceil(remaining / 1000))
      }
    }

    refreshCountdown()
    const interval = setInterval(refreshCountdown, 1000)
    return () => { clearInterval(interval) }
  }, [telemetryResumeAt])

  useEffect(() => {
    if (!trafficStats) return

    const data = trafficStats
    setElapsedSeconds((prev) => prev + 1)

    if (!telemetryPaused) {
      const timestamp = Date.now()
      void db.traffic_logs.add({
        timestamp,
        rx: data.rx_sec,
        tx: data.tx_sec,
      }).then(async () => {
        if (timestamp - lastPruneAtRef.current < 60 * 1000) return
        lastPruneAtRef.current = timestamp
        await db.traffic_logs.where('timestamp').below(timestamp - HISTORY_RETENTION_MS).delete()
      }).catch((error) => {
        console.error('Failed to persist stats:', error)
      })
    }

    setHistory((prev) => {
      const newPoint: HistoryPoint = { time: new Date().toLocaleTimeString(), rx: data.rx_sec, tx: data.tx_sec }
      const next = prev.concat(newPoint)
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
    })

    setSessionUsage((prev) => ({ rx: prev.rx + data.rx_sec, tx: prev.tx + data.tx_sec }))
    setMaxSpikes((prev) => ({ rx: Math.max(prev.rx, data.rx_sec), tx: Math.max(prev.tx, data.tx_sec) }))
  }, [trafficStats, telemetryPaused])

  const processUsage = useMemo<ProcessUsageEntry[]>(() => {
    return buildProcessUsage(connectionList, trafficStats)
  }, [connectionList, trafficStats])

  const stats = useMemo<NetworkStat | null>(() => {
    if (!trafficStats) return null
    return {
      rx_sec: trafficStats.rx_sec,
      tx_sec: trafficStats.tx_sec,
      iface: trafficStats.iface,
      operstate: trafficStats.operstate,
      ping: trafficStats.ping,
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
    elapsedSeconds,
    alertIndicator,
    telemetryPaused,
    pauseCountdown,
    toggleTelemetry
  }
}
