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

  const usagePct = Math.min(((rxNow + txNow) / Math.max(settings.threshold, 1)) * 100, 100)

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── Hero banner ───────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl p-6 border border-white/[0.06]"
        style={{
          background: 'linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(6,11,24,0.95) 50%, rgba(99,102,241,0.08) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 40px rgba(56,189,248,0.04)',
        }}
      >
        {/* Decorative radial glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-sky-400/[0.08] rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-indigo-500/[0.08] rounded-full blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-1.5 text-[9px] uppercase tracking-[0.35em] text-slate-600 font-semibold">NetMonitor Pro · Real-time</p>
            <h1 className="text-xl font-bold text-white leading-tight">Live Bandwidth Intelligence</h1>
            <p className="text-[12px] text-slate-500 mt-1">Monitor spikes · automate alerts · keep your connection honest</p>
          </div>

          <div className="flex gap-3">
            <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.06] px-4 py-3 text-right min-w-[100px]">
              <p className="text-[9px] uppercase tracking-wider text-sky-600 font-semibold mb-1">Peak ↓</p>
              <p className="text-lg font-bold text-sky-300 font-data">{formatBytes(maxSpikes.rx)}/s</p>
            </div>
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3 text-right min-w-[100px]">
              <p className="text-[9px] uppercase tracking-wider text-emerald-600 font-semibold mb-1">Peak ↑</p>
              <p className="text-lg font-bold text-emerald-300 font-data">{formatBytes(maxSpikes.tx)}/s</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Metric Cards ──────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <WaveformCard
          label="Download"
          value={stats ? `${formatBytes(rxNow)}/s` : '--'}
          subLabel={`Avg ${formatBytes(averages.rx)}/s`}
          history={rxHistory}
          color="sky"
          icon={<Lucide.ArrowDown size={13} />}
          threshold={settings.threshold}
        />
        <WaveformCard
          label="Upload"
          value={stats ? `${formatBytes(txNow)}/s` : '--'}
          subLabel={`Avg ${formatBytes(averages.tx)}/s`}
          history={txHistory}
          color="emerald"
          icon={<Lucide.ArrowUp size={13} />}
          threshold={settings.threshold}
        />
        <WaveformCard
          label="Session"
          value={formatBytes(sessionTotal)}
          subLabel={`↓ ${formatBytes(sessionUsage.rx)}  ↑ ${formatBytes(sessionUsage.tx)}`}
          history={sessionHistory}
          color="violet"
          icon={<Lucide.Database size={13} />}
        />
        <WaveformCard
          label="Health"
          value={`${health}%`}
          subLabel="vs threshold"
          history={healthHistory}
          color={healthColor}
          icon={<Lucide.HeartPulse size={13} />}
          threshold={100}
        />
      </section>

      {/* ── Rolling chart ─────────────────────────────────────── */}
      <NetworkChart history={history} range={historyRange} onRangeChange={setHistoryRange} />

      {/* ── Alert timeline ────────────────────────────────────── */}
      <PulseTimeline alertLog={alertLog} />

      {/* ── Bottom row ────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">

        {/* Threshold tracker */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#060b18]/80 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10">
                <Lucide.Gauge size={12} className="text-sky-400" />
              </div>
              <p className="text-[13px] font-semibold text-white">Threshold Tracker</p>
            </div>
            <button
              onClick={onOpenSettings}
              className="text-[11px] text-sky-500 hover:text-sky-300 transition-colors flex items-center gap-1"
            >
              Edit <Lucide.ArrowRight size={10} />
            </button>
          </div>

          <div className="space-y-3">
            {/* Limit pill */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/[0.05] shrink-0">
                <p className="text-[8px] uppercase tracking-wider text-sky-600">Limit</p>
                <p className="text-[11px] font-bold text-sky-300 font-data leading-tight">{formatBytes(settings.threshold)}</p>
                <p className="text-[8px] text-sky-600/70">/s</p>
              </div>
              <div className="flex-1 space-y-2">
                {/* Bar */}
                <div className="relative h-2 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${usagePct}%`,
                      background: usagePct > 90
                        ? 'linear-gradient(90deg, #fb7185, #f43f5e)'
                        : usagePct > 70
                        ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                        : 'linear-gradient(90deg, #38bdf8, #818cf8)',
                    }}
                  />
                  {/* Shimmer on bar */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
                </div>
                <p className="text-[11px] text-slate-500 font-data">
                  {formatBytes(rxNow + txNow)}/s of {formatBytes(settings.threshold)}/s
                </p>
                <p className="text-[10px] text-slate-700">
                  Cooldown: {settings.cooldownMinutes}m · Last alert: {alertLog[0]?.time ?? 'none'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Connection preview */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#060b18]/80 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
                <Lucide.Activity size={12} className="text-emerald-400" />
              </div>
              <p className="text-[13px] font-semibold text-white">Live Speeds</p>
            </div>
            <span className="text-[11px] text-slate-600">See Connections →</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-sky-400/10 bg-sky-400/[0.04] px-3 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Lucide.ArrowDown size={10} className="text-sky-500" />
                <p className="text-[9px] text-sky-600 uppercase tracking-wider font-semibold">Download</p>
              </div>
              <p className="text-[18px] font-bold text-white font-data">{formatBytes(rxNow)}/s</p>
            </div>
            <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Lucide.ArrowUp size={10} className="text-emerald-500" />
                <p className="text-[9px] text-emerald-600 uppercase tracking-wider font-semibold">Upload</p>
              </div>
              <p className="text-[18px] font-bold text-white font-data">{formatBytes(txNow)}/s</p>
            </div>
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 col-span-2">
              <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">Interface</p>
              <p className="text-[13px] font-semibold text-white font-data">
                {stats?.iface ?? '--'}
                <span className="text-slate-600 font-normal ml-2">— {stats?.operstate ?? 'unknown'}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Process list ──────────────────────────────────────── */}
      <ProcessList processes={processUsage} />
    </div>
  )
}
