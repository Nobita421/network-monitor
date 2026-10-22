export interface PingSample {
  timestamp: number
  ping: number
}

/** Extracts finite positive ping samples, preserving chronological order. */
export function extractPingSeries(logs: { timestamp: number; ping?: number }[]): PingSample[] {
  const series: PingSample[] = []
  for (const log of logs) {
    if (typeof log.ping === 'number' && Number.isFinite(log.ping) && log.ping > 0) {
      series.push({ timestamp: log.timestamp, ping: log.ping })
    }
  }
  return series
}

export function averagePing(series: PingSample[]) {
  if (series.length === 0) return 0
  return series.reduce((sum, sample) => sum + sample.ping, 0) / series.length
}
