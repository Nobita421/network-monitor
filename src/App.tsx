import { Suspense, lazy, startTransition, useCallback, useEffect, useState } from 'react'
import { DashboardView } from './components/dashboard/DashboardView'
import { SettingsModal } from './components/dashboard/SettingsModal'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { useNetworkData } from './hooks/useNetworkData'
import { useSettings } from './hooks/useSettings'
import type { HistoryRange } from './types'

const ConnectionsView = lazy(async () => ({ default: (await import('./components/dashboard/ConnectionsView')).ConnectionsView }))
const GlobeView = lazy(async () => ({ default: (await import('./components/dashboard/GlobeView')).GlobeView }))
const HistoryView = lazy(async () => ({ default: (await import('./components/dashboard/HistoryView')).HistoryView }))
const OverlayView = lazy(async () => ({ default: (await import('./components/overlay/OverlayView')).OverlayView }))

function ViewFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-white/5 bg-white/5 text-sm text-slate-400">
      Loading view...
    </div>
  )
}

function OverlayShell() {
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent'
  }, [])

  return (
    <Suspense fallback={<ViewFallback />}>
      <OverlayView />
    </Suspense>
  )
}

function MainShell() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'connections' | 'map' | 'history'>('dashboard')
  const [historyRange, setHistoryRange] = useState<HistoryRange>('60s')
  const [lastExportTime, setLastExportTime] = useState<string | null>(null)

  const {
    settings,
    isModalOpen,
    setIsModalOpen,
    draft,
    updateDraft,
    saveSettings,
  } = useSettings()

  const {
    stats,
    history,
    connections,
    processUsage,
    sessionUsage,
    maxSpikes,
    alertLog,
    elapsedSeconds,
    alertIndicator,
    telemetryPaused,
    pauseCountdown,
    toggleTelemetry,
  } = useNetworkData(settings)

  const handleExportHistory = useCallback(() => {
    if (!history.length) {
      return
    }

    const header = 'timestamp,download_bytes_per_sec,upload_bytes_per_sec'
    const rows = history.map((point) => `${point.time},${point.rx},${point.tx}`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `netmonitor-history-${new Date().toISOString().replace(/[:]/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setLastExportTime(new Date().toLocaleTimeString())
  }, [history])

  const handleTabChange = useCallback((tab: 'dashboard' | 'connections' | 'map' | 'history') => {
    startTransition(() => {
      setActiveTab(tab)
    })
  }, [])

  return (
    <div className="relative min-h-screen bg-slate-950 font-sans text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.15),_transparent_55%)]" />

      <div className="relative flex h-screen overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          stats={stats}
          elapsedSeconds={elapsedSeconds}
        />

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
          />

          <div className="relative flex-1 overflow-hidden">
            <div className="absolute inset-0 overflow-auto">
              <div className="px-6 py-8">
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
                    <GlobeView connections={connections} />
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
    </div>
  )
}

function App() {
  const isOverlay = window.location.hash === '#/overlay' || window.location.hash === '#overlay'
  return isOverlay ? <OverlayShell /> : <MainShell />
}

export default App
