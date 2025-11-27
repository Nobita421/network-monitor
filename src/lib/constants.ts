import { HistoryRange, Settings } from '../types'

export const SETTINGS_STORAGE_KEY = 'netmonitor:settings'
export const TELEMETRY_RESUME_KEY = 'netmonitor:telemetry-resume'
export const LAST_ALERT_KEY = 'netmonitor:last-alert'

export const defaultSettings: Settings = {
  threshold: 5 * 1024 * 1024,
  cooldownMinutes: 5,
  pauseMinutes: 5,
}

export const rangeOptions: { label: string; value: HistoryRange }[] = [
  { label: '30s', value: '30s' },
  { label: '60s', value: '60s' },
  { label: '5m', value: '5m' },
]

export const stateFilters = [
  { label: 'All', value: 'all' },
  { label: 'Established', value: 'ESTABLISHED' },
  { label: 'Listening', value: 'LISTEN' },
]

export const chartWindow: Record<HistoryRange, number> = {
  '30s': 30,
  '60s': 60,
  '5m': 300,
}
