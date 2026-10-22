import { Activity, ExternalLink, Globe as GlobeIcon, Zap } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import type { Connection } from '../../types'
import type { GlobePoint } from './GlobeHoverCard'

interface LocationDrawerProps {
    selected: GlobePoint | null
    isOpen: boolean
    onClose: () => void
    onRequestKill: (connection: Connection) => void
}

export function LocationDrawer({ selected, isOpen, onClose, onRequestKill }: LocationDrawerProps) {
    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={selected ? `${selected.city}, ${selected.country}` : 'Location Details'}
        >
            {selected && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                                <GlobeIcon size={12} /> NETWORK
                            </p>
                            <p className="text-sm font-semibold text-white truncate" title={selected.isp}>
                                {selected.isp || 'Unknown ISP'}
                            </p>
                            <p className="text-xs text-slate-500 font-mono">{selected.asn}</p>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                                <Activity size={12} /> TRAFFIC
                            </p>
                            <p className="text-sm font-semibold text-emerald-400">{selected.connCount} Active</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Active Connections</h3>
                        <div className="space-y-2">
                            {selected.connections?.map((conn, idx) => (
                                <div
                                    key={`${conn.pid}-${conn.peerAddress}-${idx}`}
                                    className="bg-slate-800/30 p-3 rounded border border-slate-700/50 hover:border-slate-600 transition-colors group"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-mono text-sm text-green-400 font-bold">
                                            {conn.process || 'System'}
                                        </div>
                                        <button
                                            className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1"
                                            onClick={() => { onRequestKill(conn) }}
                                            disabled={!Number.isInteger(conn.pid) || !conn.pid || conn.pid <= 0}
                                            title="Kill Process"
                                            aria-label={`Kill process ${conn.process || 'System'} (PID ${conn.pid})`}
                                        >
                                            <Zap size={10} /> KILL
                                        </button>
                                    </div>
                                    <div className="text-xs text-slate-400 font-mono mb-1 flex items-center gap-2">
                                        <span>PID: {conn.pid}</span>
                                        <span>•</span>
                                        <span>{conn.protocol}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-900/50 px-2 py-1 rounded w-fit font-mono">
                                        <ExternalLink size={10} />
                                        {conn.peerAddress}:{conn.peerPort}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </Drawer>
    )
}
