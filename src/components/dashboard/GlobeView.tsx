import { useMemo, useState, useEffect, memo } from 'react'
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

    // Optimization: Pause rendering if not visible (e.g. tab switch)
    // This requires the parent to unmount or hide us, but we can also check visibility API
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

    const { locations } = useGeoLocation(uniqueIps)

    const gData = useMemo(() => {
        return locations.map(loc => ({
            lat: loc.lat,
            lng: loc.lon,
            size: 0.5,
            color: '#10b981', // Emerald 500
            name: `${loc.city}, ${loc.country} (${loc.ip})`
        }))
    }, [locations])

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
                    width={dimensions.width}
                    height={dimensions.height}
                    globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                    pointsData={gData}
                    pointAltitude={0.01}
                    pointColor="color"
                    pointRadius="size"
                    pointLabel="name"
                    atmosphereColor="#3b82f6"
                    atmosphereAltitude={0.15}
                    backgroundColor="rgba(0,0,0,0)"
                    // Performance settings: 'default' allows the OS to choose the power efficient GPU (iGPU)
                    rendererConfig={{ powerPreference: "default", antialias: false, alpha: true }}
                />
                <div className="absolute bottom-4 left-4 bg-slate-900/80 p-3 rounded-lg backdrop-blur border border-slate-700/50">
                    <p className="text-xs text-slate-400">Active Locations</p>
                    <p className="text-xl font-bold text-emerald-400">{locations.length}</p>
                </div>
            </div>
        </Card>
    )
}
