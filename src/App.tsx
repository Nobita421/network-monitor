import { useState, useEffect, useCallback } from 'react'
import { useSettings } from './hooks/useSettings'
import { useNetworkData } from './hooks/useNetworkData'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { DashboardView } from './components/dashboard/DashboardView'
import { ConnectionsView } from './components/dashboard/ConnectionsView'
import { GlobeView } from './components/dashboard/GlobeView'
import { HistoryView } from './components/dashboard/HistoryView'
import { OverlayView } from './components/overlay/OverlayView'
import { SettingsModal } from './components/dashboard/SettingsModal'
import { HistoryRange } from './types'

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'connections' | 'map' | 'history'>('dashboard')
  const [isOverlay, setIsOverlay] = useState(false)

  useEffect(() => {
    if (window.location.hash === '#/overlay') {
      setIsOverlay(true)
      document.body.style.backgroundColor = 'transparent'
    }
  }, [])

  if (isOverlay) {
    return <OverlayView />
  }

  const [historyRange, setHistoryRange] = useState<HistoryRange>('60s')
  const [lastExportTime, setLastExportTime] = useState<string | null>(null)

  const {
    settings,
    isModalOpen,
    setIsModalOpen,
    draft,
    updateDraft,
    saveSettings
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
    toggleTelemetry
  } = useNetworkData(settings)

  const handleExportHistory = useCallback(() => {
    if (!history.length) return
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

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.15),_transparent_55%)]" />

      <div className="relative flex h-screen overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          stats={stats}
          elapsedSeconds={elapsedSeconds}
        />

        <div className="flex-1 flex flex-col min-w-0">
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

          <div className="flex-1 overflow-hidden relative">
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
                )}

                {activeTab === 'map' && (
                  <GlobeView connections={connections} />
                )}

                {activeTab === 'history' && (
                  <HistoryView />
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

export default App
