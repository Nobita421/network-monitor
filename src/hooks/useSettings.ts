import { useState, useEffect, useCallback } from 'react'
import type { Settings } from '../types'
import { defaultSettings, SETTINGS_STORAGE_KEY } from '../lib/constants'
import { getDesktop } from '../lib/ipc'
import { loadSettings } from '../lib/utils'
import { MAX_WATCHLIST_ENTRIES, normalizeWatchEntry } from '../lib/watchlist'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [draft, setDraft] = useState(() => ({
    thresholdMb: Math.round((defaultSettings.threshold / 1024 / 1024) * 10) / 10,
    cooldown: defaultSettings.cooldownMinutes,
    pauseMinutes: defaultSettings.pauseMinutes,
  }))
  const [watchDraft, setWatchDraft] = useState<string[]>(() => settings.watchlist)

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    getDesktop()?.updateSettings(settings)
  }, [settings])

  useEffect(() => {
    if (!isModalOpen) return
    setDraft({
      thresholdMb: Math.round((settings.threshold / 1024 / 1024) * 10) / 10,
      cooldown: settings.cooldownMinutes,
      pauseMinutes: settings.pauseMinutes,
    })
    setWatchDraft(settings.watchlist)
  }, [isModalOpen, settings])

  const updateDraft = (field: 'thresholdMb' | 'cooldown' | 'pauseMinutes', value: number) => {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  const saveSettings = useCallback(() => {
    const thresholdMb = Number(draft.thresholdMb) || settings.threshold / 1024 / 1024
    const cooldown = Number(draft.cooldown) || settings.cooldownMinutes
    const pauseMinutes = Number(draft.pauseMinutes) || settings.pauseMinutes

    setSettings((prev) => ({
      ...prev,
      threshold: Math.max(0.5, thresholdMb) * 1024 * 1024,
      cooldownMinutes: Math.max(5 / 60, cooldown),
      pauseMinutes: Math.max(5 / 60, pauseMinutes),
      watchlist: watchDraft,
    }))
    setIsModalOpen(false)
  }, [draft, settings, watchDraft])

  const addWatchEntry = useCallback((name: string) => {
    const normalized = normalizeWatchEntry(name)
    if (!normalized) return
    setWatchDraft((prev) => (prev.includes(normalized) ? prev : [...prev, normalized].slice(0, MAX_WATCHLIST_ENTRIES)))
  }, [])

  const removeWatchEntry = useCallback((name: string) => {
    setWatchDraft((prev) => prev.filter((entry) => entry !== name))
  }, [])

  return {
    settings,
    isModalOpen,
    setIsModalOpen,
    draft,
    updateDraft,
    saveSettings,
    watchDraft,
    addWatchEntry,
    removeWatchEntry,
  }
}
