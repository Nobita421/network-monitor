import { memo, useMemo, useState } from 'react'
import type { Connection } from '../../types'
import { stateFilters } from '../../lib/constants'
import * as Lucide from 'lucide-react'

interface ConnectionTableProps {
    connections: Connection[]
}

const PAGE_SIZE = 100

export const ConnectionTable = memo(function ConnectionTable({ connections }: ConnectionTableProps) {
    const [search, setSearch] = useState('')
    const [stateFilter, setStateFilter] = useState<'all' | 'ESTABLISHED' | 'LISTEN'>('all')
    const [page, setPage] = useState(1)

    const filteredConnections = useMemo(() => {
        const query = search.trim().toLowerCase()
        return connections.filter((conn) => {
            const matchesQuery =
                !query ||
                conn.process?.toLowerCase().includes(query) ||
                (conn.localAddress || '').toLowerCase().includes(query) ||
                (conn.peerAddress || '').toLowerCase().includes(query)
            const matchesState = stateFilter === 'all' || conn.state === stateFilter
            return matchesQuery && matchesState
        })
    }, [connections, search, stateFilter])

    const totalPages = Math.max(1, Math.ceil(filteredConnections.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)

    const pagedConnections = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE
        return filteredConnections.slice(start, start + PAGE_SIZE)
    }, [filteredConnections, currentPage])

    const resetToFirstPage = () => { setPage(1) }

    return (
        <div className="space-y-4">
            {/* Controls bar */}
            <div
                className="rounded-2xl border border-white/[0.06] p-4"
                style={{ background: 'linear-gradient(135deg, rgba(6,11,24,0.95) 0%, rgba(3,7,18,0.98) 100%)' }}
            >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    {/* Count badge */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06]">
                            <Lucide.ShieldCheck size={16} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-600 uppercase tracking-wider">Live connections</p>
                            <p className="text-2xl font-bold text-white font-data leading-tight">{filteredConnections.length}</p>
                        </div>
                    </div>

                    <div className="flex flex-1 flex-wrap gap-2">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Lucide.Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={13} />
                            <input
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value)
                                    resetToFirstPage()
                                }}
                                placeholder="Filter by process or address..."
                                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] py-2 pl-9 pr-4 text-[12px] text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-sky-500/40 focus:bg-white/[0.05] transition-all duration-150"
                            />
                        </div>

                        {/* Filter pills */}
                        <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                            {stateFilters.map((filter) => (
                                <button
                                    key={filter.value}
                                    onClick={() => {
                                        setStateFilter(filter.value as 'all' | 'ESTABLISHED' | 'LISTEN')
                                        resetToFirstPage()
                                    }}
                                    className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition-all duration-150 ${
                                        stateFilter === filter.value
                                            ? 'bg-white/10 text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-300 hover:bg-white/[0.04]'
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden"
                style={{ background: 'rgba(6,11,24,0.9)' }}
            >
                <div className="overflow-auto max-h-[calc(100vh-320px)]">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 border-b border-white/[0.06]"
                            style={{ background: 'rgba(6,11,24,0.98)' }}
                        >
                            <tr>
                                {['Process', 'Proto', 'Local', 'Remote', 'State'].map(col => (
                                    <th key={col} className="px-5 py-3 text-[9px] uppercase tracking-[0.2em] text-slate-700 font-semibold">
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pagedConnections.map((conn) => (
                                <tr
                                    key={`${conn.pid}-${conn.protocol}-${conn.localAddress}-${conn.localPort}-${conn.peerAddress}-${conn.peerPort}`}
                                    className="border-t border-white/[0.025] text-sm hover:bg-white/[0.025] transition-colors duration-100"
                                >
                                    <td className="px-5 py-3">
                                        <span className="font-medium text-[12px] text-slate-200">{conn.process || 'System'}</span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] font-bold text-slate-500 font-data">
                                            {conn.protocol.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-[11px] text-slate-500 font-data">
                                        {conn.localAddress}:{conn.localPort}
                                    </td>
                                    <td className="px-5 py-3 text-[11px] text-slate-500 font-data">
                                        {conn.peerAddress}:{conn.peerPort}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                            conn.state === 'ESTABLISHED'
                                                ? 'border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300'
                                                : conn.state === 'LISTEN'
                                                    ? 'border border-sky-400/20 bg-sky-400/[0.08] text-sky-300'
                                                    : 'border border-white/[0.06] bg-white/[0.04] text-slate-400'
                                        }`}>
                                            <span className={`h-1 w-1 rounded-full ${
                                                conn.state === 'ESTABLISHED' ? 'bg-emerald-400' : conn.state === 'LISTEN' ? 'bg-sky-400' : 'bg-slate-500'
                                            }`} />
                                            {conn.state}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {pagedConnections.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-10 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Lucide.SearchX size={20} className="text-slate-700" />
                                            <p className="text-[13px] text-slate-600">No connections match the current filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-white/[0.04] px-5 py-3 text-[11px] text-slate-600">
                        <span>
                            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredConnections.length)} of {filteredConnections.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((c) => Math.max(1, c - 1))}
                                disabled={currentPage === 1}
                                className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 transition-all"
                            >
                                Prev
                            </button>
                            <span className="text-slate-600 font-data">{currentPage} / {totalPages}</span>
                            <button
                                onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
                                disabled={currentPage === totalPages}
                                className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 transition-all"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
})
