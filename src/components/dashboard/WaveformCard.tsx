import { useMemo } from 'react'
import type { ReactNode } from 'react'

interface WaveformCardProps {
  label: string
  value: string
  subLabel: string
  history: number[]        // last N raw values
  color: 'emerald' | 'sky' | 'slate' | 'lime'
  icon: ReactNode
  threshold?: number       // optional — drives glow intensity
}

const COLOR_MAP = {
  emerald: {
    stroke: '#22c55e',
    fill: 'rgba(34,197,94,0.15)',
    border: 'rgba(34,197,94,0.35)',
    glow: 'rgba(34,197,94,0.25)',
    text: 'text-emerald-300',
    sub: 'text-emerald-100/70',
    label: 'text-emerald-200',
  },
  sky: {
    stroke: '#38bdf8',
    fill: 'rgba(56,189,248,0.15)',
    border: 'rgba(56,189,248,0.35)',
    glow: 'rgba(56,189,248,0.25)',
    text: 'text-sky-300',
    sub: 'text-sky-100/70',
    label: 'text-sky-200',
  },
  slate: {
    stroke: '#94a3b8',
    fill: 'rgba(148,163,184,0.1)',
    border: 'rgba(255,255,255,0.1)',
    glow: 'rgba(148,163,184,0.1)',
    text: 'text-white',
    sub: 'text-slate-400',
    label: 'text-slate-400',
  },
  lime: {
    stroke: '#a3e635',
    fill: 'rgba(163,230,53,0.15)',
    border: 'rgba(163,230,53,0.35)',
    glow: 'rgba(163,230,53,0.25)',
    text: 'text-lime-300',
    sub: 'text-lime-100/70',
    label: 'text-lime-200',
  },
}

function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length < 2) return ''
  const max = Math.max(...values, 1)
  const step = width / (values.length - 1)
  const points = values.map((v, i) => {
    const x = i * step
    const y = height - (v / max) * height * 0.85
    return `${x},${y}`
  })
  return 'M ' + points.join(' L ')
}

function buildFillPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return ''
  const line = buildSparklinePath(values, width, height)
  return `${line} L ${width},${height} L 0,${height} Z`
}

export function WaveformCard({
  label,
  value,
  subLabel,
  history,
  color,
  icon,
  threshold,
}: WaveformCardProps) {
  const c = COLOR_MAP[color]

  // glow intensity based on current value vs threshold
  const glowIntensity = useMemo(() => {
    if (!threshold || history.length === 0) return 0.2
    const latest = history[history.length - 1] ?? 0
    return Math.min(latest / threshold, 1) * 0.6 + 0.15
  }, [history, threshold])

  const W = 220
  const H = 52
  const linePath = buildSparklinePath(history, W, H)
  const fillPath = buildFillPath(history, W, H)

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 transition-all duration-500"
      style={{
        background: `linear-gradient(135deg, ${c.fill} 0%, rgba(15,23,42,0.6) 100%)`,
        border: `1px solid ${c.border}`,
        boxShadow: `0 0 ${Math.round(glowIntensity * 40)}px ${c.glow}`,
      }}
    >
      {/* Waveform background */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 opacity-70">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          width="100%"
          height={H}
          aria-hidden
        >
          <defs>
            <linearGradient id={`wf-fill-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.stroke} stopOpacity={0.4} />
              <stop offset="100%" stopColor={c.stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          {fillPath && (
            <path d={fillPath} fill={`url(#wf-fill-${color})`} />
          )}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={c.stroke}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className={`flex items-center justify-between text-xs uppercase tracking-wide ${c.label}`}>
          <span>{label}</span>
          <span className="opacity-70">{icon}</span>
        </div>
        <p className={`mt-2 text-3xl font-semibold text-white`}>{value}</p>
        <p className={`mt-0.5 text-sm ${c.sub}`}>{subLabel}</p>
      </div>
    </div>
  )
}
