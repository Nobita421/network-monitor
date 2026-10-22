import type { Connection } from '../../types'

export interface GlobePoint {
    lat: number;
    lng: number;
    size: number;
    color: string;
    type: 'remote' | 'home';
    labelText: string;
    city?: string;
    country?: string;
    isp?: string;
    asn?: string;
    connCount: number;
    connections?: Connection[];
}

export function GlobeHoverCard({ point }: { point: GlobePoint }) {
    return (
        <div className="absolute top-4 right-4 bg-slate-900/90 p-4 rounded-xl backdrop-blur-md border border-slate-700/50 shadow-2xl max-w-xs animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none z-10">
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${
                    point.type === 'home' ? 'bg-blue-500' : 'bg-emerald-500'
                } animate-pulse shadow-[0_0_10px_currentColor]`} />
                <h4 className="font-bold text-white text-md">
                    {point.city || 'Unknown'}, {point.country || 'Unknown'}
                </h4>
            </div>
            {point.type === 'remote' ? (
                <div className="space-y-2">
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Top Process</div>
                        <div className="text-sm font-bold text-emerald-400 font-mono break-all">
                            {point.labelText.replace(/ \+\d+ locs$/, '')}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/50">
                        <div>
                            <div className="text-[10px] text-slate-500">CONNECTIONS</div>
                            <div className="text-sm font-bold text-white">{point.connCount}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500">COORDINATES</div>
                            <div className="text-xs font-mono text-slate-300">
                                {point.lat.toFixed(1)}, {point.lng.toFixed(1)}
                            </div>
                        </div>
                    </div>
                    {point.isp && (
                        <div className="mt-2 pt-2 border-t border-slate-700/50">
                            <div className="text-[10px] text-slate-500">PROVIDER</div>
                            <div className="text-xs text-slate-200 font-medium truncate">{point.isp}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{point.asn}</div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-xs text-slate-400 italic">
                    Estimated origin (not device GPS)<br />
                    Computed from observed remote endpoints.
                </div>
            )}
        </div>
    )
}
