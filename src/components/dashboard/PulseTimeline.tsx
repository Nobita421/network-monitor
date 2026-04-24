import { useEffect, useRef } from 'react'
import { AlertTriangle, Zap, ArrowDown, ArrowUp, Radio } from 'lucide-react'
import type { AlertLogEntry } from '../../types'

interface PulseTimelineProps {
  alertLog: AlertLogEntry[]
}

function severityConfig(msg: string) {
  const lower = msg.toLowerCase()
  if (lower.includes('critical') || lower.includes('extreme'))
    return { ring: 'border-rose-500/60',   bg: 'bg-rose-500/10',   dot: 'bg-rose-400',   text: 'text-rose-300',   label: 'Critical' }
  if (lower.includes('high') || lower.includes('spike'))
    return { ring: 'border-amber-500/60',  bg: 'bg-amber-500/10',  dot: 'bg-amber-400',  text: 'text-amber-300',  label: 'High' }
  return   { ring: 'border-yellow-500/50', bg: 'bg-yellow-500/8',  dot: 'bg-yellow-400', text: 'text-yellow-300', label: 'Warn' }
}

export function PulseTimeline({ alertLog }: PulseTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [alertLog.length])

  return (
    <div className="rounded-2xl border border-white/5 bg-[#080c14]/60 p-5 backdrop-blur">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10">
            <AlertTriangle size={13} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Anomaly Pulse Timeline</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Threshold breach events</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-400">
            {alertLog.length} event{alertLog.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {alertLog.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-600">
          <Radio size={22} className="mb-2 text-emerald-500/40" />
          <p className="text-sm text-emerald-600/60">All clear — no anomalies detected</p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {alertLog.map((entry, i) => {
            const s = severityConfig(entry.message)
            const isRx = entry.direction === 'rx'
            return (
              <div
                key={i}
                className={`group relative shrink-0 w-44 rounded-xl border ${s.ring} ${s.bg} p-3 transition-all hover:scale-105 cursor-default`}
              >
                {/* Severity dot */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${s.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                  <span className="text-slate-600">
                    {isRx ? <ArrowDown size={11} className="text-emerald-500" /> : <ArrowUp size={11} className="text-sky-500" />}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mb-1">{entry.time}</p>
                <p className={`text-xs font-semibold ${s.text} flex items-center gap-1`}>
                  <Zap size={10} /> {entry.message}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
