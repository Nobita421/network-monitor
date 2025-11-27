import * as Lucide from 'lucide-react'
import { NetworkStat } from '../../types'
import { formatDuration } from '../../lib/utils'

interface SidebarProps {
    activeTab: 'dashboard' | 'connections' | 'map' | 'history'
    setActiveTab: (tab: 'dashboard' | 'connections' | 'map' | 'history') => void
    stats: NetworkStat | null
    elapsedSeconds: number
}

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Lucide.Activity, hint: 'Live' },
    { id: 'connections', label: 'Connections', icon: Lucide.List, hint: 'Deep Dive' },
    { id: 'map', label: 'Map', icon: Lucide.Globe, hint: 'Geo' },
    { id: 'history', label: 'History', icon: Lucide.History, hint: 'Logs' },
]

export function Sidebar({ activeTab, setActiveTab, stats, elapsedSeconds }: SidebarProps) {
    return (
        <aside className="hidden md:flex md:w-64 xl:w-72 flex-col border-r border-white/5 bg-slate-950/70 backdrop-blur">
            <div className="flex items-center gap-3 px-6 py-8 border-b border-white/5">
                <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 p-3">
                    <Lucide.Activity size={22} className="text-white" />
                </div>
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">NetMonitor</p>
                    <p className="text-xl font-semibold text-white">Pro v2</p>
                </div>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const active = activeTab === item.id
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as 'dashboard' | 'connections' | 'map' | 'history')}
                            className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${active
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
    )
}
