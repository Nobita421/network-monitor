import * as Lucide from 'lucide-react'
import { formatCountdown } from '../../lib/utils'
import type { HistoryPoint } from '../../types'

type Tab = 'dashboard' | 'connections' | 'map' | 'history'

const TAB_META: Record<Tab, { label: string; sub: string; icon: React.ReactNode }> = {
  dashboard:   { label: 'Dashboard',   sub: 'Live telemetry',          icon: <Lucide.LayoutDashboard size={14} /> },
  connections: { label: 'Connections', sub: 'Active socket table',     icon: <Lucide.Network size={14} /> },
  map:         { label: 'Globe Map',   sub: 'Geo-IP visualisation',    icon: <Lucide.Globe2 size={14} /> },
  history:     { label: 'History',     sub: 'Stored traffic logs',     icon: <Lucide.BarChart2 size={14} /> },
}

interface HeaderProps {
  activeTab: Tab
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
  activeTab, alertIndicator, telemetryPaused, pauseCountdown,
  history, onExport, onOpenSettings, onTogglePause, onOpenCommandPalette,
}: HeaderProps) {
  const meta = TAB_META[activeTab]
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-[#080c14]/80 px-5 backdrop-blur-xl">
      {/* Left — breadcrumb */}
      <div className="flex items-center gap-2.5 text-sm">
        <span className="text-slate-500">{meta.icon}</span>
        <span className="text-slate-500">/</span>
        <span className="font-semibold text-white">{meta.label}</span>
        <span className="hidden sm:inline text-slate-500">—</span>
        <span className="hidden sm:inline text-xs text-slate-500">{meta.sub}</span>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-2">
        {alertIndicator && (
          <span className="hidden sm:flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 animate-pulse">
            <Lucide.Zap size={12} /> High usage
          </span>
        )}

        {/* Search / Cmd palette */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/5 pl-3 pr-2 py-1.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Lucide.Search size={13} />
          <span className="hidden md:inline">Search</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px]">⌘K</kbd>
        </button>

        {/* Pause */}
        <button
          onClick={onTogglePause}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            telemetryPaused
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
              : 'border-white/8 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          {telemetryPaused
            ? <><Lucide.Play size={12} />{formatCountdown(pauseCountdown)}</>
            : <><Lucide.Pause size={12} /><span className="hidden sm:inline">Pause</span></>}
        </button>

        {/* Ghost overlay */}
        <button
          onClick={() => { void window.desktop.toggleOverlay() }}
          className="rounded-lg border border-white/8 bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          title="Toggle Overlay"
        >
          <Lucide.Ghost size={14} />
        </button>

        {/* Export */}
        <button
          onClick={onExport}
          disabled={!history.length}
          className={`hidden sm:flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            history.length
              ? 'border-white/10 text-slate-300 hover:border-white/30 hover:bg-white/5'
              : 'cursor-not-allowed border-white/5 text-slate-600'
          }`}
        >
          <Lucide.Download size={12} /> Export
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-400 transition-all"
        >
          <Lucide.SlidersHorizontal size={12} />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </header>
  )
}
