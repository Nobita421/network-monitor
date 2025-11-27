import { useEffect, useState } from 'react'
import { NetworkStat } from '../../types'
import { formatBytes } from '../../lib/utils'
import { ArrowDown, ArrowUp } from 'lucide-react'

export function OverlayView() {
    const [stats, setStats] = useState<NetworkStat | null>(null)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await window.ipcRenderer.getNetworkStats()
                if (data) setStats(data)
            } catch (error) {
                console.error('Failed to fetch stats', error)
            }
        }

        fetchStats()
        const interval = setInterval(fetchStats, 1000)
        return () => clearInterval(interval)
    }, [])

    if (!stats) return null

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-transparent">
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-white/10 shadow-2xl select-none">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <ArrowDown size={16} />
                        <span className="text-lg font-bold font-mono">{formatBytes(stats.rx_sec)}/s</span>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sky-400">
                        <ArrowUp size={16} />
                        <span className="text-lg font-bold font-mono">{formatBytes(stats.tx_sec)}/s</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
