import { useState, useEffect, useRef, useMemo } from 'react'
import { getDesktop, invokeWithTimeout, type IpLocation } from '../lib/ipc'

interface GeoLocation extends IpLocation {
  ip: string
}

interface CachedGeoEntry {
  location: GeoLocation | null
  expiresAt: number
}

const POSITIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const NEGATIVE_CACHE_TTL_MS =  5 * 60 * 1000
const DEBOUNCE_MS            = 800
const MAX_CACHE_ENTRIES      = 2000

// Module-level cache — shared across all renders/remounts. A cache miss is
// fetched by the current mount; in-flight deduplication would leave a
// remounted consumer waiting on a request whose owner has unmounted.
const GLOBAL_IP_CACHE = new Map<string, CachedGeoEntry>()

function rememberCacheEntry(ip: string, entry: CachedGeoEntry) {
  GLOBAL_IP_CACHE.delete(ip)
  GLOBAL_IP_CACHE.set(ip, entry)

  while (GLOBAL_IP_CACHE.size > MAX_CACHE_ENTRIES) {
    const oldest = GLOBAL_IP_CACHE.keys().next()
    if (oldest.done) break
    GLOBAL_IP_CACHE.delete(oldest.value)
  }
}

export function useGeoLocation(ips: string[]) {
  const [locations,  setLocations]  = useState<Map<string, GeoLocation>>(() => {
    const now = Date.now()
    const map = new Map<string, GeoLocation>()
    GLOBAL_IP_CACHE.forEach((entry, key) => {
      if (entry.expiresAt <= now) { GLOBAL_IP_CACHE.delete(key); return }
      if (entry.location) map.set(key, entry.location)
    })
    return map
  })

  const [isLoading, setIsLoading] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const isCurrent = () => requestId === requestIdRef.current

    if (ips.length === 0) {
      setIsLoading(false)
      return
    }

    const now = Date.now()

    // Seed locations from cache immediately (synchronous)
    setLocations((prev) => {
      const next = new Map(prev)
      let changed = false
      for (const ip of ips) {
        const entry = GLOBAL_IP_CACHE.get(ip)
        if (!entry) continue
        if (entry.expiresAt <= now) { GLOBAL_IP_CACHE.delete(ip); continue }
        if (entry.location && !next.has(ip)) { next.set(ip, entry.location); changed = true }
      }
      return changed ? next : prev
    })

    const resolveIps = async () => {
      const ipsToFetch: string[] = []
      const scanNow = Date.now()

      for (const ip of ips) {
        const entry = GLOBAL_IP_CACHE.get(ip)
        const isFresh = Boolean(entry && entry.expiresAt > scanNow)
        if (!isFresh) {
          GLOBAL_IP_CACHE.delete(ip)
          ipsToFetch.push(ip)
        }
      }

      if (ipsToFetch.length === 0) {
        // All cached — no network call needed
        if (isCurrent()) setIsLoading(false)
        return
      }

      if (isCurrent()) setIsLoading(true)

      try {
        const desktop = getDesktop()
        if (!desktop) return
        const results = await invokeWithTimeout(() => desktop.getIpLocations(ipsToFetch))
        const cacheNow = Date.now()

        setLocations((prev) => {
          const next = new Map(prev)
          let changed = false
          Object.entries(results).forEach(([ip, loc]) => {
            if (loc) {
              const geoLoc: GeoLocation = { ...loc, ip }
              rememberCacheEntry(ip, {
                location: geoLoc,
                expiresAt: cacheNow + POSITIVE_CACHE_TTL_MS,
              })
              next.set(ip, geoLoc)
              changed = true
            } else {
              // Null = known IP with no geo data (CDN, private ASN, etc.)
              rememberCacheEntry(ip, {
                location: null,
                expiresAt: cacheNow + NEGATIVE_CACHE_TTL_MS,
              })
            }
          })
          return changed ? next : prev
        })
      } catch (error) {
        console.error('Failed to resolve IPs:', error)
      } finally {
        if (isCurrent()) setIsLoading(false)
      }
    }

    const timer = setTimeout(() => { void resolveIps() }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [ips])

  const locationList = useMemo(() => Array.from(locations.values()), [locations])

  const myLocation = useMemo<GeoLocation | null>(() => {
    if (locationList.length === 0) return null
    const sum = locationList.reduce(
      (acc, loc) => { acc.lat += loc.lat; acc.lon += loc.lon; return acc },
      { lat: 0, lon: 0 },
    )
    return {
      lat: sum.lat / locationList.length,
      lon: sum.lon / locationList.length,
      city: 'Approximate Origin',
      country: 'Local Estimate',
      ip: 'self',
    }
  }, [locationList])

  return {
    locations: locationList,
    myLocation,
    /** True while a geo-lookup fetch is in-flight */
    isLoading,
  }
}
