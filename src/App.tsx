import { Suspense, lazy, startTransition, useCallback, useEffect, useState } from 'react'
import { DashboardView } from './components/dashboard/DashboardView'
import { SettingsModal } from './components/dashboard/SettingsModal'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { CommandPalette } from './components/ui/CommandPalette'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ToastContainer } from './components/ui/Toast'
import { useNetworkData } from './hooks/useNetworkData'
import { useSettings } from './hooks/useSettings'
import { isDesktopAvailable } from './lib/ipc'
import type { HistoryRange, Tab } from './types'

const ConnectionsView = lazy(async () => ({ default: (await import('./components/dashboard/ConnectionsView')).ConnectionsView }))
const GlobeView       = lazy(async () => ({ default: (await import('./components/dashboard/GlobeView')).GlobeView }))
const HistoryView     = lazy(async () => ({ default: (await import('./components/dashboard/HistoryView')).HistoryView }))
const OverlayView     = lazy(async () => ({ default: (await import('./components/overlay/OverlayView')).OverlayView }))

// ─── Fallbacks ────────────────────────────────────────────────────────────────

function ViewFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-400" />
        <p className="text-xs text-slate-500 tracking-wider uppercase">Loading view</p>
      </div>
    </div>
  )
}

function DesktopUnavailable() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#030712] text-center px-6">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
          <span className="text-2xl">🖥️</span>
        </div>
      </div>
      <h1 className="mb-2 text-xl font-bold text-white">Desktop bridge unavailable</h1>
      <p className="max-w-sm text-sm text-slate-400">
        NetMonitor Pro requires the Electron desktop environment. Please run the app with{' '}
        <code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs text-sky-300">pnpm dev</code>.
      </p>
    </div>
  )
}

// ─── Overlay shell ────────────────────────────────────────────────────────────

function OverlayShell() {
  useEffect(() => { document.body.style.backgroundColor = 'transparent' }, [])
  return (
    <Suspense fallback={<ViewFallback />}>
      <OverlayView />
    </Suspense>
  )
}

// ─── Main shell ───────────────────────────────────────────────────────────────

function MainShell() {
  const [activeTab,       setActiveTab]       = useState<Tab>('dashboard')
  const [historyRange,    setHistoryRange]    = useState<HistoryRange>('60s')
  const [lastExportTime,  setLastExportTime]  = useState<string | null>(null)
  const [cmdOpen,         setCmdOpen]         = useState(false)

  const { settings, isModalOpen, setIsModalOpen, draft, updateDraft, saveSettings } = useSettings()

  const {
    stats, history, connections, processUsage, sessionUsage,
    maxSpikes, alertLog, alertIndicator,
    telemetryPaused, pauseCountdown, toggleTelemetry,
  } = useNetworkData(settings)

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleExportHistory = useCallback(() => {
    if (!history.length) return
    // Use ISO timestamps for machine-readable CSV
    const header = 'timestamp_iso,download_bytes_per_sec,upload_bytes_per_sec'
    const rows   = history.map((p) => `${p.isoTime ?? p.time},${p.rx},${p.tx}`)
    const csv    = [header, ...rows].join('\n')
    const blob   = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url    = URL.createObjectURL(blob)
    const link   = document.createElement('a')
    link.href    = url
    link.download = `netmonitor-history-${new Date().toISOString().replace(/[:]/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setLastExportTime(new Date().toLocaleTimeString())
  }, [history])

  const handleTabChange = useCallback((tab: Tab) => {
    startTransition(() => setActiveTab(tab))
  }, [])

  return (
    <div className="relative min-h-screen bg-[#030712] font-sans text-slate-100 overflow-hidden">
      {/* Ambient background glow layers */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-sky-500/[0.07] rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[400px] bg-indigo-500/[0.06] rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-violet-500/[0.05] rounded-full blur-[100px]" />
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative z-10 flex h-screen overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} stats={stats} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            activeTab={activeTab}
            alertIndicator={alertIndicator}
            telemetryPaused={telemetryPaused}
            pauseCountdown={pauseCountdown}
            history={history}
            onExport={handleExportHistory}
            onOpenSettings={() => setIsModalOpen(true)}
            onTogglePause={toggleTelemetry}
            onOpenCommandPalette={() => setCmdOpen(true)}
          />

          <div className="relative flex-1 overflow-hidden">
            <div className="absolute inset-0 overflow-auto">
              <div className="px-6 py-6">
                {activeTab === 'dashboard' && (
                  <DashboardView
                    stats={stats}
                    maxSpikes={maxSpikes}
                    sessionUsage={sessionUsage}
                    settings={settings}
                    history={history}
                    historyRange={historyRange}
                    setHistoryRange={setHistoryRange}
                    processUsage={processUsage}
                    alertLog={alertLog}
                    onOpenSettings={() => setIsModalOpen(true)}
                  />
                )}
                {activeTab === 'connections' && (
                  <Suspense fallback={<ViewFallback />}>
                    <ConnectionsView
                      connections={connections}
                      stats={stats}
                      sessionUsage={sessionUsage}
                      telemetryPaused={telemetryPaused}
                      handlePauseTelemetry={toggleTelemetry}
                      pauseCountdown={pauseCountdown}
                      settings={settings}
                      handleExportHistory={handleExportHistory}
                      history={history}
                      lastExportTime={lastExportTime}
                    />
                  </Suspense>
                )}
                {activeTab === 'map' && (
                  <Suspense fallback={<ViewFallback />}>
                    <div className="h-[calc(100vh-7rem)] min-h-[560px]">
                      <GlobeView connections={connections} />
                    </div>
                  </Suspense>
                )}
                {activeTab === 'history' && (
                  <Suspense fallback={<ViewFallback />}>
                    <HistoryView />
                  </Suspense>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        draft={draft}
        updateDraft={updateDraft}
        onSave={saveSettings}
      />

      <CommandPalette
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onExport={handleExportHistory}
        onTogglePause={toggleTelemetry}
        onOpenSettings={() => { setIsModalOpen(true); setCmdOpen(false) }}
        telemetryPaused={telemetryPaused}
        hasHistory={history.length > 0}
      />

      {/* Toast notification stack */}
      <ToastContainer />
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function App() {
  if (!isDesktopAvailable()) return <DesktopUnavailable />
  const isOverlay = window.location.hash === '#/overlay' || window.location.hash === '#overlay'
  return (
    <ErrorBoundary>
      {isOverlay ? <OverlayShell /> : <MainShell />}
    </ErrorBoundary>
  )
}

export default App
