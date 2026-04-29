import { ConnectionTable } from './ConnectionTable'
import type { Connection, NetworkStat, HistoryPoint, Settings } from '../../types'
import { formatBytes, formatCountdown } from '../../lib/utils'
import * as Lucide from 'lucide-react'

interface ConnectionsViewProps {
  connections: Connection[]
  stats: NetworkStat | null
  sessionUsage: { rx: number; tx: number }
  telemetryPaused: boolean
  handlePauseTelemetry: () => void
  pauseCountdown: number
  settings: Settings
  handleExportHistory: () => void
  history: HistoryPoint[]
  lastExportTime: string | null
}

export function ConnectionsView({
  connections, stats, sessionUsage,
  telemetryPaused, handlePauseTelemetry, pauseCountdown,
  settings, handleExportHistory, history, lastExportTime,
}: ConnectionsViewProps) {
  const rxNow = stats?.rx_sec ?? 0
  const txNow = stats?.tx_sec ?? 0

  return (
    <div className="flex h-full gap-5">
      {/* Main table area */}
      <div className="flex-1 min-w-0">
        <ConnectionTable connections={connections} />
      </div>

      {/* Right sidebar */}
      <aside className="hidden xl:flex flex-col gap-3 w-64 shrink-0">

        {/* Interface card */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#060b18]/80 p-4">
          <p className="mb-3 text-[9px] uppercase tracking-[0.25em] text-slate-600 font-semibold">Interface</p>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl bg-sky-400/15 blur-md" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10">
                <Lucide.Wifi size={16} className="text-sky-400" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white truncate font-data">{stats?.iface ?? 'Detecting...'}</p>
              <p className="text-[11px] text-slate-600">
                State: <span className={stats?.operstate === 'up' ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                  {stats?.operstate ?? 'unknown'}
                </span>
              </p>
            </div>
          </div>

          {/* Connection count */}
          <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
            <span className="text-[10px] text-slate-600">Active connections</span>
            <span className="text-[13px] font-bold text-white font-data">{connections.length}</span>
          </div>
        </div>

        {/* Session Traffic */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#060b18]/80 p-4">
          <p className="mb-3 text-[9px] uppercase tracking-[0.25em] text-slate-600 font-semibold">Session Traffic</p>
          <div className="space-y-2">
            <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Lucide.ArrowDown size={10} className="text-emerald-500" />
                <p className="text-[9px] text-emerald-600 uppercase tracking-wider font-semibold">Downloaded</p>
              </div>
              <p className="text-[16px] font-bold text-white font-data">{formatBytes(sessionUsage.rx)}</p>
            </div>
            <div className="rounded-xl border border-sky-400/10 bg-sky-400/[0.04] px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Lucide.ArrowUp size={10} className="text-sky-500" />
                <p className="text-[9px] text-sky-600 uppercase tracking-wider font-semibold">Uploaded</p>
              </div>
              <p className="text-[16px] font-bold text-white font-data">{formatBytes(sessionUsage.tx)}</p>
            </div>
          </div>
        </div>

        {/* Live speed bars */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#060b18]/80 p-4">
          <p className="mb-3 text-[9px] uppercase tracking-[0.25em] text-slate-600 font-semibold">Live Speed</p>
          <div className="space-y-3">
            {[
              { label: 'Download', value: rxNow, max: settings.threshold, color: 'emerald' as const },
              { label: 'Upload',   value: txNow, max: settings.threshold, color: 'sky'     as const },
            ].map(({ label, value, max, color }) => {
              const pct = Math.min((value / Math.max(max, 1)) * 100, 100)
              const colorMap = {
                emerald: { text: 'text-emerald-300', bar: 'bg-emerald-400', track: 'bg-emerald-400/10' },
                sky: { text: 'text-sky-300', bar: 'bg-sky-400', track: 'bg-sky-400/10' },
              }
              const c = colorMap[color]
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-slate-600">{label}</span>
                    <span className={`text-[11px] font-bold ${c.text} font-data`}>{formatBytes(value)}/s</span>
                  </div>
                  <div className={`h-1.5 rounded-full ${c.track} overflow-hidden`}>
                    <div
                      className={`h-full ${c.bar} rounded-full transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#060b18]/80 p-4 space-y-2">
          <p className="mb-2 text-[9px] uppercase tracking-[0.25em] text-slate-600 font-semibold">Actions</p>

          <button
            onClick={handlePauseTelemetry}
            className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              telemetryPaused
                ? 'border-amber-400/25 bg-amber-400/[0.07] text-amber-300 hover:bg-amber-400/10'
                : 'border-white/[0.06] bg-white/[0.03] text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
              telemetryPaused ? 'bg-amber-400/15' : 'bg-white/5'
            }`}>
              {telemetryPaused ? <Lucide.Play size={12} /> : <Lucide.Pause size={12} />}
            </div>
            <div className="text-left min-w-0">
              <p className="text-[11px] font-semibold">{telemetryPaused ? 'Resume Telemetry' : 'Pause Telemetry'}</p>
              <p className="text-[9px] text-slate-600 truncate">
                {telemetryPaused ? `Resumes in ${formatCountdown(pauseCountdown)}` : `Pause for ${settings.pauseMinutes}m`}
              </p>
            </div>
          </button>

          <button
            onClick={handleExportHistory}
            disabled={!history.length}
            className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              history.length
                ? 'border-white/[0.06] bg-white/[0.03] text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'
                : 'cursor-not-allowed border-white/[0.03] text-slate-700'
            }`}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/5">
              <Lucide.Download size={12} />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[11px] font-semibold">Export CSV</p>
              <p className="text-[9px] text-slate-600 truncate">
                {lastExportTime ? `Last: ${lastExportTime}` : history.length ? 'Dump history to file' : 'No data yet'}
              </p>
            </div>
          </button>
        </div>
      </aside>
    </div>
  )
}
