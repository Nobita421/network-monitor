import { useMemo, useState } from 'react'
import { Connection } from '../../types'
import { stateFilters } from '../../lib/constants'
import { Card } from '../ui/Card'
import * as Lucide from 'lucide-react'

interface ConnectionTableProps {
    connections: Connection[]
}

export function ConnectionTable({ connections }: ConnectionTableProps) {
    const [search, setSearch] = useState('')
    const [stateFilter, setStateFilter] = useState<'all' | 'ESTABLISHED' | 'LISTEN'>('all')

    const filteredConnections = useMemo(() => {
        const query = search.trim().toLowerCase()
        return connections.filter((conn) => {
            const matchesQuery =
                !query ||
                conn.process?.toLowerCase().includes(query) ||
                conn.localAddress.toLowerCase().includes(query) ||
                conn.peerAddress.toLowerCase().includes(query)
            const matchesState = stateFilter === 'all' || conn.state === stateFilter
            return matchesQuery && matchesState
        })
    }, [connections, search, stateFilter])

    return (
        <div className="space-y-6">
            <Card className="bg-white/5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-900/70 p-3">
                            <Lucide.ShieldCheck size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Live connections</p>
                            <p className="text-3xl font-semibold text-white">{filteredConnections.length}</p>
                        </div>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[220px]">
                            <Lucide.Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Filter by process or address"
                                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                            />
                        </div>
                        <div className="flex gap-2">
                            {stateFilters.map((filter) => (
                                <button
                                    key={filter.value}
                                    onClick={() => setStateFilter(filter.value as 'all' | 'ESTABLISHED' | 'LISTEN')}
                                    className={`rounded-2xl px-4 py-2 text-sm transition-colors ${stateFilter === filter.value
                                            ? 'bg-white text-slate-900'
                                            : 'bg-white/10 text-slate-400 hover:bg-white/20'
                                        }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            <div className="rounded-3xl border border-white/5 bg-slate-950/70 overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-300px)]">
                    <table className="w-full text-left text-sm text-slate-200">
                        <thead className="sticky top-0 bg-slate-900/95 backdrop-blur text-xs uppercase tracking-wide text-slate-400 z-10">
                            <tr>
                                <th className="px-5 py-3">Process</th>
                                <th className="px-5 py-3">Protocol</th>
                                <th className="px-5 py-3">Local</th>
                                <th className="px-5 py-3">Remote</th>
                                <th className="px-5 py-3">State</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredConnections.map((conn, index) => (
                                <tr key={`${conn.localAddress}-${conn.localPort}-${index}`} className="border-t border-white/5 text-sm hover:bg-white/5 transition-colors">
                                    <td className="px-5 py-4 font-medium text-white">{conn.process || 'System'}</td>
                                    <td className="px-5 py-4">{conn.protocol.toUpperCase()}</td>
                                    <td className="px-5 py-4 text-slate-300">
                                        {conn.localAddress}:{conn.localPort}
                                    </td>
                                    <td className="px-5 py-4 text-slate-300">
                                        {conn.peerAddress}:{conn.peerPort}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${conn.state === 'ESTABLISHED'
                                                    ? 'bg-emerald-400/20 text-emerald-200'
                                                    : conn.state === 'LISTEN'
                                                        ? 'bg-sky-400/20 text-sky-100'
                                                        : 'bg-white/10 text-slate-300'
                                                }`}
                                        >
                                            {conn.state}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredConnections.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                                        No connections match the current filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
