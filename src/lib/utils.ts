import { Settings } from '../types'
import { defaultSettings, SETTINGS_STORAGE_KEY } from './constants'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const loadSettings = (): Settings => {
  if (typeof window === 'undefined') return defaultSettings
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!stored) return defaultSettings
    const parsed: unknown = JSON.parse(stored)
    const parsedSettings = isRecord(parsed) ? parsed : {}
    return {
      ...defaultSettings,
      threshold: Number(parsedSettings.threshold) || defaultSettings.threshold,
      cooldownMinutes: Number(parsedSettings.cooldownMinutes) || defaultSettings.cooldownMinutes,
      pauseMinutes: Number(parsedSettings.pauseMinutes) || defaultSettings.pauseMinutes,
    }
  } catch (error) {
    console.warn('Failed to parse settings, falling back to defaults.', error)
    return defaultSettings
  }
}

export const loadStoredNumber = (key: string): number | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours) return `${hours}h ${minutes}m`
  if (minutes) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export const formatCountdown = (seconds: number) => {
  if (seconds <= 0) return '0s'
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  if (minutes) return `${minutes}m ${remaining}s`
  return `${remaining}s`
}

export function formatMinutesDuration(minutes: number) {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)} sec`
  }
  return `${Number(minutes).toFixed(1).replace(/\.0$/, '')} min`
}

/** Platform-aware keyboard shortcut label */
export function getShortcutLabel(key: string) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform)
  return isMac ? `⌘${key}` : `Ctrl+${key}`
}
