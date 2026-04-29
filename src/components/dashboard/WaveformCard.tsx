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
  sky:     { stroke: '#38bdf8', glow: 'rgba(56,189,248,0.25)',   fill: 'rgba(56,189,248,0.08)',   border: 'rgba(56,189,248,0.18)',   badge: 'bg-sky-400/15 text-sky-300',     label: 'text-sky-400',     shadow: '0 0 30px rgba(56,189,248,0.12)'    },
  emerald: { stroke: '#34d399', glow: 'rgba(52,211,153,0.25)',   fill: 'rgba(52,211,153,0.08)',   border: 'rgba(52,211,153,0.18)',   badge: 'bg-emerald-400/15 text-emerald-300', label: 'text-emerald-400', shadow: '0 0 30px rgba(52,211,153,0.12)'    },
  violet:  { stroke: '#a78bfa', glow: 'rgba(167,139,250,0.25)',  fill: 'rgba(167,139,250,0.08)',  border: 'rgba(167,139,250,0.18)',  badge: 'bg-violet-400/15 text-violet-300',  label: 'text-violet-400',  shadow: '0 0 30px rgba(167,139,250,0.12)'   },
  amber:   { stroke: '#fbbf24', glow: 'rgba(251,191,36,0.25)',   fill: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.18)',   badge: 'bg-amber-400/15 text-amber-300',   label: 'text-amber-400',   shadow: '0 0 30px rgba(251,191,36,0.12)'    },
  rose:    { stroke: '#fb7185', glow: 'rgba(251,113,133,0.25)',  fill: 'rgba(251,113,133,0.08)',  border: 'rgba(251,113,133,0.18)',  badge: 'bg-rose-400/15 text-rose-300',     label: 'text-rose-400',    shadow: '0 0 30px rgba(251,113,133,0.12)'   },
}

function sparkline(vals: number[], W: number, H: number) {
  if (vals.length < 2) return { line: '', fill: '' }
  const max = Math.max(...vals, 1)
  const step = W / (vals.length - 1)
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${(H - (v / max) * H * 0.85).toFixed(1)}`)
  const line = 'M ' + pts.join(' L ')
  return { line, fill: `${line} L ${W},${H} L 0,${H} Z` }
}

export function WaveformCard({ label, value, subLabel, history, color, icon, threshold }: WaveformCardProps) {
  const c = C[color]
  const W = 260; const H = 60

  const { line, fill } = useMemo(() => sparkline(history, W, H), [history])

  const glowIntensity = useMemo(() => {
    if (!threshold || !history.length) return 0.5
    const latest = history[history.length - 1] ?? 0
    return Math.min(latest / Math.max(threshold, 1), 1)
  }, [history, threshold])

  return (
    <div
      className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 cursor-default"
      style={{
        background: `linear-gradient(145deg, ${c.fill} 0%, rgba(6,11,24,0.9) 100%)`,
        border: `1px solid ${c.border}`,
        boxShadow: `${c.shadow}, inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)`,
      }}
    >
      {/* Waveform bg */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-70 transition-opacity duration-300 group-hover:opacity-90">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} aria-hidden>
          <defs>
            <linearGradient id={`wg-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={c.stroke} stopOpacity={0.4 + glowIntensity * 0.2} />
              <stop offset="100%" stopColor={c.stroke} stopOpacity={0} />
            </linearGradient>
            <filter id={`blur-${color}`}>
              <feGaussianBlur stdDeviation="1" />
            </filter>
          </defs>
          {fill && <path d={fill} fill={`url(#wg-${color})`} />}
          {/* Glow line */}
          {line && <path d={line} fill="none" stroke={c.stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.3} filter={`url(#blur-${color})`} />}
          {/* Sharp line on top */}
          {line && <path d={line} fill="none" stroke={c.stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      </div>

      {/* Top row */}
      <div className="relative z-10 flex items-start justify-between mb-3">
        <span className={`text-[9px] uppercase tracking-[0.2em] font-bold ${c.label}`}>{label}</span>
        <span className={`flex items-center justify-center rounded-lg p-1.5 ${c.badge}`}>{icon}</span>
      </div>

      {/* Value */}
      <p className="relative z-10 text-[26px] font-bold tracking-tight text-white leading-none font-data">{value}</p>
      <p className="relative z-10 mt-1.5 text-[11px] text-slate-600">{subLabel}</p>

      {/* Hover shimmer overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at 80% 20%, ${c.glow.replace('0.25', '0.08')}, transparent 60%)` }}
      />
    </div>
  )
}
