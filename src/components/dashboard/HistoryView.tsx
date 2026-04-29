import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, type TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { BarChart2, Clock, TrendingDown, TrendingUp } from 'lucide-react'
import { db, type TrafficLog } from '../../lib/db'
import { getHistorySampleStep, type StoredHistoryRange } from '../../lib/network'
import { formatBytes } from '../../lib/utils'

const RANGES: StoredHistoryRange[] = ['1h', '24h', '7d']

const RANGE_LABELS: Record<StoredHistoryRange, string> = {
  '1h': '1 Hour',
  '24h': '24 Hours',
  '7d': '7 Days',
}

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

  const peak  = logs.reduce((m, l) => Math.max(m, l.rx, l.tx), 0)
  const avgRx = logs.length ? logs.reduce((s, l) => s + l.rx, 0) / logs.length : 0
  const avgTx = logs.length ? logs.reduce((s, l) => s + l.tx, 0) / logs.length : 0

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-violet-400/15 blur-lg" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10">
              <BarChart2 size={17} className="text-violet-400" />
            </div>
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-white leading-tight">Traffic History</h2>
            <p className="text-[11px] text-slate-600">{logs.length} data points · {RANGE_LABELS[range]}</p>
          </div>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-4 py-1.5 text-[11px] font-semibold transition-all duration-150 ${
                range === r
                  ? 'bg-violet-500/20 text-violet-300 shadow-sm'
                  : 'text-slate-600 hover:text-white hover:bg-white/[0.04]'
              }`}
            >{r}</button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Peak Speed',   value: `${formatBytes(peak)}/s`,   color: 'rose',    icon: <BarChart2 size={14} className="text-rose-400" />    },
            { label: 'Avg Download', value: `${formatBytes(avgRx)}/s`,  color: 'emerald', icon: <TrendingDown size={14} className="text-emerald-400" /> },
            { label: 'Avg Upload',   value: `${formatBytes(avgTx)}/s`,  color: 'sky',     icon: <TrendingUp size={14} className="text-sky-400" />    },
          ].map(s => {
            const colorMap: Record<string, string> = {
              rose: 'border-rose-400/15 bg-rose-400/[0.05] text-rose-300',
              emerald: 'border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300',
              sky: 'border-sky-400/15 bg-sky-400/[0.05] text-sky-300',
            }
            return (
              <div key={s.label} className={`rounded-xl border ${colorMap[s.color]} p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  {s.icon}
                  <p className="text-[9px] uppercase tracking-wider text-slate-600 font-semibold">{s.label}</p>
                </div>
                <p className="text-[20px] font-bold text-white font-data">{s.value}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Chart */}
      <div
        className="rounded-2xl border border-white/[0.06] overflow-hidden"
        style={{
          height: 380,
          background: 'linear-gradient(180deg, rgba(6,11,24,0.95) 0%, rgba(3,7,18,0.98) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400/20 border-t-violet-400" />
              <p className="text-[12px] text-slate-600">Loading history...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-400/[0.05]">
              <BarChart2 size={20} className="text-violet-600" />
            </div>
            <p className="text-[13px] font-medium text-slate-600">No data for this period</p>
            <p className="text-[11px] text-slate-700">Data accumulates as you monitor your network</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={logs} margin={{ top: 16, right: 20, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="histGRx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="histGTx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.025)" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={fmtX}
                stroke="transparent"
                tick={{ fontSize: 10, fill: '#334155' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={v => formatBytes(Number(v))}
                stroke="transparent"
                tick={{ fontSize: 10, fill: '#334155' }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                contentStyle={{
                  background: '#0a0f1e',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  fontSize: 11,
                  padding: '8px 12px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                }}
                itemStyle={{ color: '#cbd5e1', padding: '1px 0' }}
                labelStyle={{ color: '#64748b', marginBottom: 4 }}
                labelFormatter={fmtTT}
                formatter={fmtVal}
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="rx" name="Download" stroke="#34d399" fill="url(#histGRx)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="tx" name="Upload"   stroke="#38bdf8" fill="url(#histGTx)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      {!loading && logs.length > 0 && (
        <div className="flex items-center gap-5 px-1">
          <span className="flex items-center gap-2 text-[11px] text-slate-600">
            <span className="h-2 w-5 rounded-full bg-emerald-400/70" />
            Download
          </span>
          <span className="flex items-center gap-2 text-[11px] text-slate-600">
            <span className="h-2 w-5 rounded-full bg-sky-400/70" />
            Upload
          </span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-700">
            <Clock size={10} />
            Updated {new Date().toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  )
}
