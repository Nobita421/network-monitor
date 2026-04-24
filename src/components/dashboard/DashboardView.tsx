import { useMemo } from 'react'
import * as Lucide from 'lucide-react'
import type { AlertLogEntry, HistoryPoint, HistoryRange, NetworkStat, ProcessUsageEntry, Settings } from '../../types'
import { chartWindow } from '../../lib/constants'
import { formatBytes, formatMinutesDuration } from '../../lib/utils'
import { Card } from '../ui/Card'
import { NetworkChart } from './NetworkChart'
import { ProcessList } from './ProcessList'
import { WaveformCard } from './WaveformCard'
import { PulseTimeline } from './PulseTimeline'

interface DashboardViewProps {
  stats: NetworkStat | null
  maxSpikes: { rx: number; tx: number }
  sessionUsage: { rx: number; tx: number }
  settings: Settings
  history: HistoryPoint[]
  historyRange: HistoryRange
  setHistoryRange: (range: HistoryRange) => void
  processUsage: ProcessUsageEntry[]
  alertLog: AlertLogEntry[]
  onOpenSettings: () => void
}

export function DashboardView({
  stats,
  maxSpikes,
  sessionUsage,
  settings,
  history,
  historyRange,
  setHistoryRange,
  processUsage,
  alertLog,
  onOpenSettings,
}: DashboardViewProps) {
  const sessionTotal = sessionUsage.rx + sessionUsage.tx

  const displayedHistory = useMemo(() => {
    const limit = chartWindow[historyRange]
    return history.slice(-limit)
  }, [history, historyRange])

  const averages = useMemo(() => {
    if (!displayedHistory.length) return { rx: 0, tx: 0 }
    const totals = displayedHistory.reduce(
      (acc, p) => { acc.rx += p.rx; acc.tx += p.tx; return acc },
      { rx: 0, tx: 0 },
    )
    return { rx: totals.rx / displayedHistory.length, tx: totals.tx / displayedHistory.length }
  }, [displayedHistory])

  // extract raw number arrays for waveform sparklines
  const rxHistory = useMemo(() => history.slice(-30).map(p => p.rx), [history])
  const txHistory = useMemo(() => history.slice(-30).map(p => p.tx), [history])
  const sessionHistory = useMemo(() => history.slice(-30).map(p => p.rx + p.tx), [history])

  const healthScore = Math.max(
    35,
    100 - Math.round(((stats?.rx_sec ?? 0) + (stats?.tx_sec ?? 0)) / Math.max(settings.threshold, 1) * 100),
  )
  const healthHistory = useMemo(() =>
    history.slice(-30).map(p =>
      Math.max(35, 100 - Math.round((p.rx + p.tx) / Math.max(settings.threshold, 1) * 100))
    ),
    [history, settings.threshold]
  )

  return (
    <div className="space-y-8">
      {/* Hero banner */}
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

      {/* Waveform Speed Cards — replaces flat stat boxes */}
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <WaveformCard
          label="Download now"
          value={stats ? `${formatBytes(stats.rx_sec)}/s` : '--'}
          subLabel={`Avg ${formatBytes(averages.rx)}/s`}
          history={rxHistory}
          color="emerald"
          icon={<Lucide.ArrowDown size={14} />}
          threshold={settings.threshold}
        />
        <WaveformCard
          label="Upload now"
          value={stats ? `${formatBytes(stats.tx_sec)}/s` : '--'}
          subLabel={`Avg ${formatBytes(averages.tx)}/s`}
          history={txHistory}
          color="sky"
          icon={<Lucide.ArrowUp size={14} />}
          threshold={settings.threshold}
        />
        <WaveformCard
          label="Session usage"
          value={formatBytes(sessionTotal)}
          subLabel={`${formatBytes(sessionUsage.rx)} ↓  ${formatBytes(sessionUsage.tx)} ↑`}
          history={sessionHistory}
          color="slate"
          icon={<Lucide.Database size={14} />}
        />
        <WaveformCard
          label="Health score"
          value={String(healthScore)}
          subLabel="Based on current threshold"
          history={healthHistory}
          color="lime"
          icon={<Lucide.HeartPulse size={14} />}
          threshold={100}
        />
      </section>

      <NetworkChart history={history} range={historyRange} onRangeChange={setHistoryRange} />

      {/* Anomaly Pulse Timeline — replaces plain alert log list */}
      <PulseTimeline alertLog={alertLog} />

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Live threshold tracker</p>
            <button className="text-xs text-slate-300 underline hover:text-white" onClick={onOpenSettings}>
              Edit
            </button>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="h-20 w-20 rounded-2xl border border-white/10 p-4 text-center">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Limit</p>
              <p className="text-lg font-semibold text-white">{formatBytes(settings.threshold)}/s</p>
            </div>
            <div className="flex-1 space-y-2 text-sm text-slate-300">
              <p>Notifications muted for {formatMinutesDuration(settings.cooldownMinutes)} cooldown.</p>
              <p>Last alert: {alertLog[0]?.time ?? 'No alerts yet'}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Active connection preview</p>
            <span className="text-xs text-slate-500">See Connections tab</span>
          </div>
          <div className="mt-4 flex h-40 flex-col items-center justify-center text-sm text-slate-500">
            <Lucide.Network size={32} className="mb-2 opacity-50" />
            <p>Switch to Connections tab for full details</p>
          </div>
        </Card>
      </section>

      <ProcessList processes={processUsage} />
    </div>
  )
}
