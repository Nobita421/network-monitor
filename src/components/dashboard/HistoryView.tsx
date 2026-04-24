import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, type TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { BarChart2, Clock } from 'lucide-react'
import { db, type TrafficLog } from '../../lib/db'
import { getHistorySampleStep, type StoredHistoryRange } from '../../lib/network'
import { formatBytes } from '../../lib/utils'

const RANGES: StoredHistoryRange[] = ['1h', '24h', '7d']

export function HistoryView() {
  const [logs, setLogs]       = useState<TrafficLog[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange]     = useState<StoredHistoryRange>('1h')

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const now = Date.now()
        const offsets: Record<StoredHistoryRange, number> = {
          '1h': 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
        }
        const step = getHistorySampleStep(range)
        const sampled: TrafficLog[] = []
        let idx = 0
        await db.traffic_logs.where('timestamp').aboveOrEqual(now - offsets[range]).each(log => {
          if (idx % step === 0) sampled.push(log)
          idx++
        })
        setLogs(sampled)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    void fetch()
  }, [range])

  const fmtX  = (v: number) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const fmtTT = (v: string | number) => new Date(v).toLocaleString()
  const fmtVal: TooltipProps<ValueType, NameType>['formatter'] = v =>
    [formatBytes(typeof v === 'number' ? v : Number(v)), '']

  const peak = logs.reduce((m, l) => Math.max(m, l.rx, l.tx), 0)
  const avgRx = logs.length ? logs.reduce((s, l) => s + l.rx, 0) / logs.length : 0
  const avgTx = logs.length ? logs.reduce((s, l) => s + l.tx, 0) / logs.length : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/10">
            <BarChart2 size={16} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Traffic History</h2>
            <p className="text-xs text-slate-500">{logs.length} data points</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                range === r
                  ? 'bg-violet-500/20 text-violet-300 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >{r}</button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Peak Speed',    value: `${formatBytes(peak)}/s`,    color: 'rose',    icon: <BarChart2 size={13} /> },
            { label: 'Avg Download',  value: `${formatBytes(avgRx)}/s`,   color: 'emerald', icon: <Clock size={13} /> },
            { label: 'Avg Upload',    value: `${formatBytes(avgTx)}/s`,   color: 'sky',     icon: <Clock size={13} /> },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-white/5 bg-[#080c14]/60 p-3`}>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{s.label}</p>
              <p className="text-lg font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="rounded-2xl border border-white/5 bg-[#080c14]/60 p-5" style={{ height: 380 }}>
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
              <p className="text-sm">Loading history...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-500">
            <BarChart2 size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No data for this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={logs} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gRx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gTx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={fmtX}  stroke="#334155" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => formatBytes(Number(v))} stroke="#334155" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#0d1220', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                itemStyle={{ color: '#e2e8f0' }}
                labelFormatter={fmtTT}
                formatter={fmtVal}
              />
              <Area type="monotone" dataKey="rx" name="Download" stroke="#34d399" fill="url(#gRx)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="tx" name="Upload"   stroke="#38bdf8" fill="url(#gTx)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-emerald-400" /> Download</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-sky-400" /> Upload</span>
      </div>
    </div>
  )
}
