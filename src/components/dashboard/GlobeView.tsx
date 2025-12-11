import { useMemo, useState, useEffect, memo, useRef } from 'react'
import Globe from 'react-globe.gl'
import { Globe as GlobeIcon } from 'lucide-react'
import { Card } from '../ui/Card'
import { Connection } from '../../types'
import { useGeoLocation } from '../../hooks/useGeoLocation'

interface GlobeViewProps {
    connections: Connection[]
}

// Memoize the Globe component to prevent re-renders when parent updates but props are same
const MemoizedGlobe = memo(Globe);

export function GlobeView({ connections }: GlobeViewProps) {
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
    const [isVisible, setIsVisible] = useState(true);
    const globeRef = useRef<any>(undefined);

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

    // Group locations by coordinates to avoid stacked points and incorrect "Locations" count
    const uniqueLocations = useMemo(() => {
        const locMap = new Map<string, { lat: number, lon: number, city: string, country: string, ips: string[] }>();

        locations.forEach(loc => {
            const key = `${loc.lat.toFixed(4)},${loc.lon.toFixed(4)}`; // Round to 4 decimals to group close points
            if (!locMap.has(key)) {
                locMap.set(key, { ...loc, ips: [loc.ip] });
            } else {
                locMap.get(key)?.ips.push(loc.ip);
            }
        });

        return Array.from(locMap.values());
    }, [locations]);

    const gData = useMemo(() => {
        return uniqueLocations.map(loc => ({
            lat: loc.lat,
            lng: loc.lon,
            size: 0.1 + (Math.min(loc.ips.length, 5) * 0.05), // Scale size slightly by count
            color: '#10b981', // Emerald 500
            name: `<b>${loc.city}, ${loc.country}</b><br/>${loc.ips.length} Connections`
        }))
    }, [uniqueLocations])



    // Arcs for Data Travel Direction
    const arcsData = useMemo(() => {
        if (!myLocation) return [];
        return uniqueLocations.flatMap(loc => {
            // Visualize flows. Ideally we'd know if a specific IP was Rx or Tx.
            // For now, let's assume 'Rx' (Incoming) is dominant for monitoring (downloading stuff).
            // We can show TWO arcs if we want, or just one green one coming IN.
            // Let's simulate: Green Arcs = Incoming (Remote -> Me)
            return [{
                startLat: loc.lat,
                startLng: loc.lon,
                endLat: myLocation.lat,
                endLng: myLocation.lon,
                color: '#10b981', // Emerald (Download)
                dashLength: 0.4,
                dashGap: 0.2,
                animateTime: 2000 // Speed
            }];
        })
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

                    // Points (Cities)
                    pointsData={gData}
                    pointAltitude={0.01}
                    pointColor="color"
                    pointRadius="size"
                    pointLabel="name" // HTML Tooltip

                    // Atmosphere - Cyber Glow
                    atmosphereColor="#3b82f6"
                    atmosphereAltitude={0.2}



                    // Arcs - Traffic Flow
                    arcsData={arcsData}
                    arcColor="color"
                    arcDashLength="dashLength"
                    arcDashGap="dashGap"
                    arcDashAnimateTime="animateTime"
                    // arcStroke={0.5}

                    // Labels - Persistent City Names
                    labelsData={uniqueLocations}
                    labelLat="lat"
                    labelLng="lon"
                    labelText={(d: any) => `${d.city} (${d.ips.length})`}
                    labelSize={1.5}
                    labelDotRadius={0.5}
                    labelColor={() => 'rgba(255, 255, 255, 0.75)'}
                    labelResolution={2}

                    backgroundColor="rgba(0,0,0,0)"
                    // Performance settings
                    rendererConfig={{
                        powerPreference: "default",
                        antialias: true,
                        alpha: true,
                        pixelRatio: Math.min(2, window.devicePixelRatio) // Cap at 2x to prevent 4K overload
                    }}
                    pointsMerge={true} // Improve performance for many points
                />

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
