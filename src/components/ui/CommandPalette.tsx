import { useEffect, useRef, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { Search, Activity, List, Globe, History, Download, Pause, Play, Settings, X, AlertCircle } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { getShortcutLabel } from '../../lib/utils'
import type { Tab } from '../../types'

interface Command {
  id: string
  label: string
  description: string
  icon: ReactNode
  action: () => void
  keywords: string[]
  disabled?: boolean
  disabledReason?: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  onExport: () => void
  onTogglePause: () => void
  onOpenSettings: () => void
  telemetryPaused: boolean
  hasHistory: boolean
}

export function CommandPalette({
  isOpen, onClose, activeTab, onTabChange,
  onExport, onTogglePause, onOpenSettings,
  telemetryPaused, hasHistory,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const inputRef    = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const titleId     = 'cmd-palette-title'

  useFocusTrap(containerRef, isOpen)

  const commands: Command[] = [
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      description: 'Live bandwidth intelligence',
      icon: <Activity size={16} className="text-sky-400" />,
      action: () => { onTabChange('dashboard'); onClose() },
      keywords: ['dashboard', 'home', 'live', 'bandwidth'],
    },
    {
      id: 'nav-connections',
      label: 'Go to Connections',
      description: 'Deep dive into active connections',
      icon: <List size={16} className="text-sky-400" />,
      action: () => { onTabChange('connections'); onClose() },
      keywords: ['connections', 'processes', 'table', 'ip'],
    },
    {
      id: 'nav-map',
      label: 'Go to Globe Map',
      description: 'Geo-visualize network connections',
      icon: <Globe size={16} className="text-sky-400" />,
      action: () => { onTabChange('map'); onClose() },
      keywords: ['map', 'globe', 'geo', 'location'],
    },
    {
      id: 'nav-history',
      label: 'Go to History',
      description: 'View historical network logs',
      icon: <History size={16} className="text-sky-400" />,
      action: () => { onTabChange('history'); onClose() },
      keywords: ['history', 'logs', 'past', 'records'],
    },
    {
      id: 'export',
      label: 'Export Snapshot CSV',
      description: hasHistory ? 'Download current history as CSV' : 'No data yet — start monitoring first',
      icon: hasHistory
        ? <Download size={16} className="text-emerald-400" />
        : <AlertCircle size={16} className="text-slate-500" />,
      action: () => { if (hasHistory) { onExport(); onClose() } },
      keywords: ['export', 'csv', 'download', 'snapshot'],
      disabled: !hasHistory,
      disabledReason: 'No history data available yet',
    },
    {
      id: 'pause',
      label: telemetryPaused ? 'Resume Telemetry' : 'Pause Telemetry',
      description: telemetryPaused ? 'Resume live data collection' : 'Temporarily pause data collection',
      icon: telemetryPaused
        ? <Play  size={16} className="text-amber-400" />
        : <Pause size={16} className="text-amber-400" />,
      action: () => { onTogglePause(); onClose() },
      keywords: ['pause', 'resume', 'telemetry', 'stop'],
    },
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Adjust threshold and preferences',
      icon: <Settings size={16} className="text-slate-300" />,
      action: () => { onOpenSettings(); onClose() },
      keywords: ['settings', 'threshold', 'config', 'preferences'],
    },
  ]

  const filtered = query.trim() === ''
    ? commands
    : commands.filter((cmd) =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description.toLowerCase().includes(query.toLowerCase()) ||
        cmd.keywords.some((k) => k.includes(query.toLowerCase()))
      )

  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => { setSelectedIndex(0) }, [query])

  // Use rAF instead of setTimeout to reliably focus input after layout
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      const raf = requestAnimationFrame(() => { inputRef.current?.focus() })
      return () => cancelAnimationFrame(raf)
    }
  }, [isOpen])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[selectedIndex]
      if (cmd && !cmd.disabled) cmd.action()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [filtered, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden />
          <label htmlFor="cmd-search" id={titleId} className="sr-only">Search commands</label>
          <input
            id="cmd-search"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands..."
            aria-autocomplete="list"
            aria-controls="cmd-list"
            aria-activedescendant={filtered[selectedIndex] ? `cmd-item-${filtered[selectedIndex].id}` : undefined}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Close command palette">
            <X size={15} />
          </button>
          <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400" aria-hidden>ESC</kbd>
        </div>

        {/* Results */}
        <ul id="cmd-list" role="listbox" className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500" role="option" aria-selected={false}>
              No commands found
            </li>
          ) : (
            filtered.map((cmd, i) => (
              <li key={cmd.id} role="option" aria-selected={i === selectedIndex}>
                <button
                  id={`cmd-item-${cmd.id}`}
                  disabled={cmd.disabled}
                  title={cmd.disabled ? cmd.disabledReason : undefined}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    cmd.disabled
                      ? 'cursor-not-allowed opacity-40'
                      : i === selectedIndex
                        ? 'bg-sky-500/10 text-white'
                        : 'text-slate-300 hover:bg-white/5'
                  }`}
                  onClick={cmd.disabled ? undefined : cmd.action}
                  onMouseEnter={() => { if (!cmd.disabled) setSelectedIndex(i) }}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5" aria-hidden>
                    {cmd.icon}
                  </span>
                  <span className="flex-1">
                    <p className="text-sm font-medium">{cmd.label}</p>
                    <p className="text-xs text-slate-500">{cmd.description}</p>
                  </span>
                  {activeTab === cmd.id.replace('nav-', '') && (
                    <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">active</span>
                  )}
                  {cmd.disabled && (
                    <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-400">unavailable</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-white/5 px-4 py-2 text-[11px] text-slate-500">
          <span><kbd className="rounded bg-white/5 px-1" aria-hidden>↑↓</kbd> navigate</span>
          <span><kbd className="rounded bg-white/5 px-1" aria-hidden>↵</kbd> select</span>
          <span><kbd className="rounded bg-white/5 px-1" aria-hidden>ESC</kbd> close</span>
          <span className="ml-auto opacity-50">{getShortcutLabel('K')} — NetMonitor</span>
        </div>
      </div>
    </div>
  )
}
