import * as Lucide from 'lucide-react'
import type { NetworkStat } from '../../types'
import { formatDuration } from '../../lib/utils'

type Tab = 'dashboard' | 'connections' | 'map' | 'history'

interface SidebarProps {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  stats: NetworkStat | null
  elapsedSeconds: number
}

const NAV = [
  { id: 'dashboard' as Tab, label: 'Dashboard',   icon: Lucide.LayoutDashboard, hint: 'Live',     color: 'sky'     },
  { id: 'connections' as Tab, label: 'Connections', icon: Lucide.Network,         hint: 'Sockets',  color: 'emerald' },
  { id: 'map' as Tab,         label: 'Globe Map',   icon: Lucide.Globe2,          hint: 'Geo IP',   color: 'violet'  },
  { id: 'history' as Tab,     label: 'History',     icon: Lucide.BarChart2,       hint: 'Logs',     color: 'amber'   },
] as const

const COLOR_MAP = {
  sky:     { active: 'text-sky-300',     glow: 'shadow-sky-400/20',     bar: 'bg-sky-400',     bg: 'bg-sky-400/10',     ring: 'border-sky-400/30',     dot: 'bg-sky-400'     },
  emerald: { active: 'text-emerald-300', glow: 'shadow-emerald-400/20', bar: 'bg-emerald-400', bg: 'bg-emerald-400/10', ring: 'border-emerald-400/30', dot: 'bg-emerald-400' },
  violet:  { active: 'text-violet-300',  glow: 'shadow-violet-400/20',  bar: 'bg-violet-400',  bg: 'bg-violet-400/10',  ring: 'border-violet-400/30',  dot: 'bg-violet-400'  },
  amber:   { active: 'text-amber-300',   glow: 'shadow-amber-400/20',   bar: 'bg-amber-400',   bg: 'bg-amber-400/10',   ring: 'border-amber-400/30',   dot: 'bg-amber-400'   },
}

export function Sidebar({ activeTab, setActiveTab, stats, elapsedSeconds }: SidebarProps) {
  const isUp = stats?.operstate === 'up'

  return (
    <aside className="hidden md:flex flex-col w-60 xl:w-64 border-r border-white/[0.06] bg-[#060b18]/95 backdrop-blur-2xl">

      {/* ── Logo ── */}
      <div className="flex items-center gap-3.5 px-5 py-5 border-b border-white/[0.06]">
        <div className="relative shrink-0">
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-xl bg-sky-400/25 blur-lg animate-glow-pulse" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-sky-500 to-indigo-600 shadow-lg shadow-sky-500/30">
            <Lucide.Wifi size={16} className="text-white" strokeWidth={2.5} />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.35em] text-slate-600 font-medium">NetMonitor</p>
          <p className="text-sm font-bold tracking-tight text-white leading-tight">
            Pro <span className="text-sky-400 font-extrabold">v2</span>
          </p>
        </div>
        {/* Live indicator */}
        <div className="ml-auto flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        </div>
      </div>

      {/* ── Section label ── */}
      <div className="px-4 pt-5 pb-2">
        <p className="text-[9px] uppercase tracking-[0.3em] text-slate-600 font-semibold px-2">Navigation</p>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map(({ id, label, icon: Icon, color }) => {
          const active = activeTab === id
          const c = COLOR_MAP[color]
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? `${c.bg} border border-white/[0.08] ${c.active} shadow-md ${c.glow}`
                  : 'border border-transparent text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {/* Active left bar */}
              {active && (
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full ${c.bar} shadow-sm`}
                />
              )}

              <Icon
                size={16}
                className={`shrink-0 transition-colors ${active ? c.active : 'text-slate-500 group-hover:text-slate-300'}`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="flex-1 text-left text-[13px]">{label}</span>

              {active && (
                <span className={`text-[9px] uppercase tracking-wider font-semibold opacity-60 ${c.active}`}>
                  ●
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Network Status card ── */}
      <div className="mx-3 mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {/* Status bar top */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
          <span className="text-[9px] uppercase tracking-[0.25em] text-slate-600 font-semibold">Network</span>
          <span className={`flex items-center gap-1.5 text-[10px] font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isUp ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isUp ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-px bg-white/[0.03]">
          <div className="bg-[#060b18] px-4 py-2.5">
            <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">Interface</p>
            <p className="text-xs text-slate-200 font-semibold font-data truncate">{stats?.iface || '--'}</p>
          </div>
          <div className="bg-[#060b18] px-4 py-2.5">
            <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">Session</p>
            <p className="text-xs text-slate-200 font-semibold font-data">{formatDuration(elapsedSeconds)}</p>
          </div>
        </div>
      </div>

      {/* ── Version footer ── */}
      <div className="px-5 pb-4">
        <p className="text-[9px] text-slate-700 text-center">
          NetMonitor Pro · Electron
        </p>
      </div>
    </aside>
  )
}
