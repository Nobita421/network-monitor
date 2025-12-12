import { useEffect, useState, memo } from 'react'
import { NetworkStat } from '../../types'
import { formatBytes } from '../../lib/utils'
import { ArrowDown, ArrowUp } from 'lucide-react'
import React from 'react'

const StatItem = memo(({ label, value, unit, colorClass, Icon, shadowColor }: any) => (
    <div className="flex flex-col items-center gap-1 min-w-[70px]">
        <div className={`${colorClass} flex items-center gap-1 opacity-80`}>
            <Icon size={14} />
            <span className="text-[10px] font-bold tracking-wider uppercase">{label}</span>
        </div>
        <span className="text-xl font-bold font-mono text-white tracking-tight" style={{ textShadow: `0 0 10px ${shadowColor}` }}>
            {value}
        </span>
        <span className="text-[10px] text-slate-500 font-medium">{unit}</span>
    </div>
));

export function OverlayView() {
    const [stats, setStats] = useState<NetworkStat>({ rx_sec: 0, tx_sec: 0, iface: '', operstate: 'up' })

    useEffect(() => {
        const handleUpdate = (_event: any, data: NetworkStat) => {
            setStats(data);
        };

        // Initial fetch just in case
        if (window.ipcRenderer) {
            window.ipcRenderer.getTrafficStats().then(data => {
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

    const rxParts = formatBytes(stats.rx_sec).split(' ');
    const txParts = formatBytes(stats.tx_sec).split(' ');

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-transparent overflow-hidden">
            {/* Draggable Container */}
            <div
                className="w-full h-full flex items-center justify-between px-6 bg-slate-950/90 backdrop-blur-md border border-white/5 shadow-2xl select-none"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
                <StatItem 
                    label="Down" 
                    value={rxParts[0]} 
                    unit={`${rxParts[1]}/s`} 
                    colorClass="text-emerald-400" 
                    Icon={ArrowDown} 
                    shadowColor="rgba(52,211,153,0.3)" 
                />

                {/* Divider */}
                <div className="h-8 w-px bg-white/10" />

                <StatItem 
                    label="Up" 
                    value={txParts[0]} 
                    unit={`${txParts[1]}/s`} 
                    colorClass="text-sky-400" 
                    Icon={ArrowUp} 
                    shadowColor="rgba(56,189,248,0.3)" 
                />
            </div>
        </div>
    )
}
