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
  return (
    <div className="flex h-full gap-5">
      {/* Main table area */}
      <div className="flex-1 min-w-0">
        <ConnectionTable connections={connections} />
      </div>

      {/* Right sidebar panel */}
      <aside className="hidden xl:flex flex-col gap-4 w-72 shrink-0">

        {/* Interface card */}
        <div className="rounded-2xl border border-white/5 bg-[#080c14]/70 p-4">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-slate-500">Interface</p>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10">
              <Lucide.Wifi size={16} className="text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{stats?.iface ?? 'Detecting...'}</p>
              <p className="text-xs text-slate-500">State: <span className={stats?.operstate === 'up' ? 'text-emerald-400' : 'text-slate-400'}>{stats?.operstate ?? 'unknown'}</span></p>
            </div>
          </div>
        </div>

        {/* Traffic blend */}
        <div className="rounded-2xl border border-white/5 bg-[#080c14]/70 p-4">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-slate-500">Traffic Blend</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/8 p-3">
              <div className="flex items-center gap-1 mb-1">
                <Lucide.ArrowDown size={11} className="text-emerald-400" />
                <p className="text-[10px] text-emerald-500 uppercase tracking-wide">Download</p>
              </div>
              <p className="text-lg font-bold text-white">{formatBytes(sessionUsage.rx)}</p>
            </div>
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/8 p-3">
              <div className="flex items-center gap-1 mb-1">
                <Lucide.ArrowUp size={11} className="text-sky-400" />
                <p className="text-[10px] text-sky-500 uppercase tracking-wide">Upload</p>
              </div>
              <p className="text-lg font-bold text-white">{formatBytes(sessionUsage.tx)}</p>
            </div>
          </div>
        </div>

        {/* Live stats */}
        <div className="rounded-2xl border border-white/5 bg-[#080c14]/70 p-4">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-slate-500">Live Speed</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">↓ Download</span>
              <span className="text-xs font-semibold text-emerald-300">{formatBytes(stats?.rx_sec ?? 0)}/s</span>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-300" style={{ width: `${Math.min((stats?.rx_sec ?? 0) / Math.max(settings.threshold, 1) * 100, 100)}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">↑ Upload</span>
              <span className="text-xs font-semibold text-sky-300">{formatBytes(stats?.tx_sec ?? 0)}/s</span>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full bg-sky-400 rounded-full transition-all duration-300" style={{ width: `${Math.min((stats?.tx_sec ?? 0) / Math.max(settings.threshold, 1) * 100, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-2xl border border-white/5 bg-[#080c14]/70 p-4 space-y-2">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">Actions</p>
          <button
            onClick={handlePauseTelemetry}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
              telemetryPaused
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
                : 'border-white/8 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/8'
            }`}
          >
            {telemetryPaused ? <Lucide.Play size={14} /> : <Lucide.Pause size={14} />}
            <div className="text-left">
              <p className="text-xs font-semibold">{telemetryPaused ? 'Resume Telemetry' : 'Pause Telemetry'}</p>
              <p className="text-[10px] text-slate-500">
                {telemetryPaused ? `Resumes in ${formatCountdown(pauseCountdown)}` : `Pause for ${settings.pauseMinutes}m`}
              </p>
            </div>
          </button>
          <button
            onClick={handleExportHistory}
            disabled={!history.length}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
              history.length
                ? 'border-white/8 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/8'
                : 'cursor-not-allowed border-white/5 text-slate-600'
            }`}
          >
            <Lucide.Download size={14} />
            <div className="text-left">
              <p className="text-xs font-semibold">Export CSV</p>
              <p className="text-[10px] text-slate-500">
                {lastExportTime ? `Last: ${lastExportTime}` : history.length ? 'Dump history to file' : 'No data yet'}
              </p>
            </div>
          </button>
        </div>
      </aside>
    </div>
  )
}
