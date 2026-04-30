import { useMemo, useState, useEffect, memo, useRef, useCallback } from 'react'
import Globe, { GlobeMethods } from 'react-globe.gl'
import { Globe as GlobeIcon, Activity, ExternalLink, Zap } from 'lucide-react'
import { Card } from '../ui/Card'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { Drawer } from '../ui/Drawer'
import type { Connection } from '../../types'
import { useGeoLocation } from '../../hooks/useGeoLocation'
import { isMappableConnection, normalizeIpAddress } from '../../lib/network'

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
    isp?: string;
    asn?: string;
    connCount: number;
    connections?: Connection[];
}

interface GlobeHexPoint {
    lat: number;
    lng: number;
    weight: number;
    city?: string;
    country?: string;
    isp?: string;
    asn?: string;
    topProcess?: string;
    connections?: Connection[];
}

interface GlobeHexBin {
    points: GlobeHexPoint[];
    sumWeight: number;
}

interface GlobeRing {
    lat: number;
    lng: number;
    maxR: number;
    propagationSpeed: number;
    repeatPeriod: number;
    color: string;
}

interface GlobeArc {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    color: [string, string];
    dashLength: number;
    dashGap: number;
    animateTime: number;
}

interface GlobeOrigin {
    lat: number;
    lon: number;
    label: string;
}

function isGlobeHexBin(value: unknown): value is GlobeHexBin {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as Partial<GlobeHexBin>
    return Array.isArray(candidate.points) && typeof candidate.sumWeight === 'number'
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

// Stable renderer config — defined outside component to avoid object recreation on every render
const RENDERER_CONFIG = {
    powerPreference: 'low-power' as const,
    antialias: false,   // disable MSAA to reduce GPU load
    alpha: false,
    stencil: false,
    depth: true,
} as const

const MAX_ARCS = 50
const MAX_RINGS = 50

const TIMEZONE_ORIGINS: { match: RegExp; origin: GlobeOrigin }[] = [
    { match: /^Asia\/(Calcutta|Kolkata)$/i, origin: { lat: 20.5937, lon: 78.9629, label: 'India timezone estimate' } },
    { match: /^Asia\//i, origin: { lat: 1.3521, lon: 103.8198, label: 'Asia timezone estimate' } },
    { match: /^Europe\//i, origin: { lat: 50.1109, lon: 8.6821, label: 'Europe timezone estimate' } },
    { match: /^America\/(New_York|Detroit|Toronto|Montreal|Indiana|Kentucky)/i, origin: { lat: 39.8283, lon: -98.5795, label: 'North America timezone estimate' } },
    { match: /^America\//i, origin: { lat: 39.8283, lon: -98.5795, label: 'Americas timezone estimate' } },
    { match: /^Australia\//i, origin: { lat: -25.2744, lon: 133.7751, label: 'Australia timezone estimate' } },
]

function getTimezoneOrigin(): GlobeOrigin {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const matched = TIMEZONE_ORIGINS.find(({ match }) => match.test(timezone))
    return matched?.origin ?? { lat: 0, lon: 0, label: 'Timezone unavailable' }
}

function getVisibleArcStart(origin: GlobeOrigin, endLat: number, endLng: number) {
    const nearSamePoint = Math.abs(origin.lat - endLat) < 0.25 && Math.abs(origin.lon - endLng) < 0.25
    if (!nearSamePoint) return { lat: origin.lat, lon: origin.lon }
    return { lat: origin.lat, lon: ((origin.lon + 12 + 540) % 360) - 180 }
}

const MemoizedGlobe = memo(Globe)

export function GlobeView({ connections }: GlobeViewProps) {
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
    const [isVisible, setIsVisible] = useState(document.visibilityState === 'visible')
    const globeRef = useRef<GlobeMethods | undefined>(undefined)
    const containerRef = useRef<HTMLDivElement | null>(null)

    const [hoveredPoint, setHoveredPoint] = useState<GlobePoint | null>(null)
    const [selectedHex, setSelectedHex] = useState<GlobePoint | null>(null)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [processToKill, setProcessToKill] = useState<{ pid: number; name: string } | null>(null)
    const [filterProcess, setFilterProcess] = useState('')

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(document.visibilityState === 'visible')
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [])

    const mappableConnections = useMemo(() => {
        return connections.filter(isMappableConnection)
    }, [connections])

    const uniqueIps = useMemo(() => {
        const ips = new Set<string>()
        mappableConnections.forEach(c => {
            ips.add(normalizeIpAddress(c.peerAddress))
        })
        return Array.from(ips)
    }, [mappableConnections])

    const { locations, isLoading } = useGeoLocation(uniqueIps)

    const filteredConnections = useMemo(() => {
        if (!filterProcess) return mappableConnections
        const q = filterProcess.toLowerCase()
        return mappableConnections.filter(c => (c.process || '').toLowerCase().includes(q))
    }, [mappableConnections, filterProcess])

    const uniqueLocations = useMemo(() => {
        const locMap = new Map<string, {
            lat: number; lon: number; city: string; country: string;
            isp: string; asn: string; ips: Set<string>;
            processes: Map<string, number>; totalConns: number; rawData: Connection[]
        }>()

        const ipToGeo = new Map(locations.map(l => [l.ip, l]))

        filteredConnections.forEach(conn => {
            const peerAddress = normalizeIpAddress(conn.peerAddress)
            const geo = ipToGeo.get(peerAddress)
            if (!geo) return

            const lat = toFiniteNumber(geo.lat)
            const lon = toFiniteNumber(geo.lon)
            if (lat === null || lon === null) return

            const key = `${lat.toFixed(4)},${lon.toFixed(4)}`
            if (!locMap.has(key)) {
                locMap.set(key, {
                    lat, lon,
                    city: geo.city, country: geo.country,
                    isp: geo.isp || 'Unknown ISP', asn: geo.asn || '',
                    ips: new Set([peerAddress]),
                    processes: new Map([[conn.process || 'System', 1]]),
                    totalConns: 1, rawData: [conn]
                })
            } else {
                const entry = locMap.get(key)!
                entry.ips.add(peerAddress)
                const proc = conn.process || 'System'
                entry.processes.set(proc, (entry.processes.get(proc) || 0) + 1)
                entry.totalConns += 1
                entry.rawData.push(conn)
            }
        })

        return Array.from(locMap.values())
    }, [filteredConnections, locations])

    const hexData = useMemo(() => {
        return uniqueLocations.map(loc => {
            const sortedProcs = [...loc.processes.entries()].sort((a, b) => b[1] - a[1])
            return {
                lat: loc.lat, lng: loc.lon, weight: loc.totalConns,
                city: loc.city, country: loc.country,
                isp: loc.isp, asn: loc.asn,
                topProcess: sortedProcs[0]?.[0] || 'Unknown',
                connections: loc.rawData
            }
        })
    }, [uniqueLocations])

    const [rings, setRings] = useState<GlobeRing[]>([])
    const prevLocationsRef = useRef<Map<string, number>>(new Map())

    useEffect(() => {
        const handler = setTimeout(() => {
            const newRings: GlobeRing[] = []
            const currentMap = new Map<string, number>()

            uniqueLocations.forEach(loc => {
                const key = `${loc.lat},${loc.lon}`
                currentMap.set(key, loc.totalConns)
                const prevCount = prevLocationsRef.current.get(key) || 0

                if (prevCount < loc.totalConns) {
                    const isThreat = ['Russia', 'China', 'North Korea'].includes(loc.country)
                    newRings.push({
                        lat: loc.lat, lng: loc.lon,
                        maxR: 8, propagationSpeed: 4, repeatPeriod: 800,
                        color: isThreat ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)'
                    })
                } else if (loc.totalConns > 0) {
                    newRings.push({
                        lat: loc.lat, lng: loc.lon,
                        maxR: 3, propagationSpeed: 1, repeatPeriod: 2000,
                        color: 'rgba(56, 189, 248, 0.3)'
                    })
                }
            })

            // Cap rings to avoid GPU overload
            setRings(newRings.slice(0, MAX_RINGS))
            prevLocationsRef.current = currentMap
        }, 100)

        return () => clearTimeout(handler)
    }, [uniqueLocations])

    // Use a stable home point: if we have a myLocation (centroid), use it,
    // otherwise fall back to a sensible default so arcs always render.
    // The home point represents "us" — start of every arc.
    const homePoint = useMemo(() => getTimezoneOrigin(), [])

    const arcsData = useMemo<GlobeArc[]>(() => {
        if (uniqueLocations.length === 0) return []

        // Cap to MAX_ARCS — sort by connection count desc so most active show first
        const sorted = [...uniqueLocations].sort((a, b) => b.totalConns - a.totalConns).slice(0, MAX_ARCS)

        return sorted.map((loc) => {
            const isHeavy = loc.totalConns > 5
            // Stable direction: high-connection locs are downloads, low are uploads
            const isUpload = loc.totalConns <= 2
            const start = getVisibleArcStart(homePoint, loc.lat, loc.lon)

            return {
                startLat: start.lat,
                startLng: start.lon,
                endLat: loc.lat,
                endLng: loc.lon,
                color: isUpload
                    ? ['rgba(251,191,36,0.9)', 'rgba(239,68,68,0.9)']
                    : ['rgba(16,185,129,0.9)', 'rgba(59,130,246,0.9)'],
                dashLength: isHeavy ? 0.55 : 0.25,
                dashGap: isHeavy ? 0.2 : 0.35,
                animateTime: isHeavy ? 1200 : 2600,
            }
        })
    }, [homePoint, uniqueLocations])

    const labelsData = useMemo(() => {
        return [...uniqueLocations]
            .sort((a, b) => b.totalConns - a.totalConns)
            .slice(0, 5)
            .map(loc => {
                const topProc = [...loc.processes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
                return { lat: loc.lat, lng: loc.lon, text: topProc, size: 1.2 }
            })
    }, [uniqueLocations])

    const originPoint = useMemo(() => [{
        lat: homePoint.lat,
        lng: homePoint.lon,
        label: homePoint.label,
    }], [homePoint])

    const diagnostics = useMemo(() => ({
        rawConnections: connections.length,
        mappableConnections: mappableConnections.length,
        filteredConnections: filteredConnections.length,
        uniqueIps: uniqueIps.length,
        geoResolved: locations.length,
        activeArcs: arcsData.length,
    }), [connections.length, mappableConnections.length, filteredConnections.length, uniqueIps.length, locations.length, arcsData.length])

    const handleHexClick = useCallback((hex: unknown) => {
        if (!isGlobeHexBin(hex) || !globeRef.current || hex.points.length === 0) return

        const normalizedPoints = hex.points
            .map((point) => ({ lat: toFiniteNumber(point.lat), lng: toFiniteNumber(point.lng), point }))
            .filter((entry): entry is { lat: number; lng: number; point: GlobeHexPoint } =>
                entry.lat !== null && entry.lng !== null
            )

        if (normalizedPoints.length === 0) return

        const centerLat = normalizedPoints.reduce((s, p) => s + p.lat, 0) / normalizedPoints.length
        const centerLng = normalizedPoints.reduce((s, p) => s + p.lng, 0) / normalizedPoints.length

        globeRef.current.pointOfView({ lat: centerLat, lng: centerLng, altitude: 1.5 }, 1500)

        const allConnections = normalizedPoints.flatMap((p) => p.point.connections || [])
        const sortedPoints = [...normalizedPoints].sort((a, b) => b.point.weight - a.point.weight)
        const mainPoint = sortedPoints[0].point

        setSelectedHex({
            lat: centerLat, lng: centerLng,
            city: mainPoint.city, country: mainPoint.country,
            isp: mainPoint.isp, asn: mainPoint.asn,
            connCount: hex.sumWeight,
            labelText: mainPoint.topProcess || 'Unknown',
            type: 'remote', size: 0, color: '',
            connections: allConnections
        })
        setIsDrawerOpen(true)
    }, [])

    const handleKillProcess = useCallback(async (pid?: number) => {
        if (!pid) return
        try {
            const success = await window.desktop.killProcess(pid)
            if (!success) {
                console.error(`Failed to kill ${pid}`)
                return
            }
            setProcessToKill(null)
        } catch (e) {
            console.error('IPC Kill Error', e)
        }
    }, [])

    const requestKillProcess = useCallback((connection: Connection) => {
        if (!Number.isInteger(connection.pid) || !connection.pid || connection.pid <= 0) return
        setProcessToKill({ pid: connection.pid, name: connection.process || 'System' })
    }, [])

    const handleGlobeReady = useCallback(() => {
        const globe = globeRef.current
        if (!globe) return

        globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))

        const controls = globe.controls()
        controls.autoRotate = false
        controls.enableDamping = false
    }, [])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        let rafId: number | null = null
        const updateSize = () => {
            if (rafId !== null) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => {
                rafId = null
                const width = Math.max(container.clientWidth, 320)
                const height = Math.max(container.clientHeight, 360)
                setDimensions({ width, height })
            })
        }

        updateSize()
        const resizeObserver = new ResizeObserver(updateSize)
        resizeObserver.observe(container)

        return () => {
            resizeObserver.disconnect()
            if (rafId !== null) cancelAnimationFrame(rafId)
        }
    }, [])

    // While tab is hidden, render a cheap placeholder to free GPU
    if (!isVisible) return <div className="h-full bg-slate-950/50" />

    return (
        <Card
            title="Global Intel"
            icon={GlobeIcon}
            className="h-full flex flex-col overflow-hidden p-0 relative"
        >
            <div className="absolute top-4 right-14 z-10 flex items-center bg-slate-900/80 backdrop-blur rounded-lg border border-slate-700 p-1">
                <input
                    type="text"
                    placeholder="Filter Process..."
                    className="bg-transparent border-none text-xs text-white placeholder-slate-500 focus:ring-0 w-32 px-2"
                    value={filterProcess}
                    onChange={(e) => setFilterProcess(e.target.value)}
                />
            </div>

            <div ref={containerRef} className="flex-1 min-h-[520px] relative bg-slate-950/50 rounded-b-3xl overflow-hidden">
                <MemoizedGlobe
                    ref={globeRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    globeImageUrl="/assets/earth-night.jpg"
                    onGlobeReady={handleGlobeReady}
                    globeCurvatureResolution={6}

                    hexBinPointsData={hexData}
                    hexBinPointWeight="weight"
                    hexBinResolution={3}
                    hexMargin={0.2}
                    hexTopCurvatureResolution={8}
                    hexTransitionDuration={300}
                    hexTopColor={() => '#10b981'}
                    hexSideColor={() => '#064e3b'}
                    hexBinMerge={true}
                    onHexClick={handleHexClick}
                    onHexHover={(bin: unknown) => {
                        if (!isGlobeHexBin(bin) || bin.points.length === 0) {
                            setHoveredPoint(null)
                            return
                        }

                        const normalizedPoints = bin.points
                            .map((point) => ({ lat: toFiniteNumber(point.lat), lng: toFiniteNumber(point.lng), point }))
                            .filter((entry): entry is { lat: number; lng: number; point: GlobeHexPoint } =>
                                entry.lat !== null && entry.lng !== null
                            )

                        if (normalizedPoints.length === 0) { setHoveredPoint(null); return }

                        const sortedPoints = [...normalizedPoints].sort((a, b) => b.point.weight - a.point.weight)
                        const mainPoint = sortedPoints[0].point

                        setHoveredPoint({
                            lat: sortedPoints[0].lat, lng: sortedPoints[0].lng,
                            city: mainPoint.city, country: mainPoint.country,
                            isp: mainPoint.isp || 'Unknown ISP', asn: mainPoint.asn,
                            connCount: bin.sumWeight,
                            labelText: `${mainPoint.topProcess || 'Unknown'}${
                                normalizedPoints.length > 1 ? ` +${normalizedPoints.length - 1} locs` : ''
                            }`,
                            type: 'remote', size: 0, color: '',
                        })
                    }}

                    ringsData={rings}
                    ringColor="color"
                    ringResolution={24}
                    ringMaxRadius="maxR"
                    ringPropagationSpeed="propagationSpeed"
                    ringRepeatPeriod="repeatPeriod"

                    pointsData={originPoint}
                    pointLat="lat"
                    pointLng="lng"
                    pointAltitude={0.02}
                    pointRadius={0.35}
                    pointResolution={12}
                    pointsTransitionDuration={0}
                    pointColor={() => '#fbbf24'}
                    pointLabel="label"

                    arcsData={arcsData}
                    arcColor={(arc: object) => (arc as GlobeArc).color}
                    arcDashLength="dashLength"
                    arcDashGap="dashGap"
                    arcDashAnimateTime="animateTime"
                    arcAltitude={0.3}
                    arcStroke={0.5}
                    arcCurveResolution={24}
                    arcCircularResolution={4}
                    arcsTransitionDuration={300}

                    atmosphereColor="#3b82f6"
                    atmosphereAltitude={0.15}

                    labelsData={labelsData}
                    labelLat="lat"
                    labelLng="lng"
                    labelText="text"
                    labelSize="size"
                    labelDotRadius={0.4}
                    labelColor={() => 'rgba(255, 255, 255, 0.75)'}
                    labelResolution={2}

                    backgroundColor="rgba(2,6,23,1)"
                    rendererConfig={RENDERER_CONFIG}
                />

                {hoveredPoint && (
                    <div className="absolute top-4 right-4 bg-slate-900/90 p-4 rounded-xl backdrop-blur-md border border-slate-700/50 shadow-2xl max-w-xs animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${
                                hoveredPoint.type === 'home' ? 'bg-blue-500' : 'bg-emerald-500'
                            } animate-pulse shadow-[0_0_10px_currentColor]`} />
                            <h4 className="font-bold text-white text-md">
                                {hoveredPoint.city || 'Unknown'}, {hoveredPoint.country || 'Unknown'}
                            </h4>
                        </div>
                        {hoveredPoint.type === 'remote' ? (
                            <div className="space-y-2">
                                <div>
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Top Process</div>
                                    <div className="text-sm font-bold text-emerald-400 font-mono break-all">
                                        {hoveredPoint.labelText.replace(/ \+\d+ locs$/, '')}
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
                                {hoveredPoint.isp && (
                                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                                        <div className="text-[10px] text-slate-500">PROVIDER</div>
                                        <div className="text-xs text-slate-200 font-medium truncate">{hoveredPoint.isp}</div>
                                        <div className="text-[10px] text-slate-500 font-mono">{hoveredPoint.asn}</div>
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
                )}

                {/* Empty / loading state overlay */}
                {connections.length > 0 && uniqueLocations.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.06] bg-slate-950/80 px-8 py-6 backdrop-blur-md text-center">
                            {isLoading ? (
                                <>
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-400" />
                                    <p className="text-sm font-semibold text-white">Resolving IP locations…</p>
                                    <p className="text-xs text-slate-500">
                                        {uniqueIps.length} IP{uniqueIps.length !== 1 ? 's' : ''} pending geo-lookup
                                    </p>
                                </>
                            ) : (
                                <>
                                    <span className="text-2xl">📡</span>
                                    <p className="text-sm font-semibold text-white">No mappable connections</p>
                                    <p className="text-xs text-slate-500">
                                        {uniqueIps.length === 0
                                            ? 'No active public peer connections are available to map.'
                                            : 'Geo-lookup returned no results for the active IPs.'}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="absolute bottom-4 left-4 flex gap-4 pointer-events-none">
                    <div className="bg-slate-900/80 p-3 rounded-lg backdrop-blur border border-slate-700/50">
                        <p className="text-xs text-slate-400">Active Locations</p>
                        <p className="text-xl font-bold text-emerald-400">{uniqueLocations.length}</p>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-lg backdrop-blur border border-slate-700/50">
                        <p className="text-xs text-slate-400">Mappable</p>
                        <p className="text-xl font-bold text-sky-400">{diagnostics.filteredConnections}</p>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-lg backdrop-blur border border-slate-700/50">
                        <p className="text-xs text-slate-400">Geo Hits</p>
                        <p className="text-xl font-bold text-amber-400">{diagnostics.geoResolved}/{diagnostics.uniqueIps}</p>
                    </div>
                    {arcsData.length > 0 && (
                        <div className="bg-slate-900/80 p-3 rounded-lg backdrop-blur border border-slate-700/50">
                            <p className="text-xs text-slate-400">Active Arcs</p>
                            <p className="text-xl font-bold text-violet-400">{arcsData.length}</p>
                        </div>
                    )}
                </div>

                <div className="absolute bottom-4 right-4 hidden max-w-[220px] gap-2 rounded-lg border border-slate-700/50 bg-slate-900/80 p-3 text-[10px] text-slate-400 backdrop-blur lg:grid">
                    <div className="flex justify-between gap-4">
                        <span>Raw sockets</span>
                        <span className="font-mono text-slate-200">{diagnostics.rawConnections}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span>Public peers</span>
                        <span className="font-mono text-slate-200">{diagnostics.mappableConnections}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span>Origin</span>
                        <span className="truncate text-right text-slate-200">{homePoint.label}</span>
                    </div>
                </div>
            </div>

            <Drawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title={selectedHex ? `${selectedHex.city}, ${selectedHex.country}` : 'Location Details'}
            >
                {selectedHex && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                                    <GlobeIcon size={12} /> NETWORK
                                </p>
                                <p className="text-sm font-semibold text-white truncate" title={selectedHex.isp}>
                                    {selectedHex.isp || 'Unknown ISP'}
                                </p>
                                <p className="text-xs text-slate-500 font-mono">{selectedHex.asn}</p>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                                    <Activity size={12} /> TRAFFIC
                                </p>
                                <p className="text-sm font-semibold text-emerald-400">{selectedHex.connCount} Active</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Active Connections</h3>
                            <div className="space-y-2">
                                {selectedHex.connections?.map((conn, idx) => (
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
                                                onClick={() => { requestKillProcess(conn) }}
                                                disabled={!Number.isInteger(conn.pid) || !conn.pid || conn.pid <= 0}
                                                title="Kill Process"
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

            <ConfirmationModal
                isOpen={Boolean(processToKill)}
                onClose={() => { setProcessToKill(null) }}
                onConfirm={() => { void handleKillProcess(processToKill?.pid) }}
                title="Kill Process?"
                message={`Are you sure you want to terminate "${processToKill?.name}" (PID: ${processToKill?.pid})? This action cannot be undone and might cause data loss if the application has unsaved work.`}
                confirmLabel="Kill Process"
                isDanger={true}
            />
        </Card>
    )
}
