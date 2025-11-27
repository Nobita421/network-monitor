import { ConnectionTable } from './ConnectionTable'
import { Connection, NetworkStat, HistoryPoint, Settings } from '../../types'
import { formatBytes, formatCountdown } from '../../lib/utils'

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
    connections,
    stats,
    sessionUsage,
    telemetryPaused,
    handlePauseTelemetry,
    pauseCountdown,
    settings,
    handleExportHistory,
    history,
    lastExportTime,
}: ConnectionsViewProps) {
    return (
        <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-auto px-6 py-8 space-y-8">
                <ConnectionTable connections={connections} />
            </main>

            <aside className="hidden xl:block w-80 border-l border-white/5 bg-slate-950/70 px-6 py-8 backdrop-blur">
                <div className="space-y-6 text-sm">
                    <div className="rounded-3xl border border-white/5 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Interface</p>
                        <p className="text-lg font-semibold text-white">{stats?.iface || 'Detecting...'}</p>
                        <p className="text-slate-400">State: {stats?.operstate || 'Unknown'}</p>
                    </div>
                    <div className="rounded-3xl border border-white/5 bg-white/5 p-4 space-y-2">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Traffic blend</p>
                        <div className="flex gap-3 text-sm">
                            <div className="flex-1 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                                <p className="text-slate-200">Download</p>
                                <p className="text-2xl font-semibold text-white">{formatBytes(sessionUsage.rx)}</p>
                            </div>
                            <div className="flex-1 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3">
                                <p className="text-slate-200">Upload</p>
                                <p className="text-2xl font-semibold text-white">{formatBytes(sessionUsage.tx)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-3xl border border-white/5 bg-white/5 p-4 space-y-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Helper actions</p>
                        <button
                            onClick={handlePauseTelemetry}
                            className={`w-full rounded-2xl border px-4 py-2 text-left transition ${telemetryPaused
                                    ? 'border-amber-400/40 bg-amber-400/10 hover:border-amber-300/60'
                                    : 'border-white/10 hover:border-white/40'
                                }`}
                        >
                            <div className="text-sm font-semibold text-white">
                                {telemetryPaused ? 'Resume telemetry' : 'Pause telemetry'}
                            </div>
                            <p className="text-xs text-slate-400">
                                {telemetryPaused
                                    ? `Resume in ${formatCountdown(pauseCountdown)}`
                                    : `Suspend background polling for ${settings.pauseMinutes} minutes`}
                            </p>
                        </button>
                        <button
                            onClick={handleExportHistory}
                            disabled={!history.length}
                            className={`w-full rounded-2xl border px-4 py-2 text-left transition ${history.length ? 'border-white/10 hover:border-white/40' : 'border-white/5 text-slate-500'
                                }`}
                        >
                            <div className="text-sm font-semibold text-white">Export CSV</div>
                            <p className="text-xs text-slate-400">
                                {history.length ? lastExportTime ? `Last export ${lastExportTime}` : 'Dump current history to a file' : 'History buffer is empty'}
                            </p>
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    )
}
