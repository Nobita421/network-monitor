import { formatBytes } from '../../lib/utils'

/** Shared download/upload series colors across dashboard charts. */
export const CHART_SERIES = {
  rx: '#34d399',
  tx: '#38bdf8',
} as const

/** Shared Recharts tooltip chrome (dark card). Label formatters stay per-chart. */
export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#0a0f1e',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    fontSize: 11,
    padding: '8px 12px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  },
  itemStyle: { color: '#cbd5e1', padding: '1px 0' },
  labelStyle: { color: '#64748b', marginBottom: 4 },
} as const

export const CHART_TOOLTIP_CURSOR = { stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 } as const

/** Byte formatter for Recharts tick/tooltip callbacks (accepts number-like values). */
export function formatRechartsByte(value: number | string): string {
  return formatBytes(typeof value === 'number' ? value : Number(value))
}
