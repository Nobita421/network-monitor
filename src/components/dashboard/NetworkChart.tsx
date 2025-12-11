import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { HistoryPoint, HistoryRange } from '../../types'
import { formatBytes } from '../../lib/utils'
import { chartWindow, rangeOptions } from '../../lib/constants'
import { Card } from '../ui/Card'

interface NetworkChartProps {
    history: HistoryPoint[]
    range: HistoryRange
    onRangeChange: (range: HistoryRange) => void
}

export function NetworkChart({ history, range, onRangeChange }: NetworkChartProps) {
    const displayedHistory = useMemo(() => {
        const limit = chartWindow[range]
        return history.slice(-limit)
    }, [history, range])

    return (
        <Card className="bg-slate-950/60">
            <div className="mb-4 flex flex-wrap items-center gap-4 justify-between">
                <div>
                    <p className="text-sm text-slate-400">Network traffic history</p>
                    <p className="text-xl font-semibold text-white">Rolling telemetry</p>
                </div>
                <div className="flex gap-2">
                    {rangeOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => { onRangeChange(option.value) }}
                            className={`rounded-full px-4 py-1 text-sm transition-colors ${range === option.value
                                ? 'bg-white text-slate-900'
                                : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displayedHistory}>
                        <defs>
                            <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis
                            dataKey="time"
                            stroke="#94a3b8"
                            tick={{ fontSize: 12 }}
                            interval={Math.max(1, Math.floor(displayedHistory.length / 6))}
                        />
                        <YAxis stroke="#94a3b8" tickFormatter={(value: number) => formatBytes(value)} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                            formatter={(value: number) => [`${formatBytes(value)}/s`, 'Speed']}
                            isAnimationActive={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="rx"
                            stroke="#22c55e"
                            fillOpacity={1}
                            fill="url(#colorRx)"
                            name="Download"
                            isAnimationActive={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="tx"
                            stroke="#38bdf8"
                            fillOpacity={1}
                            fill="url(#colorTx)"
                            name="Upload"
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    )
}
