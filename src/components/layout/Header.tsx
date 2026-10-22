import { useEffect, useState } from 'react'
import * as Lucide from 'lucide-react'
import { getDesktop, invokeWithTimeout } from '../../lib/ipc'
import { formatCountdown, getShortcutLabel } from '../../lib/utils'
import type { HistoryPoint, Tab } from '../../types'

const TAB_META: Record<Tab, { label: string; sub: string; icon: React.ReactNode }> = {
  dashboard:   { label: 'Dashboard',   sub: 'Live telemetry',       icon: <Lucide.LayoutDashboard size={13} /> },
  connections: { label: 'Connections', sub: 'Active socket table',  icon: <Lucide.Network size={13} /> },
  map:         { label: 'Globe Map',   sub: 'Geo-IP visualisation', icon: <Lucide.Globe2 size={13} /> },
  history:     { label: 'History',     sub: 'Stored traffic logs',  icon: <Lucide.BarChart2 size={13} /> },
}

interface HeaderProps {
  activeTab: Tab
  alertIndicator: boolean
  telemetryPaused: boolean
  pauseCountdown: number
  history: HistoryPoint[]
  onExport: () => void
  onOpenSettings: () => void
  onTogglePause: () => void
  onOpenCommandPalette: () => void
}

export function Header({
  activeTab, alertIndicator, telemetryPaused, pauseCountdown,
  history, onExport, onOpenSettings, onTogglePause, onOpenCommandPalette,
}: HeaderProps) {
  const meta = TAB_META[activeTab]
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayLocked, setOverlayLocked] = useState(false)

  useEffect(() => {
    const desktop = getDesktop()
    if (!desktop) return
    let active = true
    const unsubscribeMode = desktop.onOverlayModeChange((mode) => {
      if (active) setOverlayLocked(mode === 'locked')
    })
    const unsubscribeClosed = desktop.onOverlayClosed(() => {
      if (!active) return
      setOverlayOpen(false)
      setOverlayLocked(false)
    })
    void invokeWithTimeout(() => desktop.getOverlayMode())
      .then((mode) => { if (active) setOverlayLocked(mode === 'locked') })
      .catch((error) => console.error('Failed to read overlay mode:', error))
    void invokeWithTimeout(() => desktop.getOverlayOpen())
      .then((open) => { if (active) setOverlayOpen(open) })
      .catch((error) => console.error('Failed to read overlay state:', error))
    return () => {
      active = false
      unsubscribeMode()
      unsubscribeClosed()
    }
  }, [])

  const handleToggleOverlay = async () => {
    const desktop = getDesktop()
    if (!desktop) return
    try {
      const opened = await invokeWithTimeout(() => desktop.toggleOverlay())
      setOverlayOpen(opened)
      if (!opened) setOverlayLocked(false)
    } catch (error) {
      console.error('Failed to toggle overlay:', error)
    }
  }

  const handleToggleOverlayLock = async () => {
    const desktop = getDesktop()
    if (!desktop) return
    try {
      // Always flip the live mode from main — local state drifts when the
      // overlay's own lock button is used (separate window, no shared state).
      const current = await invokeWithTimeout(() => desktop.getOverlayMode())
      const nextMode = current === 'locked' ? 'unlocked' : 'locked'
      const success = await invokeWithTimeout(() => desktop.setOverlayMode(nextMode))
      if (success) setOverlayLocked(nextMode === 'locked')
    } catch (error) {
      console.error('Failed to toggle overlay lock mode:', error)
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#060b18]/80 px-5 backdrop-blur-2xl">
      {/* Left — breadcrumb */}
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-slate-600 shrink-0">{meta.icon}</span>
        <span className="text-slate-700 shrink-0">/</span>
        <span className="font-semibold text-white text-[13px] truncate">{meta.label}</span>
        <span className="hidden sm:inline text-slate-700 shrink-0">—</span>
        <span className="hidden sm:inline text-[11px] text-slate-600 truncate">{meta.sub}</span>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Alert badge */}
        {alertIndicator && (
          <span className="hidden sm:flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 animate-pulse">
            <Lucide.Zap size={10} />
            High usage
          </span>
        )}

        {/* Search / Cmd palette */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.04] pl-2.5 pr-2 py-1.5 text-[11px] text-slate-500 hover:bg-white/[0.08] hover:text-slate-300 transition-all duration-150"
        >
          <Lucide.Search size={12} />
          <span className="hidden md:inline">Search</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-[9px] text-slate-600">{getShortcutLabel('K')}</kbd>
        </button>

        {/* Pause/Resume */}
        <button
          onClick={onTogglePause}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 ${
            telemetryPaused
              ? 'border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15'
              : 'border-white/[0.07] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white'
          }`}
        >
          {telemetryPaused
            ? <><Lucide.Play size={11} />{formatCountdown(pauseCountdown)}</>
            : <><Lucide.Pause size={11} /><span className="hidden sm:inline">Pause</span></>}
        </button>

        {/* Ghost overlay */}
        <button
          onClick={() => { void handleToggleOverlay() }}
          className={`rounded-lg border p-1.5 transition-all duration-150 ${
            overlayOpen
              ? 'border-sky-400/30 bg-sky-400/10 text-sky-300 hover:bg-sky-400/15'
              : 'border-white/[0.07] bg-white/[0.04] text-slate-500 hover:bg-white/[0.08] hover:text-white'
          }`}
          title={overlayOpen ? 'Close Overlay' : 'Open Overlay'}
          aria-label={overlayOpen ? 'Close Overlay' : 'Open Overlay'}
        >
          <Lucide.Ghost size={13} />
        </button>

        {/* Overlay click-through lock — the overlay's own lock button becomes
            unclickable once locked (OS-level click-through), so this is the
            way back, as promised by the overlay's "Unlock via Main App" hint. */}
        {overlayOpen && (
          <button
            onClick={() => { void handleToggleOverlayLock() }}
            className={`rounded-lg border p-1.5 transition-all duration-150 ${
              overlayLocked
                ? 'border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15'
                : 'border-white/[0.07] bg-white/[0.04] text-slate-500 hover:bg-white/[0.08] hover:text-white'
            }`}
            title={overlayLocked ? 'Unlock Overlay (disable click-through)' : 'Lock Overlay (enable click-through)'}
            aria-label={overlayLocked ? 'Unlock Overlay' : 'Lock Overlay'}
          >
            {overlayLocked ? <Lucide.Lock size={13} /> : <Lucide.Unlock size={13} />}
          </button>
        )}

        {/* Export */}
        <button
          onClick={onExport}
          disabled={!history.length}
          className={`hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
            history.length
              ? 'border-white/[0.08] text-slate-400 hover:border-white/20 hover:bg-white/[0.05] hover:text-white'
              : 'cursor-not-allowed border-white/[0.04] text-slate-700'
          }`}
        >
          <Lucide.Download size={11} />
          <span>Export</span>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-sky-500/25 hover:from-sky-400 hover:to-indigo-500 hover:shadow-sky-400/30 transition-all duration-150"
        >
          <Lucide.SlidersHorizontal size={11} />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </header>
  )
}
