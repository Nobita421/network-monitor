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
  { id: 'dashboard' as Tab, label: 'Dashboard', icon: Lucide.LayoutDashboard, hint: 'Live', color: 'sky' },
  { id: 'connections' as Tab, label: 'Connections', icon: Lucide.Network, hint: 'Deep Dive', color: 'emerald' },
  { id: 'map' as Tab, label: 'Globe Map', icon: Lucide.Globe2, hint: 'Geo', color: 'violet' },
  { id: 'history' as Tab, label: 'History', icon: Lucide.BarChart2, hint: 'Logs', color: 'amber' },
] as const

const ACTIVE_STYLES: Record<string, string> = {
  sky:    'border-sky-400/60 bg-sky-400/10 text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.15)]',
  emerald:'border-emerald-400/60 bg-emerald-400/10 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.15)]',
  violet: 'border-violet-400/60 bg-violet-400/10 text-violet-300 shadow-[0_0_20px_rgba(167,139,250,0.15)]',
  amber:  'border-amber-400/60 bg-amber-400/10 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.15)]',
}

const DOT: Record<string, string> = {
  sky: 'bg-sky-400', emerald: 'bg-emerald-400', violet: 'bg-violet-400', amber: 'bg-amber-400',
}

export function Sidebar({ activeTab, setActiveTab, stats, elapsedSeconds }: SidebarProps) {
  const isUp = stats?.operstate === 'up'
  return (
    <aside className="hidden md:flex flex-col w-64 xl:w-72 border-r border-white/5 bg-[#080c14]/90 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/5">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-sky-500/30 blur-md" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500">
            <Lucide.Wifi size={18} className="text-white" />
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">NetMonitor</p>
          <p className="text-lg font-bold tracking-tight text-white">Pro <span className="text-sky-400">v2</span></p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1.5">
        {NAV.map(({ id, label, icon: Icon, hint, color }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`group relative flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200 ${
                active
                  ? ACTIVE_STYLES[color]
                  : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white'
              }`}
            >
              {active && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full ${DOT[color]}`} />}
              <Icon size={17} />
              <span className="flex-1 text-left">{label}</span>
              <span className={`text-[10px] uppercase tracking-wider ${ active ? 'opacity-80' : 'opacity-40'}`}>{hint}</span>
            </button>
          )
        })}
      </nav>

      {/* Status bar */}
      <div className="mx-3 mb-4 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-slate-500">Network Status</span>
          <span className={`flex items-center gap-1.5 text-[10px] font-semibold ${ isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${ isUp ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isUp ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div>
            <p className="text-slate-600">Interface</p>
            <p className="text-slate-200 font-medium truncate">{stats?.iface || '--'}</p>
          </div>
          <div>
            <p className="text-slate-600">Session</p>
            <p className="text-slate-200 font-medium">{formatDuration(elapsedSeconds)}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
