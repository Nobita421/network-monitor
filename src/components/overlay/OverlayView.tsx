import { useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, ArrowDown, ArrowUp, Lock, Unlock } from 'lucide-react'
import type { AlertPayload } from '../../lib/ipc'
import { formatBytes } from '../../lib/utils'
import type { NetworkStat } from '../../types'

interface OverlayAlert {
    title: string
    body: string
    time: string
}

const ALERT_HIDE_DELAY_MS = 5000

export function OverlayView() {
    const [stats, setStats] = useState<NetworkStat>({
        rx_sec: 0,
        tx_sec: 0,
        iface: '',
        operstate: 'up',
        ping: 0,
    })
    const [isLocked, setIsLocked] = useState(false)
    const [alert, setAlert] = useState<OverlayAlert | null>(null)
    const alertTimeoutRef = useRef<number | null>(null)

    useEffect(() => {
        const loadInitialStats = async () => {
            try {
                const data = await window.desktop.getTrafficStats()
                if (data) {
                    setStats(data)
                }
            } catch (error) {
                console.error('Failed to load initial overlay stats:', error)
            }
        }

        void loadInitialStats()

        const unsubscribeTraffic = window.desktop.onTrafficUpdate((data: NetworkStat) => {
            setStats((prev) => ({
                ...prev,
                ...data,
                ping: data.ping ?? prev.ping,
            }))
        })

        const unsubscribeAlert = window.desktop.onAlertTriggered((payload: AlertPayload) => {
            setAlert({
                title: payload.title,
                body: payload.body,
                time: payload.time,
            })

            if (alertTimeoutRef.current) {
                window.clearTimeout(alertTimeoutRef.current)
            }

            alertTimeoutRef.current = window.setTimeout(() => {
                setAlert(null)
                alertTimeoutRef.current = null
            }, ALERT_HIDE_DELAY_MS)
        })

        return () => {
            unsubscribeTraffic()
            unsubscribeAlert()

            if (alertTimeoutRef.current) {
                window.clearTimeout(alertTimeoutRef.current)
                alertTimeoutRef.current = null
            }
        }
    }, [])

    const toggleLock = async () => {
        const nextMode = isLocked ? 'unlocked' : 'locked'
        try {
            const success = await window.desktop.setOverlayMode(nextMode)
            if (success) {
                setIsLocked(!isLocked)
            }
        } catch (error) {
            console.error('Failed to toggle overlay lock mode:', error)
        }
    }

    const getPingColorClass = (ping?: number) => {
        if (typeof ping !== 'number' || ping <= 0) {
            return 'text-slate-400'
        }

        if (ping < 50) {
            return 'text-emerald-400'
        }

        if (ping < 100) {
            return 'text-amber-400'
        }

        return 'text-rose-400'
    }

    return (
        <>
            <style>{`
                body, html, #root {
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: visible !important;
                    background: transparent !important;
                    width: 100%;
                    height: 100%;
                }

                .drag-region {
                    -webkit-app-region: drag;
                }

                .no-drag {
                    -webkit-app-region: no-drag;
                }
            `}</style>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                    className={[
                        'pointer-events-auto',
                        'flex items-center gap-3 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-lg transition-all duration-300 select-none',
                        alert
                            ? 'bg-rose-950/90 border-rose-500/50 shadow-rose-500/30 shadow-2xl scale-105'
                            : isLocked
                                ? 'bg-slate-950/40 border-transparent opacity-55'
                                : 'bg-slate-950/80 border-white/10 cursor-move opacity-100 drag-region',
                    ].join(' ')}
                >
                    {alert && (
                        <div className="flex items-center gap-1.5 animate-pulse">
                            <AlertTriangle size={12} className="text-rose-400" />
                            <span className="text-xs font-bold text-rose-300">ALERT</span>
                        </div>
                    )}

                    <div className="flex min-w-[60px] items-center gap-1.5">
                        <ArrowDown size={12} className={alert ? 'text-rose-300' : 'text-emerald-400'} />
                        <span className={`font-mono text-xs font-bold ${alert ? 'text-rose-200' : 'text-white'}`}>
                            {formatBytes(stats.rx_sec)}/s
                        </span>
                    </div>

                    <div className="flex min-w-[60px] items-center gap-1.5">
                        <ArrowUp size={12} className={alert ? 'text-rose-300' : 'text-sky-400'} />
                        <span className={`font-mono text-xs font-bold ${alert ? 'text-rose-200' : 'text-white'}`}>
                            {formatBytes(stats.tx_sec)}/s
                        </span>
                    </div>

                    {!alert && (
                        <div className="flex min-w-[40px] items-center gap-1.5">
                            <Activity size={12} className={getPingColorClass(stats.ping)} />
                            <span className={`font-mono text-xs font-bold ${getPingColorClass(stats.ping)}`}>
                                {typeof stats.ping === 'number' && stats.ping > 0 ? `${Math.round(stats.ping)}ms` : '--'}
                            </span>
                        </div>
                    )}

                    <button
                        onClick={() => {
                            void toggleLock()
                        }}
                        className={[
                            'no-drag ml-1 rounded-full p-1 transition-colors',
                            isLocked
                                ? 'text-rose-400 hover:bg-rose-500/20'
                                : 'text-slate-400 hover:bg-white/10 hover:text-white',
                        ].join(' ')}
                        title={isLocked ? 'Locked (Click-through enabled). Toggle in Main App to unlock.' : 'Lock (Enable Click-through)'}
                    >
                        {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                    </button>
                </div>

                {isLocked && !alert && (
                    <div className="absolute left-1/2 top-12 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-500/20 bg-black/90 px-2 py-1 text-[10px] text-rose-300 pointer-events-none">
                        Unlock via Main App
                    </div>
                )}
            </div>
        </>
    )
}
