import { memo, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { HistoryPoint, HistoryRange } from '../../types'
import { formatBytes } from '../../lib/utils'
import { chartWindow, rangeOptions } from '../../lib/constants'
import * as Lucide from 'lucide-react'

interface NetworkChartProps {
    history: HistoryPoint[]
    range: HistoryRange
    onRangeChange: (range: HistoryRange) => void
}

export const NetworkChart = memo(function NetworkChart({ history, range, onRangeChange }: NetworkChartProps) {
    const displayedHistory = useMemo(() => {
        const limit = chartWindow[range]
        return history.slice(-limit)
    }, [history, range])

    return (
        <div
            className="rounded-2xl border border-white/[0.06] overflow-hidden"
            style={{
                background: 'linear-gradient(180deg, rgba(6,11,24,0.95) 0%, rgba(3,7,18,0.98) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-4 justify-between px-5 py-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-400/20 bg-indigo-400/10">
                        <Lucide.Activity size={13} className="text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-white leading-tight">Rolling Telemetry</p>
                        <p className="text-[10px] text-slate-600">Network traffic history</p>
                    </div>
                </div>

                {/* Legend + range pills */}
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-3 text-[10px] text-slate-600">
                        <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-4 rounded-full bg-emerald-400 opacity-70" />
                            Download
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-4 rounded-full bg-sky-400 opacity-70" />
                            Upload
                        </span>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                        {rangeOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => { onRangeChange(option.value) }}
                                className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition-all duration-150 ${
                                    range === option.value
                                        ? 'bg-white/10 text-white shadow-sm'
                                        : 'text-slate-600 hover:text-slate-300 hover:bg-white/[0.04]'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="h-72 px-2 py-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displayedHistory} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id="gRxChart" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gTxChart" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="0"
                            stroke="rgba(255,255,255,0.03)"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="time"
                            stroke="transparent"
                            tick={{ fontSize: 10, fill: '#334155' }}
                            interval={Math.max(1, Math.floor(displayedHistory.length / 5))}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="transparent"
                            tickFormatter={(value: number) => formatBytes(value)}
                            tick={{ fontSize: 10, fill: '#334155' }}
                            tickLine={false}
                            axisLine={false}
                            width={70}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#0a0f1e',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 12,
                                fontSize: 11,
                                padding: '8px 12px',
                                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                            }}
                            itemStyle={{ color: '#cbd5e1', padding: '1px 0' }}
                            labelStyle={{ color: '#64748b', marginBottom: 4 }}
                            formatter={(value: number) => [`${formatBytes(value)}/s`, '']}
                            isAnimationActive={false}
                            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="rx"
                            stroke="#34d399"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#gRxChart)"
                            name="Download"
                            isAnimationActive={false}
                            dot={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="tx"
                            stroke="#38bdf8"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#gTxChart)"
                            name="Upload"
                            isAnimationActive={false}
                            dot={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
})
