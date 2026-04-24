import { useMemo } from 'react'
import * as Lucide from 'lucide-react'
import type { AlertLogEntry, HistoryPoint, HistoryRange, NetworkStat, ProcessUsageEntry, Settings } from '../../types'
import { chartWindow } from '../../lib/constants'
import { formatBytes } from '../../lib/utils'
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
  stats, maxSpikes, sessionUsage, settings,
  history, historyRange, setHistoryRange,
  processUsage, alertLog, onOpenSettings,
}: DashboardViewProps) {
  const sessionTotal = sessionUsage.rx + sessionUsage.tx

  const displayedHistory = useMemo(() => {
    const limit = chartWindow[historyRange]
    return history.slice(-limit)
  }, [history, historyRange])

  const averages = useMemo(() => {
    if (!displayedHistory.length) return { rx: 0, tx: 0 }
    const t = displayedHistory.reduce((a, p) => { a.rx += p.rx; a.tx += p.tx; return a }, { rx: 0, tx: 0 })
    return { rx: t.rx / displayedHistory.length, tx: t.tx / displayedHistory.length }
  }, [displayedHistory])

  const rxHistory      = useMemo(() => history.slice(-60).map(p => p.rx), [history])
  const txHistory      = useMemo(() => history.slice(-60).map(p => p.tx), [history])
  const sessionHistory = useMemo(() => history.slice(-60).map(p => p.rx + p.tx), [history])
  const healthHistory  = useMemo(() =>
    history.slice(-60).map(p =>
      Math.max(0, 100 - Math.round((p.rx + p.tx) / Math.max(settings.threshold, 1) * 100))
    ), [history, settings.threshold])

  const rxNow   = stats?.rx_sec ?? 0
  const txNow   = stats?.tx_sec ?? 0
  const health  = Math.max(0, 100 - Math.round((rxNow + txNow) / Math.max(settings.threshold, 1) * 100))
  const healthColor = health > 70 ? 'emerald' : health > 40 ? 'amber' : 'rose'

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-sky-500/10 via-[#080c14] to-indigo-500/10 p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.12),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.12),transparent_55%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.4em] text-slate-500">NetMonitor Pro — Real-time</p>
            <h1 className="text-2xl font-bold text-white">Live Bandwidth Intelligence</h1>
            <p className="text-sm text-slate-400 mt-0.5">Monitor spikes · automate alerts · keep your connection honest</p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-right min-w-[110px]">
              <p className="text-[10px] uppercase tracking-wider text-sky-500">Peak ↓</p>
              <p className="text-xl font-bold text-sky-300">{formatBytes(maxSpikes.rx)}/s</p>
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-right min-w-[110px]">
              <p className="text-[10px] uppercase tracking-wider text-emerald-500">Peak ↑</p>
              <p className="text-xl font-bold text-emerald-300">{formatBytes(maxSpikes.tx)}/s</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Waveform Cards ───────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <WaveformCard
          label="Download"
          value={stats ? `${formatBytes(rxNow)}/s` : '--'}
          subLabel={`Avg ${formatBytes(averages.rx)}/s`}
          history={rxHistory}
          color="sky"
          icon={<Lucide.ArrowDown size={14} />}
          threshold={settings.threshold}
        />
        <WaveformCard
          label="Upload"
          value={stats ? `${formatBytes(txNow)}/s` : '--'}
          subLabel={`Avg ${formatBytes(averages.tx)}/s`}
          history={txHistory}
          color="emerald"
          icon={<Lucide.ArrowUp size={14} />}
          threshold={settings.threshold}
        />
        <WaveformCard
          label="Session"
          value={formatBytes(sessionTotal)}
          subLabel={`↓ ${formatBytes(sessionUsage.rx)}  ↑ ${formatBytes(sessionUsage.tx)}`}
          history={sessionHistory}
          color="violet"
          icon={<Lucide.Database size={14} />}
        />
        <WaveformCard
          label="Health"
          value={`${health}%`}
          subLabel="vs current threshold"
          history={healthHistory}
          color={healthColor}
          icon={<Lucide.HeartPulse size={14} />}
          threshold={100}
        />
      </section>

      {/* ── Rolling chart ────────────────────────────────────── */}
      <NetworkChart history={history} range={historyRange} onRangeChange={setHistoryRange} />

      {/* ── Pulse Timeline ───────────────────────────────────── */}
      <PulseTimeline alertLog={alertLog} />

      {/* ── Bottom row ───────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Threshold tracker */}
        <div className="rounded-2xl border border-white/5 bg-[#080c14]/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Live Threshold Tracker</p>
            <button onClick={onOpenSettings} className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors">Edit →</button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/5">
              <p className="text-[9px] uppercase tracking-widest text-sky-500">Limit</p>
              <p className="text-sm font-bold text-sky-300 leading-tight">{formatBytes(settings.threshold)}</p>
              <p className="text-[9px] text-sky-500/70">/s</p>
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400 transition-all duration-500"
                  style={{ width: `${Math.min(((rxNow + txNow) / Math.max(settings.threshold, 1)) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {formatBytes(rxNow + txNow)}/s of {formatBytes(settings.threshold)}/s
              </p>
              <p className="text-xs text-slate-600">Cooldown: {settings.cooldownMinutes}m · Last alert: {alertLog[0]?.time ?? 'none'}</p>
            </div>
          </div>
        </div>

        {/* Connection preview */}
        <div className="rounded-2xl border border-white/5 bg-[#080c14]/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Active Connection Preview</p>
            <span className="text-[11px] text-slate-500">See Connections tab →</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2.5">
              <p className="text-[10px] text-emerald-500 uppercase tracking-wider">Download now</p>
              <p className="text-lg font-bold text-white">{formatBytes(rxNow)}/s</p>
            </div>
            <div className="rounded-xl border border-sky-400/15 bg-sky-400/5 px-3 py-2.5">
              <p className="text-[10px] text-sky-500 uppercase tracking-wider">Upload now</p>
              <p className="text-lg font-bold text-white">{formatBytes(txNow)}/s</p>
            </div>
            <div className="rounded-xl border border-violet-400/15 bg-violet-400/5 px-3 py-2.5 col-span-2">
              <p className="text-[10px] text-violet-500 uppercase tracking-wider">Interface</p>
              <p className="text-sm font-semibold text-white">{stats?.iface ?? '--'} <span className="text-slate-500 font-normal">— {stats?.operstate ?? 'unknown'}</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Process list ─────────────────────────────────────── */}
      <ProcessList processes={processUsage} />
    </div>
  )
}
