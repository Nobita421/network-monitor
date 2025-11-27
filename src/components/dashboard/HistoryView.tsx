import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card } from '../ui/Card'
import { History as HistoryIcon } from 'lucide-react'
import { db, TrafficLog } from '../../lib/db'
import { formatBytes } from '../../lib/utils'

export function HistoryView() {
    const [logs, setLogs] = useState<TrafficLog[]>([])
    const [loading, setLoading] = useState(true)
    const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('1h')

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true)
            try {
                const now = Date.now()
                let startTime = now

                switch (timeRange) {
                    case '1h': startTime = now - 60 * 60 * 1000; break;
                    case '24h': startTime = now - 24 * 60 * 60 * 1000; break;
                    case '7d': startTime = now - 7 * 24 * 60 * 60 * 1000; break;
                }

                const data = await db.traffic_logs
                    .where('timestamp')
                    .above(startTime)
                    .toArray()

                // Downsample if too many points (simple approach)
                const downsampled = data.filter((_, i) => i % (timeRange === '1h' ? 1 : timeRange === '24h' ? 60 : 300) === 0)

                setLogs(downsampled)
            } catch (error) {
                console.error('Failed to fetch history:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchHistory()
    }, [timeRange])

    const formatXAxis = (tick: number) => {
        return new Date(tick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <HistoryIcon className="text-purple-400" />
                    Traffic History
                </h2>
                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                    {(['1h', '24h', '7d'] as const).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${timeRange === range
                                ? 'bg-purple-500/20 text-purple-300 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            <Card className="h-[400px]">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-slate-400">Loading history...</div>
                ) : logs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400">No data available for this period</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={logs}>
                            <defs>
                                <linearGradient id="colorRxHistory" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorTxHistory" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis
                                dataKey="timestamp"
                                tickFormatter={formatXAxis}
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tickFormatter={(val) => formatBytes(val)}
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                                itemStyle={{ color: '#e2e8f0' }}
                                labelFormatter={(label) => new Date(label).toLocaleString()}
                                formatter={(value: number) => [formatBytes(value), '']}
                            />
                            <Area
                                type="monotone"
                                dataKey="rx"
                                name="Download"
                                stroke="#10b981"
                                fillOpacity={1}
                                fill="url(#colorRxHistory)"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="tx"
                                name="Upload"
                                stroke="#3b82f6"
                                fillOpacity={1}
                                fill="url(#colorTxHistory)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </Card>
        </div>
    )
}
