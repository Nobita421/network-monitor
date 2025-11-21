import { useCallback, useEffect, useMemo, useState } from 'react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import * as Lucide from 'lucide-react'

interface NetworkStat {
  rx_sec: number
  tx_sec: number
  iface: string
  operstate: string
}

interface Connection {
  protocol: string
  localAddress: string
  localPort: string
  peerAddress: string
  peerPort: string
  state: string
  process: string
}

interface ProcessUsageEntry {
  pid: number
  name: string
  connections: number
  rx: number
  tx: number
  activityScore: number
  tcp: number
  udp: number
}

type HistoryPoint = { time: string; rx: number; tx: number }
type HistoryRange = '30s' | '60s' | '5m'

type Settings = {
  threshold: number
  cooldownMinutes: number
  pauseMinutes: number
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Lucide.Activity, hint: 'Live' },
  { id: 'connections', label: 'Connections', icon: Lucide.List, hint: 'Deep Dive' },
]

const rangeOptions: { label: string; value: HistoryRange }[] = [
  { label: '30s', value: '30s' },
  { label: '60s', value: '60s' },
  { label: '5m', value: '5m' },
]

const stateFilters = [
  { label: 'All', value: 'all' },
  { label: 'Established', value: 'ESTABLISHED' },
  { label: 'Listening', value: 'LISTEN' },
]

const chartWindow: Record<HistoryRange, number> = {
  '30s': 30,
  '60s': 60,
  '5m': 300,
}

const SETTINGS_STORAGE_KEY = 'netmonitor:settings'
const TELEMETRY_RESUME_KEY = 'netmonitor:telemetry-resume'
const LAST_ALERT_KEY = 'netmonitor:last-alert'

const defaultSettings: Settings = {
  threshold: 5 * 1024 * 1024,
  cooldownMinutes: 5,
  pauseMinutes: 5,
}

const loadSettings = (): Settings => {
  if (typeof window === 'undefined') return defaultSettings
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!stored) return defaultSettings
    const parsed = JSON.parse(stored)
    return {
      ...defaultSettings,
      threshold: Number(parsed.threshold) || defaultSettings.threshold,
      cooldownMinutes: Number(parsed.cooldownMinutes) || defaultSettings.cooldownMinutes,
      pauseMinutes: Number(parsed.pauseMinutes) || defaultSettings.pauseMinutes,
    }
  } catch (error) {
    console.warn('Failed to parse settings, falling back to defaults.', error)
    return defaultSettings
  }
}

const loadStoredNumber = (key: string) => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours) return `${hours}h ${minutes}m`
  if (minutes) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

const formatCountdown = (seconds: number) => {
  if (seconds <= 0) return '0s'
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  if (minutes) return `${minutes}m ${remaining}s`
  return `${remaining}s`
}

const progressWidthClass = (ratio: number) => {
  if (ratio >= 0.95) return 'w-[98%]'
  if (ratio >= 0.8) return 'w-[90%]'
  if (ratio >= 0.6) return 'w-[75%]'
  if (ratio >= 0.4) return 'w-[55%]'
  if (ratio >= 0.2) return 'w-[35%]'
  return 'w-[18%]'
}

function App() {
  const [stats, setStats] = useState<NetworkStat | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [historyRange, setHistoryRange] = useState<HistoryRange>('60s')
  const [connections, setConnections] = useState<Connection[]>([])
  const [processUsage, setProcessUsage] = useState<ProcessUsageEntry[]>([])
  const [connectionSearch, setConnectionSearch] = useState('')
  const [connectionStateFilter, setConnectionStateFilter] = useState<'all' | 'ESTABLISHED' | 'LISTEN'>('all')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'connections'>('dashboard')
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState(() => ({
    thresholdMb: Math.round((defaultSettings.threshold / 1024 / 1024) * 10) / 10,
    cooldown: defaultSettings.cooldownMinutes,
    pauseMinutes: defaultSettings.pauseMinutes,
  }))
  const [sessionUsage, setSessionUsage] = useState({ rx: 0, tx: 0 })
  const [maxSpikes, setMaxSpikes] = useState({ rx: 0, tx: 0 })
  const [alertLog, setAlertLog] = useState<{ time: string; direction: 'rx' | 'tx'; rate: string }[]>([])
  const [lastExportTime, setLastExportTime] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
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
  const [alertIndicator, setAlertIndicator] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (!settingsModalOpen) return
    setSettingsDraft({
      thresholdMb: Math.round((settings.threshold / 1024 / 1024) * 10) / 10,
      cooldown: settings.cooldownMinutes,
      pauseMinutes: settings.pauseMinutes,
    })
  }, [settingsModalOpen, settings])

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
    if (lastAlertAt) {
      localStorage.setItem(LAST_ALERT_KEY, lastAlertAt.toString())
    } else {
      localStorage.removeItem(LAST_ALERT_KEY)
    }
  }, [lastAlertAt])

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

  useEffect(() => {
    const fetchData = async () => {
      if (telemetryPaused) return
      try {
        const data = await window.ipcRenderer.getNetworkStats()
        if (data) {
          setStats(data)
          setElapsedSeconds((prev) => prev + 1)

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

  const handleExportHistory = useCallback(() => {
    if (!history.length) return
    const header = 'timestamp,download_bytes_per_sec,upload_bytes_per_sec'
    const rows = history.map((point) => `${point.time},${point.rx},${point.tx}`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `netmonitor-history-${new Date().toISOString().replace(/[:]/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setLastExportTime(new Date().toLocaleTimeString())
  }, [history])

  const handlePauseTelemetry = useCallback(() => {
    if (telemetryPaused) {
      setTelemetryResumeAt(null)
      return
    }
    const resumeTimestamp = Date.now() + settings.pauseMinutes * 60 * 1000
    setTelemetryResumeAt(resumeTimestamp)
  }, [telemetryPaused, settings.pauseMinutes])

  const updateDraft = (field: 'thresholdMb' | 'cooldown' | 'pauseMinutes', value: number) => {
    setSettingsDraft((prev) => ({ ...prev, [field]: value }))
  }

  const handleThresholdSave = useCallback(() => {
    const thresholdMb = Number(settingsDraft.thresholdMb) || settings.threshold / 1024 / 1024
    const cooldown = Number(settingsDraft.cooldown) || settings.cooldownMinutes
    const pauseMinutes = Number(settingsDraft.pauseMinutes) || settings.pauseMinutes
    setSettings((prev) => ({
      ...prev,
      threshold: Math.max(0.5, thresholdMb) * 1024 * 1024,
      cooldownMinutes: Math.max(1, cooldown),
      pauseMinutes: Math.max(1, pauseMinutes),
    }))
    setSettingsModalOpen(false)
  }, [settingsDraft, setSettings, settings])

  const displayedHistory = useMemo(() => {
    const limit = chartWindow[historyRange]
    return history.slice(-limit)
  }, [history, historyRange])

  const averages = useMemo(() => {
    if (!displayedHistory.length) return { rx: 0, tx: 0 }
    const totals = displayedHistory.reduce(
      (acc, point) => {
        acc.rx += point.rx
        acc.tx += point.tx
        return acc
      },
      { rx: 0, tx: 0 }
    )
    return { rx: totals.rx / displayedHistory.length, tx: totals.tx / displayedHistory.length }
  }, [displayedHistory])

  const filteredConnections = useMemo(() => {
    const query = connectionSearch.trim().toLowerCase()
    return connections.filter((conn) => {
      const matchesQuery =
        !query ||
        conn.process?.toLowerCase().includes(query) ||
        conn.localAddress.toLowerCase().includes(query) ||
        conn.peerAddress.toLowerCase().includes(query)
      const matchesState = connectionStateFilter === 'all' || conn.state === connectionStateFilter
      return matchesQuery && matchesState
    })
  }, [connections, connectionSearch, connectionStateFilter])

  const quickConnections = filteredConnections.slice(0, 4)
  const topProcesses = processUsage.slice(0, 5)
  const sessionTotal = sessionUsage.rx + sessionUsage.tx

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.15),_transparent_55%)]" />
      <div className="relative flex h-screen">
        <aside className="hidden md:flex md:w-64 xl:w-72 flex-col border-r border-white/5 bg-slate-950/70 backdrop-blur">
          <div className="flex items-center gap-3 px-6 py-8 border-b border-white/5">
            <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 p-3">
              <Lucide.Activity size={22} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">NetMonitor</p>
              <p className="text-xl font-semibold">Pro v2</p>
            </div>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as 'dashboard' | 'connections')}
                  className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${
                    active
                      ? 'border-sky-400/70 bg-sky-400/10 text-white shadow-[0_0_25px_rgba(14,165,233,0.2)]'
                      : 'border-white/5 bg-white/5 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={18} />
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-400">{item.hint}</span>
                </button>
              )
            })}
          </nav>
          <div className="px-6 py-6 border-t border-white/5 text-xs text-slate-400 space-y-1">
            <p>Status: <span className="text-slate-100">{stats?.operstate || 'Unknown'}</span></p>
            <p>Interface: <span className="text-slate-100">{stats?.iface || '—'}</span></p>
            <p>Session: <span className="text-slate-100">{formatDuration(elapsedSeconds)}</span></p>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="flex h-20 items-center justify-between border-b border-white/5 bg-slate-950/70 px-6 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Real-time view</p>
              <h2 className="text-2xl font-semibold capitalize">{activeTab}</h2>
            </div>
            <div className="flex items-center gap-3">
              {alertIndicator && (
                <span className="flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
                  <Lucide.AlertTriangle size={16} />
                  High usage
                </span>
              )}
              {telemetryPaused && (
                <span className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
                  <Lucide.Pause size={16} />
                  Paused · {formatCountdown(pauseCountdown)}
                </span>
              )}
              <button
                onClick={handleExportHistory}
                disabled={!history.length}
                className={`rounded-full border px-4 py-2 text-sm ${
                  history.length
                    ? 'border-white/10 text-slate-200 hover:border-white/40'
                    : 'border-white/5 text-slate-500'
                }`}
              >
                Export snapshot
              </button>
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Adjust threshold
              </button>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-auto px-6 py-8 space-y-8">
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <section className="rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.4em] text-slate-400">NetMonitor Pro</p>
                        <h1 className="text-3xl font-semibold text-white">Live bandwidth intelligence</h1>
                        <p className="text-slate-400">Monitor spikes, automate alerts, and keep your connection honest.</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="rounded-2xl border border-white/10 px-4 py-3 text-right">
                          <p className="text-xs uppercase text-slate-400">Peak download</p>
                          <p className="text-2xl font-semibold text-emerald-300">{formatBytes(maxSpikes.rx)}/s</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 px-4 py-3 text-right">
                          <p className="text-xs uppercase text-slate-400">Peak upload</p>
                          <p className="text-2xl font-semibold text-sky-300">{formatBytes(maxSpikes.tx)}/s</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-transparent p-5">
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-emerald-200">
                        Download now
                        <Lucide.ArrowDown size={16} />
                      </div>
                      <p className="mt-3 text-3xl font-semibold text-white">{stats ? `${formatBytes(stats.rx_sec)}/s` : '—'}</p>
                      <p className="text-sm text-emerald-100/80">Avg {formatBytes(averages.rx || 0)}/s</p>
                    </div>
                    <div className="rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 to-transparent p-5">
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-sky-200">
                        Upload now
                        <Lucide.ArrowUp size={16} />
                      </div>
                      <p className="mt-3 text-3xl font-semibold text-white">{stats ? `${formatBytes(stats.tx_sec)}/s` : '—'}</p>
                      <p className="text-sm text-sky-100/80">Avg {formatBytes(averages.tx || 0)}/s</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Session usage</p>
                      <p className="mt-3 text-2xl font-semibold">{formatBytes(sessionTotal)}</p>
                      <p className="text-sm text-slate-400">{formatBytes(sessionUsage.rx)} down · {formatBytes(sessionUsage.tx)} up</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Health score</p>
                      <p className="mt-3 text-4xl font-semibold text-lime-300">
                        {Math.max(
                          35,
                          100 - Math.round(((stats?.rx_sec || 0) + (stats?.tx_sec || 0)) / Math.max(settings.threshold, 1) * 100)
                        )}
                      </p>
                      <p className="text-sm text-slate-400">Based on current threshold</p>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/5 bg-slate-950/60 p-6 backdrop-blur">
                    <div className="mb-4 flex flex-wrap items-center gap-4">
                      <div>
                        <p className="text-sm text-slate-400">Network traffic history</p>
                        <p className="text-xl font-semibold text-white">Rolling telemetry</p>
                      </div>
                      <div className="flex gap-2">
                        {rangeOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setHistoryRange(option.value)}
                            className={`rounded-full px-4 py-1 text-sm ${
                              historyRange === option.value
                                ? 'bg-white text-slate-900'
                                : 'bg-white/10 text-slate-300 hover:bg-white/20'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={displayedHistory}>
                          <defs>
                            <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 12 }} interval={Math.max(1, Math.floor(displayedHistory.length / 6))} />
                          <YAxis stroke="#94a3b8" tickFormatter={(value: number) => formatBytes(value)} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                            formatter={(value: number) => [`${formatBytes(value)}/s`, 'Speed']}
                          />
                          <Area type="monotone" dataKey="rx" stroke="#22c55e" fillOpacity={1} fill="url(#colorRx)" name="Download" />
                          <Area type="monotone" dataKey="tx" stroke="#38bdf8" fillOpacity={1} fill="url(#colorTx)" name="Upload" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">Live threshold tracker</p>
                        <button className="text-xs text-slate-300 underline" onClick={() => setSettingsModalOpen(true)}>
                          Edit
                        </button>
                      </div>
                      <div className="mt-4 flex items-center gap-4">
                        <div className="h-20 w-20 rounded-2xl border border-white/10 p-4 text-center">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Limit</p>
                          <p className="text-lg font-semibold">{formatBytes(settings.threshold)}/s</p>
                        </div>
                        <div className="flex-1 space-y-2 text-sm text-slate-300">
                          <p>Notifications muted for {settings.cooldownMinutes} min cooldown.</p>
                          <p>Last alert: {alertLog[0]?.time || 'No alerts yet'}</p>
                        </div>
                      </div>
                      {alertLog.length > 0 && (
                        <ul className="mt-4 space-y-2 text-sm text-slate-300">
                          {alertLog.map((log, index) => (
                            <li key={`${log.time}-${index}`} className="flex items-center gap-2 text-xs text-slate-400">
                              <span className={`h-2 w-2 rounded-full ${log.direction === 'rx' ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                              Spike at {log.time} · {log.rate}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">Active connection preview</p>
                        <button className="text-xs text-slate-300 underline" onClick={() => setActiveTab('connections')}>
                          View all
                        </button>
                      </div>
                      <div className="mt-4 space-y-3">
                        {quickConnections.length ? (
                          quickConnections.map((conn, idx) => (
                            <div key={`${conn.localAddress}-${conn.localPort}-${idx}`} className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-white">{conn.process || 'System'}</p>
                                <p className="text-xs text-slate-400">{conn.localAddress}:{conn.localPort} → {conn.peerAddress}:{conn.peerPort}</p>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-xs ${
                                  conn.state === 'ESTABLISHED'
                                    ? 'bg-emerald-400/20 text-emerald-200'
                                    : 'bg-blue-400/20 text-blue-200'
                                }`}
                              >
                                {conn.state}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400">Connections will populate as soon as we capture the socket table.</p>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/5 bg-white/5 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">Per-process usage</p>
                        <p className="text-xl font-semibold text-white">Top talkers</p>
                      </div>
                      <span className="text-xs text-slate-400">{topProcesses.length ? 'Live data' : 'Awaiting data'}</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {topProcesses.length ? (
                        topProcesses.map((proc) => (
                          <div key={`${proc.pid}-${proc.name}`} className="rounded-2xl border border-white/10 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{proc.name}</p>
                                <p className="text-xs text-slate-400">PID {proc.pid === -1 ? '—' : proc.pid} · {proc.connections} sockets</p>
                              </div>
                              <div className="text-right text-xs text-slate-400">
                                <p className="text-sm text-white">{formatBytes(proc.rx)}/s ↓</p>
                                <p>{formatBytes(proc.tx)}/s ↑</p>
                              </div>
                            </div>
                            <div className="mt-3 h-1.5 rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500 ${progressWidthClass(proc.activityScore)}`}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">Waiting for native metrics from the main process…</p>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'connections' && (
                <div className="space-y-6">
                  <section className="rounded-3xl border border-white/5 bg-white/5 p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-900/70 p-3">
                          <Lucide.ShieldCheck size={20} />
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Live connections</p>
                          <p className="text-3xl font-semibold">{filteredConnections.length}</p>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[220px]">
                          <Lucide.Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                          <input
                            value={connectionSearch}
                            onChange={(event) => setConnectionSearch(event.target.value)}
                            placeholder="Filter by process or address"
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          {stateFilters.map((filter) => (
                            <button
                              key={filter.value}
                              onClick={() => setConnectionStateFilter(filter.value as 'all' | 'ESTABLISHED' | 'LISTEN')}
                              className={`rounded-2xl px-4 py-2 text-sm ${
                                connectionStateFilter === filter.value
                                  ? 'bg-white text-slate-900'
                                  : 'bg-white/10 text-slate-400 hover:bg-white/20'
                              }`}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/5 bg-slate-950/70">
                    <div className="overflow-auto">
                      <table className="w-full text-left text-sm text-slate-200">
                        <thead className="sticky top-0 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="px-5 py-3">Process</th>
                            <th className="px-5 py-3">Protocol</th>
                            <th className="px-5 py-3">Local</th>
                            <th className="px-5 py-3">Remote</th>
                            <th className="px-5 py-3">State</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredConnections.map((conn, index) => (
                            <tr key={`${conn.localAddress}-${conn.localPort}-${index}`} className="border-t border-white/5 text-sm hover:bg-white/5">
                              <td className="px-5 py-4 font-medium text-white">{conn.process || 'System'}</td>
                              <td className="px-5 py-4">{conn.protocol.toUpperCase()}</td>
                              <td className="px-5 py-4 text-slate-300">
                                {conn.localAddress}:{conn.localPort}
                              </td>
                              <td className="px-5 py-4 text-slate-300">
                                {conn.peerAddress}:{conn.peerPort}
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    conn.state === 'ESTABLISHED'
                                      ? 'bg-emerald-400/20 text-emerald-200'
                                      : conn.state === 'LISTEN'
                                        ? 'bg-sky-400/20 text-sky-100'
                                        : 'bg-white/10 text-slate-300'
                                  }`}
                                >
                                  {conn.state}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {filteredConnections.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                                No connections match the current filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}
            </main>

            <aside className="hidden xl:block w-80 border-l border-white/5 bg-slate-950/70 px-6 py-8 backdrop-blur">
              <div className="space-y-6 text-sm">
                <div className="rounded-3xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Interface</p>
                  <p className="text-lg font-semibold text-white">{stats?.iface || 'Detecting...'}</p>
                  <p className="text-slate-400">State: {stats?.operstate || 'Unknown'}</p>
                </div>
                <div className="rounded-3xl border border-white/5 bg-white/5 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Traffic blend</p>
                  <div className="flex gap-3 text-sm">
                    <div className="flex-1 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                      <p className="text-slate-200">Download</p>
                      <p className="text-2xl font-semibold text-white">{formatBytes(sessionUsage.rx)}</p>
                    </div>
                    <div className="flex-1 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3">
                      <p className="text-slate-200">Upload</p>
                      <p className="text-2xl font-semibold text-white">{formatBytes(sessionUsage.tx)}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/5 bg-white/5 p-4 space-y-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Helper actions</p>
                  <button
                    onClick={handlePauseTelemetry}
                    className={`w-full rounded-2xl border px-4 py-2 text-left transition ${
                      telemetryPaused
                        ? 'border-amber-400/40 bg-amber-400/10 hover:border-amber-300/60'
                        : 'border-white/10 hover:border-white/40'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">
                      {telemetryPaused ? 'Resume telemetry' : 'Pause telemetry'}
                    </div>
                    <p className="text-xs text-slate-400">
                      {telemetryPaused
                        ? `Resume in ${formatCountdown(pauseCountdown)}`
                        : `Suspend background polling for ${settings.pauseMinutes} minutes`}
                    </p>
                  </button>
                  <button
                    onClick={handleExportHistory}
                    disabled={!history.length}
                    className={`w-full rounded-2xl border px-4 py-2 text-left transition ${
                      history.length ? 'border-white/10 hover:border-white/40' : 'border-white/5 text-slate-500'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">Export CSV</div>
                    <p className="text-xs text-slate-400">
                      {history.length ? lastExportTime ? `Last export ${lastExportTime}` : 'Dump current history to a file' : 'History buffer is empty'}
                    </p>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur" onClick={() => setSettingsModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/95 p-6 text-sm text-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Alerts</p>
                <h3 className="text-xl font-semibold text-white">Adjust thresholds</h3>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="rounded-full border border-white/10 p-2 text-slate-400 hover:text-white"
                aria-label="Close settings"
              >
                <Lucide.X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-slate-400">Speed limit (MB/s)</span>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={settingsDraft.thresholdMb}
                  onChange={(event) => updateDraft('thresholdMb', Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-white focus:border-sky-400"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-slate-400">Cooldown (minutes)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={settingsDraft.cooldown}
                  onChange={(event) => updateDraft('cooldown', Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-white focus:border-sky-400"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase tracking-wide text-slate-400">Pause duration (minutes)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={settingsDraft.pauseMinutes}
                  onChange={(event) => updateDraft('pauseMinutes', Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-white focus:border-sky-400"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3 text-sm">
              <button onClick={() => setSettingsModalOpen(false)} className="rounded-2xl border border-white/10 px-4 py-2 text-slate-300 hover:border-white/40">
                Cancel
              </button>
              <button onClick={handleThresholdSave} className="rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2 font-semibold text-white">
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
