import { useMemo } from 'react'
import * as Lucide from 'lucide-react'
import { NetworkStat, HistoryPoint, ProcessUsageEntry, Settings, HistoryRange } from '../../types'
import { formatBytes } from '../../lib/utils'
import { chartWindow } from '../../lib/constants'
import { NetworkChart } from './NetworkChart'
import { ProcessList } from './ProcessList'
import { Card } from '../ui/Card'

interface DashboardViewProps {
    stats: NetworkStat | null
    maxSpikes: { rx: number; tx: number }
    sessionUsage: { rx: number; tx: number }
    settings: Settings
    history: HistoryPoint[]
    historyRange: HistoryRange
    setHistoryRange: (range: HistoryRange) => void
    processUsage: ProcessUsageEntry[]
    alertLog: { time: string; direction: 'rx' | 'tx'; rate: string }[]
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
            (acc, point) => {
                acc.rx += point.rx
                acc.tx += point.tx
                return acc
            },
            { rx: 0, tx: 0 }
        )
        return { rx: totals.rx / displayedHistory.length, tx: totals.tx / displayedHistory.length }
    }, [displayedHistory])

    return (
        <div className="space-y-8">
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

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-transparent p-5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-emerald-200">
                        Download now
                        <Lucide.ArrowDown size={16} />
                    </div>
                    <p className="mt-3 text-3xl font-semibold text-white">{stats ? `${formatBytes(stats.rx_sec)}/s` : '—'}</p>
                    <p className="text-sm text-emerald-100/80">Avg {formatBytes(averages.rx || 0)}/s</p>
                </div>
                <div className="rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 to-transparent p-5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-sky-200">
                        Upload now
                        <Lucide.ArrowUp size={16} />
                    </div>
                    <p className="mt-3 text-3xl font-semibold text-white">{stats ? `${formatBytes(stats.tx_sec)}/s` : '—'}</p>
                    <p className="text-sm text-sky-100/80">Avg {formatBytes(averages.tx || 0)}/s</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Session usage</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{formatBytes(sessionTotal)}</p>
                    <p className="text-sm text-slate-400">{formatBytes(sessionUsage.rx)} down · {formatBytes(sessionUsage.tx)} up</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Health score</p>
                    <p className="mt-3 text-4xl font-semibold text-lime-300">
                        {Math.max(
                            35,
                            100 - Math.round(((stats?.rx_sec || 0) + (stats?.tx_sec || 0)) / Math.max(settings.threshold, 1) * 100)
                        )}
                    </p>
                    <p className="text-sm text-slate-400">Based on current threshold</p>
                </div>
            </section>

            <NetworkChart history={history} range={historyRange} onRangeChange={setHistoryRange} />

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
                            <p>Notifications muted for {settings.cooldownMinutes} min cooldown.</p>
                            <p>Last alert: {alertLog[0]?.time || 'No alerts yet'}</p>
                        </div>
                    </div>
                    {alertLog.length > 0 && (
                        <ul className="mt-4 space-y-2 text-sm text-slate-300">
                            {alertLog.map((log, index) => (
                                <li key={`${log.time}-${index}`} className="flex items-center gap-2 text-xs text-slate-400">
                                    <span className={`h-2 w-2 rounded-full ${log.direction === 'rx' ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                                    Spike at {log.time} · {log.rate}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">Active connection preview</p>
                        {/* Note: Navigation to connections tab is handled by parent or sidebar, 
                but we can add a callback if needed. For now just text. */}
                        <span className="text-xs text-slate-500">See Connections tab</span>
                    </div>
                    <div className="mt-4 flex flex-col items-center justify-center h-40 text-slate-500 text-sm">
                        <Lucide.Network size={32} className="mb-2 opacity-50" />
                        <p>Switch to Connections tab for full details</p>
                    </div>
                </Card>
            </section>

            <ProcessList processes={processUsage} />
        </div>
    )
}
