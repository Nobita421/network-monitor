import { useState, useEffect, useCallback } from 'react'
import { Settings } from '../types'
import { defaultSettings, SETTINGS_STORAGE_KEY } from '../lib/constants'
import { loadSettings } from '../lib/utils'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [draft, setDraft] = useState(() => ({
    thresholdMb: Math.round((defaultSettings.threshold / 1024 / 1024) * 10) / 10,
    cooldown: defaultSettings.cooldownMinutes,
    pauseMinutes: defaultSettings.pauseMinutes,
  }))

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (!isModalOpen) return
    setDraft({
      thresholdMb: Math.round((settings.threshold / 1024 / 1024) * 10) / 10,
      cooldown: settings.cooldownMinutes,
      pauseMinutes: settings.pauseMinutes,
    })
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
      cooldownMinutes: Math.max(1, cooldown),
      pauseMinutes: Math.max(1, pauseMinutes),
    }))
    setIsModalOpen(false)
  }, [draft, settings])

  return {
    settings,
    isModalOpen,
    setIsModalOpen,
    draft,
    updateDraft,
    saveSettings
  }
}
