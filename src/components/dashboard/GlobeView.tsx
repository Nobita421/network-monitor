import { useMemo, useState, useEffect, memo, useRef, useCallback } from 'react'
import Globe, { GlobeMethods } from 'react-globe.gl'
import { Globe as GlobeIcon } from 'lucide-react'
import { Card } from '../ui/Card'
import { Connection } from '../../types'
import { useGeoLocation } from '../../hooks/useGeoLocation'

interface GlobeViewProps {
    connections: Connection[]
}

interface GlobePoint {
    lat: number;
    lng: number;
    size: number;
    color: string;
    type: 'remote' | 'home';
    labelText: string;
    city?: string;
    country?: string;
    connCount: number;
}

// Memoize the Globe component to prevent re-renders when parent updates but props are same
const MemoizedGlobe = memo(Globe);

export function GlobeView({ connections }: GlobeViewProps) {
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
    const [isVisible, setIsVisible] = useState(true);
    // Use GlobeMethods interface from the library
    const globeRef = useRef<GlobeMethods | undefined>(undefined);
    // State for Custom Hover Card
    const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null);
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null);

    const handlePointHover = useCallback((point: object | null) => {
        if (hoverTimeout.current) {
            clearTimeout(hoverTimeout.current);
            hoverTimeout.current = null;
        }

        if (point) {
            setHoveredPoint(point as GlobePoint);
        } else {
            // Delay hiding to prevent flickering when moving to tooltip
            hoverTimeout.current = setTimeout(() => {
                setHoveredPoint(null);
            }, 100);
        }
    }, []);

    // Optimization: Pause rendering if not visible (e.g. tab switch)
    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(document.visibilityState === 'visible');
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);



    // Extract unique remote IPs
    const uniqueIps = useMemo(() => {
        const ips = new Set<string>()
        connections.forEach(c => {
            if (c.peerAddress && c.peerAddress !== '127.0.0.1' && c.peerAddress !== '::1') {
                ips.add(c.peerAddress)
            }
        })
        return Array.from(ips)
    }, [connections])

    const { locations, myLocation } = useGeoLocation(uniqueIps)

    // Group locations by coordinates and aggregate Process Names
    const uniqueLocations = useMemo(() => {
        const locMap = new Map<string, {
            lat: number,
            lon: number,
            city: string,
            country: string,
            ips: Set<string>,
            processes: Map<string, number>
        }>();

        // Quick lookup for Geo
        // Explicitly type the map to help TS inference
        const ipToGeo = new Map<string, typeof locations[0]>(locations.map(l => [l.ip, l]));

        connections.forEach(conn => {
            if (!conn.peerAddress || conn.peerAddress === '127.0.0.1' || conn.peerAddress === '::1') return;

            const geo = ipToGeo.get(conn.peerAddress);
            if (!geo) return;

            const key = `${geo.lat.toFixed(4)},${geo.lon.toFixed(4)}`;
            if (!locMap.has(key)) {
                locMap.set(key, {
                    lat: geo.lat,
                    lon: geo.lon,
                    city: geo.city,
                    country: geo.country,
                    ips: new Set([conn.peerAddress]),
                    processes: new Map([[conn.process || 'System', 1]])
                });
            } else {
                const entry = locMap.get(key)!;
                entry.ips.add(conn.peerAddress);
                const proc = conn.process || 'System';
                entry.processes.set(proc, (entry.processes.get(proc) || 0) + 1);
            }
        });

        return Array.from(locMap.values());
    }, [connections, locations]);

    const gData = useMemo(() => {
        // Remote Locations
        const points = uniqueLocations.map(loc => {
            // Find top process
            const sortedProcs = [...loc.processes.entries()].sort((a, b) => b[1] - a[1]);
            const topProc = sortedProcs[0]?.[0] || 'Unknown';
            const extraCount = loc.processes.size > 1 ? ` +${loc.processes.size - 1}` : '';

            return {
                lat: loc.lat,
                lng: loc.lon,
                size: 0.15 + (Math.min(loc.ips.size, 5) * 0.05),
                color: '#10b981', // Emerald 500
                type: 'remote',
                labelText: `${topProc}${extraCount}`,
                // Data for hover (can be expanded later)
                city: loc.city,
                country: loc.country,
                connCount: [...loc.ips].length
            };
        });

        // Add "My Location" Point
        if (myLocation) {
            points.push({
                lat: myLocation.lat,
                lng: myLocation.lon,
                size: 0.3,
                color: '#3b82f6', // Blue 500
                type: 'home',
                labelText: 'ME',
                city: myLocation.city,
                country: myLocation.country,
                connCount: 0
            });
        }

        return points;
    }, [uniqueLocations, myLocation]);



    // Arcs for Data Travel Direction
    const arcsData = useMemo(() => {
        if (!myLocation) return [];
        return uniqueLocations.map(loc => ({
            startLat: loc.lat,
            startLng: loc.lon,
            endLat: myLocation.lat,
            endLng: myLocation.lon,
            color: '#10b981', // Emerald (Download)
            dashLength: 0.4,
            dashGap: 0.2,
            animateTime: 2000 // Speed
        }));
    }, [uniqueLocations, myLocation]);

    useEffect(() => {
        const handleResize = () => {
            const container = document.getElementById('globe-container')
            if (container) {
                setDimensions({
                    width: container.clientWidth,
                    height: container.clientHeight
                })
            }
        }

        window.addEventListener('resize', handleResize)
        handleResize()

        return () => window.removeEventListener('resize', handleResize)
    }, [])

    if (!isVisible) return <div className="h-full bg-slate-950/50" />;

    return (
        <Card title="Global Connections" icon={GlobeIcon} className="h-full flex flex-col overflow-hidden p-0">
            <div id="globe-container" className="flex-1 relative bg-slate-950/50 rounded-b-3xl overflow-hidden">
                <MemoizedGlobe
                    ref={globeRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"

                    // Points (Location & Home)
                    pointsData={gData}
                    pointAltitude={0.01}
                    pointColor="color"
                    pointRadius="size"
                    pointLabel={() => ""} // Disable default tooltip
                    onPointHover={handlePointHover} // Capture hover state

                    // Atmosphere - Cyber Glow
                    atmosphereColor="#3b82f6"
                    atmosphereAltitude={0.2}

                    // Arcs - Traffic Flow
                    arcsData={arcsData}
                    arcColor="color"
                    arcDashLength="dashLength"
                    arcDashGap="dashGap"
                    arcDashAnimateTime="animateTime"

                    // Labels - Persistent Process Names
                    labelsData={gData}
                    labelLat="lat"
                    labelLng="lng"
                    labelText={(d: any) => d.labelText}
                    labelSize={1.5}
                    labelDotRadius={0.5}
                    labelColor={(d: any) => d.type === 'home' ? '#3b82f6' : 'rgba(255, 255, 255, 0.75)'}
                    labelResolution={2}

                    backgroundColor="rgba(0,0,0,0)"
                    // Performance settings
                    rendererConfig={{
                        powerPreference: "default",
                        antialias: true,
                        alpha: true,
                        pixelRatio: Math.min(2, window.devicePixelRatio)
                    }}
                    pointsMerge={false} // Disable merge to ensure labels render
                />

                {/* Rich Hover Card */}
                {hoveredPoint && (
                    <div className="absolute top-4 right-4 bg-slate-900/90 p-4 rounded-xl backdrop-blur-md border border-slate-700/50 shadow-2xl max-w-xs animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${hoveredPoint.type === 'home' ? 'bg-blue-500' : 'bg-emerald-500'} animate-pulse shadow-[0_0_10px_currentColor]`} />
                            <h4 className="font-bold text-white text-md">
                                {hoveredPoint.city || 'Unknown'}, {hoveredPoint.country || 'Unknown'}
                            </h4>
                        </div>
                        {hoveredPoint.type === 'remote' ? (
                            <div className="space-y-2">
                                <div>
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Top Process</div>
                                    <div className="text-sm font-bold text-emerald-400 font-mono break-all">
                                        {hoveredPoint.labelText.replace(/ \+\d+$/, '')}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/50">
                                    <div>
                                        <div className="text-[10px] text-slate-500">CONNECTIONS</div>
                                        <div className="text-sm font-bold text-white">{hoveredPoint.connCount}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500">COORDINATES</div>
                                        <div className="text-xs font-mono text-slate-300">
                                            {hoveredPoint.lat.toFixed(1)}, {hoveredPoint.lng.toFixed(1)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400 italic">
                                This device (Localhost) <br /> Source of all outgoing traffic.
                            </div>
                        )}
                    </div>
                )}

                {/* Overlay Cards */}
                <div className="absolute bottom-4 left-4 flex gap-4 pointer-events-none">
                    <div className="bg-slate-900/80 p-3 rounded-lg backdrop-blur border border-slate-700/50">
                        <p className="text-xs text-slate-400">Active Locations</p>
                        <p className="text-xl font-bold text-emerald-400">{uniqueLocations.length}</p>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-lg backdrop-blur border border-slate-700/50">
                        <p className="text-xs text-slate-400">Total Connections</p>
                        <p className="text-xl font-bold text-sky-400">{connections.length}</p>
                    </div>
                </div>
            </div>
        </Card>
    )
}
