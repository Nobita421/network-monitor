import { useEffect, useRef } from 'react'
import { AlertTriangle, Zap, ArrowDown, ArrowUp, ShieldCheck } from 'lucide-react'
import type { AlertLogEntry } from '../../types'

interface PulseTimelineProps {
  alertLog: AlertLogEntry[]
}

function severityConfig(rate: string) {
  const num = parseFloat(rate)
  if (num >= 50e6)
    return {
      ring: 'border-rose-500/30',
      bg: 'bg-rose-500/[0.07]',
      dot: 'bg-rose-400',
      text: 'text-rose-300',
      label: 'Critical',
      icon: <AlertTriangle size={10} className="text-rose-400" />,
      glow: 'shadow-rose-500/10',
    }
  if (num >= 10e6)
    return {
      ring: 'border-amber-500/30',
      bg: 'bg-amber-500/[0.07]',
      dot: 'bg-amber-400',
      text: 'text-amber-300',
      label: 'High',
      icon: <Zap size={10} className="text-amber-400" />,
      glow: 'shadow-amber-500/10',
    }
  return {
    ring: 'border-yellow-500/25',
    bg: 'bg-yellow-500/[0.05]',
    dot: 'bg-yellow-400',
    text: 'text-yellow-300',
    label: 'Warn',
    icon: <Zap size={10} className="text-yellow-400" />,
    glow: 'shadow-yellow-500/10',
  }
}

export function PulseTimeline({ alertLog }: PulseTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [alertLog.length])

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#060b18]/80 p-5 backdrop-blur">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10">
            <AlertTriangle size={12} className="text-amber-400" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white leading-tight">Anomaly Timeline</p>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">Threshold breach events</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live
          </span>
          <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-500 font-medium">
            {alertLog.length} event{alertLog.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {alertLog.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06]">
            <ShieldCheck size={18} className="text-emerald-500" />
          </div>
          <p className="text-[13px] font-medium text-emerald-500/60">All clear</p>
          <p className="text-[11px] text-slate-700">No anomalies detected</p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {alertLog.map((entry, i) => {
            const s = severityConfig(entry.rate)
            const isRx = entry.direction === 'rx'
            return (
              <div
                key={i}
                className={`group relative shrink-0 w-40 rounded-xl border ${s.ring} ${s.bg} p-3 transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 cursor-default shadow-lg ${s.glow}`}
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${s.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot} shrink-0`} />
                    {s.label}
                  </span>
                  <span className="text-slate-600">
                    {isRx
                      ? <ArrowDown size={10} className="text-emerald-500" />
                      : <ArrowUp   size={10} className="text-sky-500" />}
                  </span>
                </div>

                <p className="text-[10px] text-slate-600 mb-1.5 font-data">{entry.time}</p>

                <p className={`text-[12px] font-bold ${s.text} flex items-center gap-1 font-data`}>
                  <Zap size={9} />
                  {entry.rate}
                </p>

                {/* Direction label */}
                <p className="text-[9px] text-slate-700 mt-1 uppercase tracking-wider">
                  {isRx ? 'inbound' : 'outbound'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
