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
    const globeRef = useRef<GlobeMethods | undefined>(undefined);
    // State for Custom Hover Card
    const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null);

    const [filterProcess, setFilterProcess] = useState('');

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

    // Filter connections based on process name
    const filteredConnections = useMemo(() => {
        if (!filterProcess) return connections;
        return connections.filter(c =>
            (c.process || '').toLowerCase().includes(filterProcess.toLowerCase())
        );
    }, [connections, filterProcess]);

    // Group locations by coordinates and aggregate Process Names
    const uniqueLocations = useMemo(() => {
        const locMap = new Map<string, {
            lat: number,
            lon: number,
            city: string,
            country: string,
            ips: Set<string>,
            processes: Map<string, number>,
            totalConns: number
        }>();

        // Quick lookup for Geo
        const ipToGeo = new Map<string, typeof locations[0]>(locations.map(l => [l.ip, l]));

        filteredConnections.forEach(conn => {
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
                    processes: new Map([[conn.process || 'System', 1]]),
                    totalConns: 1
                });
            } else {
                const entry = locMap.get(key)!;
                entry.ips.add(conn.peerAddress);
                const proc = conn.process || 'System';
                entry.processes.set(proc, (entry.processes.get(proc) || 0) + 1);
                entry.totalConns += 1;
            }
        });

        return Array.from(locMap.values());
    }, [filteredConnections, locations]);

    // Hex Bin Data (Remote Locations)
    // We use uniqueLocations as the data source and map 'weight' to connection count
    const hexData = useMemo(() => {
        return uniqueLocations.map(loc => {
            const sortedProcs = [...loc.processes.entries()].sort((a, b) => b[1] - a[1]);
            const topProc = sortedProcs[0]?.[0] || 'Unknown';
            return {
                lat: loc.lat,
                lng: loc.lon,
                weight: loc.totalConns,
                city: loc.city,
                country: loc.country,
                processes: loc.processes,
                topProcess: topProc
            };
        });
    }, [uniqueLocations]);

    // Rings Data (Security / Threats)
    // Mock logic: Flag IPs from specific "suspicious" countries or random check for demo
    const ringsData = useMemo(() => {
        return uniqueLocations
            .filter(loc => {
                // Mock Threat Intelligence: Flag "Russia", "China", or "Unknown" for demo (or specific IPs)
                // In production, check `loc.ips` against a threat set.
                // For visual V2 demo, let's flag any location with > 10 connections as "High Activity" (Yellow)
                // And specific countries as "Threat" (Red)
                // Note: This is just for visualization V2.
                return loc.totalConns > 20 || ['Russia', 'China', 'North Korea'].includes(loc.country);
            })
            .map(loc => ({
                lat: loc.lat,
                lng: loc.lon,
                maxR: 5,
                propagationSpeed: 2,
                repeatPeriod: 1000,
                color: ['Russia', 'China', 'North Korea'].includes(loc.country) ? 'rgba(239, 68, 68, 0.8)' : 'rgba(234, 179, 8, 0.8)' // Red vs Yellow
            }));
    }, [uniqueLocations]);

    // Arcs for Data Travel Direction & Volume
    const arcsData = useMemo(() => {
        if (!myLocation) return [];

        // Flatten connections to Arcs? Or Group by Location?
        // Grouping by location is better for performance.
        return uniqueLocations.map(loc => {
            // Heuristic for bandwidth/speed (mock since we don't have per-conn bytes yet)
            // Use connection count as a proxy for "activity volume" for now
            const isHeavy = loc.totalConns > 5;
            const isUpload = Math.random() > 0.7; // Mock direction (needs real data in V2.1)

            return {
                startLat: isUpload ? myLocation.lat : loc.lat,
                startLng: isUpload ? myLocation.lon : loc.lon,
                endLat: isUpload ? loc.lat : myLocation.lat,
                endLng: isUpload ? loc.lon : myLocation.lon,
                color: isUpload ? ['#f59e0b', '#ef4444'] : ['#10b981', '#3b82f6'], // Orange->Red (Up), Green->Blue (Down)
                dashLength: isHeavy ? 0.6 : 0.2, // Longer dash for heavy traffic
                dashGap: isHeavy ? 0.2 : 0.4,
                animateTime: isHeavy ? 1000 : 3000, // Faster for heavy
            };
        });
    }, [uniqueLocations, myLocation]);

    // Labels for Hexes (Top Process)
    const labelsData = useMemo(() => {
        return uniqueLocations.map(loc => {
            const sortedProcs = [...loc.processes.entries()].sort((a, b) => b[1] - a[1]);
            const topProc = sortedProcs[0]?.[0] || 'Unknown';
            return {
                lat: loc.lat,
                lng: loc.lon,
                text: topProc,
                size: 1.2
            }
        });
    }, [uniqueLocations]);

    const handlePointClick = useCallback((point: any) => {
        if (globeRef.current) {
            globeRef.current.pointOfView({
                lat: point.lat,
                lng: point.lng,
                altitude: 1.5
            }, 1500);
        }
    }, []);

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
        <Card
            title="Global Intel"
            icon={GlobeIcon}
            className="h-full flex flex-col overflow-hidden p-0 relative"
        >
            {/* Filter Checkbox / Input */}
            <div className="absolute top-4 right-14 z-10 flex items-center bg-slate-900/80 backdrop-blur rounded-lg border border-slate-700 p-1">
                <input
                    type="text"
                    placeholder="Filter Process..."
                    className="bg-transparent border-none text-xs text-white placeholder-slate-500 focus:ring-0 w-32 px-2"
                    value={filterProcess}
                    onChange={(e) => setFilterProcess(e.target.value)}
                />
            </div>

            <div id="globe-container" className="flex-1 relative bg-slate-950/50 rounded-b-3xl overflow-hidden">
                <MemoizedGlobe
                    ref={globeRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    // Offline Asset
                    globeImageUrl="assets/earth-night.jpg"

                    // Hex Binning (Replaces simple Points)
                    hexBinPointsData={hexData}
                    hexBinPointWeight="weight"
                    hexBinResolution={4}
                    hexMargin={0.2}
                    hexTopColor={() => '#10b981'} // Emerald Top
                    hexSideColor={() => '#064e3b'} // Dark Emerald Side
                    hexBinMerge={true}
                    onHexClick={handlePointClick}
                    onHexHover={(bin: any) => {
                        if (!bin) {
                            setHoveredPoint(null);
                            return;
                        }
                        // bin.points contains the array of original data objects in this hex
                        // Optimize: Find the heaviest point in the bin to show its Top Process
                        const sortedPoints = bin.points.sort((a: any, b: any) => b.weight - a.weight);
                        const mainPoint = sortedPoints[0];
                        const totalConns = bin.sumWeight;

                        // Use pre-calculated topProcess from the main point
                        const topProc = mainPoint.topProcess || 'Unknown';

                        // Count unique processes across all points in bin (approximation for Speed)
                        // Or just use the number of locations merged
                        const mergedCount = bin.points.length;
                        const extraCount = mergedCount > 1 ? ` +${mergedCount - 1} locs` : '';

                        setHoveredPoint({
                            lat: mainPoint.lat,
                            lng: mainPoint.lng,
                            city: mainPoint.city,
                            country: mainPoint.country,
                            connCount: totalConns,
                            labelText: `${topProc}${extraCount}`,
                            type: 'remote',
                            size: 0, // unused for hover
                            color: '', // unused for hover
                        });
                    }}

                    // Security Rings
                    ringsData={ringsData}
                    ringColor="color"
                    ringMaxRadius="maxR"
                    ringPropagationSpeed="propagationSpeed"
                    ringRepeatPeriod="repeatPeriod"

                    // Atmosphere
                    atmosphereColor="#3b82f6"
                    atmosphereAltitude={0.15}

                    // Arcs - Traffic Flow
                    arcsData={arcsData}
                    arcColor="color"
                    arcDashLength="dashLength"
                    arcDashGap="dashGap"
                    arcDashAnimateTime="animateTime"
                    arcStroke={0.5}

                    // Labels - Filter to Top 5 heaviest to avoid clutter
                    labelsData={labelsData.slice(0, 5)}
                    labelLat="lat"
                    labelLng="lng"
                    labelText="text"
                    labelSize="size"
                    labelDotRadius={0.4}
                    labelColor={() => 'rgba(255, 255, 255, 0.75)'}
                    labelResolution={2}

                    backgroundColor="rgba(0,0,0,0)"
                    // Performance settings
                    rendererConfig={{
                        powerPreference: "default",
                        antialias: true,
                        alpha: true,
                    }}
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
                        <p className="text-xl font-bold text-sky-400">{filteredConnections.length}</p>
                    </div>
                </div>
            </div>
        </Card>
    )
}
