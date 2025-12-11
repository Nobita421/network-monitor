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

    // Enable Auto-Rotation
    useEffect(() => {
        if (globeRef.current) {
            globeRef.current.controls().autoRotate = true;
            globeRef.current.controls().autoRotateSpeed = 0.5;
            globeRef.current.pointOfView({ altitude: 2.5 });
        }
    }, [isVisible]);

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

    const { locations } = useGeoLocation(uniqueIps)

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
            name: `${loc.city}, ${loc.country} (${loc.ips.length} IPs)`
        }))
    }, [uniqueLocations])

    const ringsData = useMemo(() => {
        return uniqueLocations.map(loc => ({
            lat: loc.lat,
            lng: loc.lon,
            maxR: 5 + Math.min(loc.ips.length, 5), // Larger rings for busy locations
            propagationSpeed: 2,
            repeatPeriod: 1000
        }))
    }, [uniqueLocations])

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
                    pointsData={gData}
                    pointAltitude={0.01}
                    pointColor="color"
                    pointRadius="size"
                    pointLabel="name"

                    // Atmosphere - Cyber Glow
                    atmosphereColor="#3b82f6" // Blue-500
                    atmosphereAltitude={0.2}

                    // Rings - Active Pulses
                    ringsData={ringsData}
                    ringColor={() => '#10b981'}
                    ringMaxRadius="maxR"
                    ringPropagationSpeed="propagationSpeed"
                    ringRepeatPeriod="repeatPeriod"

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
                <div className="absolute bottom-4 left-4 bg-slate-900/80 p-3 rounded-lg backdrop-blur border border-slate-700/50 pointer-events-none">
                    <p className="text-xs text-slate-400">Active Locations</p>
                    <p className="text-xl font-bold text-emerald-400">{uniqueLocations.length}</p>
                </div>
            </div>
        </Card>
    )
}
