import { useEffect, useState } from 'react'
import { NetworkStat } from '../../types'
import { formatBytes } from '../../lib/utils'
import { ArrowDown, ArrowUp } from 'lucide-react'
import React from 'react'

export function OverlayView() {
    const [stats, setStats] = useState<NetworkStat>({ rx_sec: 0, tx_sec: 0, iface: '', operstate: 'up' })

    useEffect(() => {
        const handleUpdate = (_event: any, data: NetworkStat) => {
            setStats(data);
        };

        // Initial fetch just in case
        if (window.ipcRenderer) {
            window.ipcRenderer.getNetworkStats().then(data => {
                if (data) setStats(data);
            });
            // Listen for live updates (0% CPU overhead)
            window.ipcRenderer.on('traffic-update', handleUpdate);
        }

        return () => {
            if (window.ipcRenderer) {
                window.ipcRenderer.off('traffic-update', handleUpdate);
            }
        };
    }, [])

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-transparent overflow-hidden">
            {/* Draggable Container */}
            <div
                className="w-full h-full flex items-center justify-between px-6 bg-slate-950/90 backdrop-blur-md border border-white/5 shadow-2xl select-none"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
                {/* RX */}
                <div className="flex flex-col items-center gap-1 min-w-[70px]">
                    <div className="text-emerald-400 flex items-center gap-1 opacity-80">
                        <ArrowDown size={14} />
                        <span className="text-[10px] font-bold tracking-wider uppercase">Down</span>
                    </div>
                    <span className="text-xl font-bold font-mono text-white tracking-tight drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                        {formatBytes(stats.rx_sec).split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                        {formatBytes(stats.rx_sec).split(' ')[1]}/s
                    </span>
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-white/10" />

                {/* TX */}
                <div className="flex flex-col items-center gap-1 min-w-[70px]">
                    <div className="text-sky-400 flex items-center gap-1 opacity-80">
                        <ArrowUp size={14} />
                        <span className="text-[10px] font-bold tracking-wider uppercase">Up</span>
                    </div>
                    <span className="text-xl font-bold font-mono text-white tracking-tight drop-shadow-[0_0_10px_rgba(56,189,248,0.3)]">
                        {formatBytes(stats.tx_sec).split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                        {formatBytes(stats.tx_sec).split(' ')[1]}/s
                    </span>
                </div>
            </div>
        </div>
    )
}
