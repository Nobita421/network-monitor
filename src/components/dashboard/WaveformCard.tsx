import { useMemo } from 'react'
import type { ReactNode } from 'react'

interface WaveformCardProps {
  label: string
  value: string
  subLabel: string
  history: number[]
  color: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose'
  icon: ReactNode
  threshold?: number
  accent?: boolean
}

const C = {
  sky:     { stroke: '#38bdf8', glow: '#38bdf8', fill: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.25)',  badge: 'bg-sky-400/15 text-sky-300',     label: 'text-sky-400' },
  emerald: { stroke: '#34d399', glow: '#34d399', fill: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)',  badge: 'bg-emerald-400/15 text-emerald-300', label: 'text-emerald-400' },
  violet:  { stroke: '#a78bfa', glow: '#a78bfa', fill: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)', badge: 'bg-violet-400/15 text-violet-300',  label: 'text-violet-400' },
  amber:   { stroke: '#fbbf24', glow: '#fbbf24', fill: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)',  badge: 'bg-amber-400/15 text-amber-300',   label: 'text-amber-400' },
  rose:    { stroke: '#fb7185', glow: '#fb7185', fill: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.25)', badge: 'bg-rose-400/15 text-rose-300',     label: 'text-rose-400' },
}

function sparkline(vals: number[], W: number, H: number) {
  if (vals.length < 2) return { line: '', fill: '' }
  const max = Math.max(...vals, 1)
  const step = W / (vals.length - 1)
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${(H - (v / max) * H * 0.88).toFixed(1)}`)
  const line = 'M ' + pts.join(' L ')
  return { line, fill: `${line} L ${W},${H} L 0,${H} Z` }
}

export function WaveformCard({ label, value, subLabel, history, color, icon, threshold }: WaveformCardProps) {
  const c = C[color]
  const W = 240; const H = 56

  const { line, fill } = useMemo(() => sparkline(history, W, H), [history])

  const glowPx = useMemo(() => {
    if (!threshold || !history.length) return 8
    const latest = history[history.length - 1] ?? 0
    return Math.round(8 + Math.min(latest / Math.max(threshold, 1), 1) * 28)
  }, [history, threshold])

  return (
    <div
      className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] cursor-default"
      style={{
        background: `linear-gradient(145deg, ${c.fill} 0%, rgba(8,12,20,0.85) 100%)`,
        border: `1px solid ${c.border}`,
        boxShadow: `0 0 ${glowPx}px ${c.glow}40, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {/* Animated waveform bg */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-60">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} aria-hidden>
          <defs>
            <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={c.stroke} stopOpacity={0.5} />
              <stop offset="100%" stopColor={c.stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          {fill && <path d={fill} fill={`url(#g-${color})`} />}
          {line && <path d={line} fill="none" stroke={c.stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      </div>

      {/* Top row */}
      <div className="relative z-10 flex items-start justify-between">
        <span className={`text-[10px] uppercase tracking-[0.15em] font-semibold ${c.label}`}>{label}</span>
        <span className={`flex items-center justify-center rounded-lg p-1.5 ${c.badge}`}>{icon}</span>
      </div>

      {/* Value */}
      <p className="relative z-10 mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
      <p className="relative z-10 mt-0.5 text-xs text-slate-500">{subLabel}</p>

      {/* Hover shimmer */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at 70% 50%, ${c.glow}10, transparent 60%)` }} />
    </div>
  )
}
