import { useRef, useEffect } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react'
import type { AlertLogEntry } from '../../types'

interface PulseTimelineProps {
  alertLog: AlertLogEntry[]
}

function severityColor(rate: string): 'red' | 'amber' | 'yellow' {
  const num = parseFloat(rate)
  if (num >= 50) return 'red'
  if (num >= 10) return 'amber'
  return 'yellow'
}

const SEVERITY = {
  red: {
    bubble: 'bg-rose-500/20 border-rose-500/60 shadow-[0_0_16px_rgba(239,68,68,0.5)]',
    dot: 'bg-rose-400',
    text: 'text-rose-300',
    label: 'Critical',
  },
  amber: {
    bubble: 'bg-amber-500/20 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.4)]',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    label: 'High',
  },
  yellow: {
    bubble: 'bg-yellow-500/10 border-yellow-500/40 shadow-[0_0_8px_rgba(234,179,8,0.3)]',
    dot: 'bg-yellow-400',
    text: 'text-yellow-200',
    label: 'Warning',
  },
}

export function PulseTimeline({ alertLog }: PulseTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // auto-scroll to latest on new alert
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [alertLog.length])

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-rose-400" />
          <p className="text-sm font-medium text-white">Anomaly Pulse Timeline</p>
        </div>
        <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs text-rose-300 border border-rose-500/20">
          {alertLog.length} event{alertLog.length !== 1 ? 's' : ''}
        </span>
      </div>

      {alertLog.length === 0 ? (
        <div className="flex h-24 items-center justify-center gap-2 text-sm text-slate-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          All clear — no anomalies detected
        </div>
      ) : (
        <>
          {/* Timeline track */}
          <div className="relative mb-3">
            {/* Horizontal rule */}
            <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            {/* Scrollable bubble row */}
            <div
              ref={scrollRef}
              className="flex gap-3 overflow-x-auto pb-1 pt-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
              style={{ scrollBehavior: 'smooth' }}
            >
              {alertLog.map((entry, i) => {
                const sev = severityColor(entry.rate)
                const s = SEVERITY[sev]
                return (
                  <div key={`${entry.time}-${i}`} className="group relative flex-shrink-0">
                    {/* Bubble */}
                    <div
                      className={`flex cursor-default flex-col items-center rounded-2xl border px-3 py-2 text-center transition-all duration-200 hover:scale-105 ${s.bubble}`}
                      style={{ minWidth: 80 }}
                    >
                      <span className={`mb-1 text-xs font-semibold uppercase tracking-wide ${s.text}`}>
                        {s.label}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-300">
                        {entry.direction === 'rx'
                          ? <ArrowDown size={10} className="text-emerald-400" />
                          : <ArrowUp size={10} className="text-sky-400" />}
                        {entry.rate}
                      </span>
                      <span className="mt-1 text-[10px] text-slate-500">{entry.time}</span>
                    </div>

                    {/* Connector dot on timeline */}
                    <div className={`mx-auto mt-1 h-2 w-2 rounded-full ${s.dot}`} />

                    {/* Tooltip on hover */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                      {entry.direction === 'rx' ? '⬇ Download' : '⬆ Upload'} spike at {entry.time}<br />
                      Rate: <span className={s.text}>{entry.rate}</span>
                    </div>
                  </div>
                )
              })}

              {/* Live pulse dot at the end */}
              <div className="flex flex-shrink-0 items-center px-2">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />Warning</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />High</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" />Critical</span>
            <span className="ml-auto flex items-center gap-1"><ArrowDown size={10} className="text-emerald-400" />Download &nbsp;<ArrowUp size={10} className="text-sky-400" />Upload</span>
          </div>
        </>
      )}
    </div>
  )
}
