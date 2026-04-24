import * as Lucide from 'lucide-react'
import { formatCountdown } from '../../lib/utils'
import type { HistoryPoint } from '../../types'

interface HeaderProps {
  activeTab: 'dashboard' | 'connections' | 'map' | 'history'
  alertIndicator: boolean
  telemetryPaused: boolean
  pauseCountdown: number
  history: HistoryPoint[]
  onExport: () => void
  onOpenSettings: () => void
  onTogglePause: () => void
  onOpenCommandPalette: () => void
}

export function Header({
  activeTab,
  alertIndicator,
  telemetryPaused,
  pauseCountdown,
  history,
  onExport,
  onOpenSettings,
  onTogglePause,
  onOpenCommandPalette,
}: HeaderProps) {
  return (
    <header className="flex h-20 items-center justify-between border-b border-white/5 bg-slate-950/70 px-6 backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Real-time view</p>
        <h2 className="text-2xl font-semibold capitalize text-white">{activeTab}</h2>
      </div>

      <div className="flex items-center gap-3">
        {alertIndicator && (
          <span className="animate-pulse flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
            <Lucide.AlertTriangle size={16} />
            High usage
          </span>
        )}

        {/* Ctrl+K Command Palette trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          title="Command Palette (Ctrl+K)"
        >
          <Lucide.Search size={15} />
          <span className="hidden sm:inline text-xs">Search</span>
          <kbd className="hidden sm:inline rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
        </button>

        <button
          onClick={onTogglePause}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
            telemetryPaused
              ? 'border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
              : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          {telemetryPaused ? (
            <><Lucide.Play size={16} />Resume / {formatCountdown(pauseCountdown)}</>
          ) : (
            <><Lucide.Pause size={16} />Pause telemetry</>
          )}
        </button>

        <button
          onClick={() => { void window.desktop.toggleOverlay() }}
          className="rounded-full border border-white/5 bg-white/5 p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          title="Toggle Stealth Overlay"
        >
          <Lucide.Ghost size={18} />
        </button>

        <button
          onClick={onExport}
          disabled={!history.length}
          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
            history.length
              ? 'border-white/10 text-slate-200 hover:border-white/40 hover:bg-white/5'
              : 'cursor-not-allowed border-white/5 text-slate-500'
          }`}
        >
          Export snapshot
        </button>

        <button
          onClick={onOpenSettings}
          className="rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition-all hover:from-sky-400 hover:to-indigo-400"
        >
          Adjust threshold
        </button>
      </div>
    </header>
  )
}
