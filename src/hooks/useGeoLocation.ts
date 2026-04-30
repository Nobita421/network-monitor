import { useState, useEffect, useRef, useMemo } from 'react'
import type { IpLocation } from '../lib/ipc'

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

// Module-level cache + pending set — shared across all renders/remounts
const GLOBAL_IP_CACHE = new Map<string, CachedGeoEntry>()
const PENDING_IPS     = new Set<string>()

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

  // Track IPs dispatched by the *current* effect invocation for scoped cleanup
  const dispatchedByThisEffect = useRef<string[]>([])

  useEffect(() => {
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
        if (!isFresh) GLOBAL_IP_CACHE.delete(ip)
        if (!isFresh && !PENDING_IPS.has(ip)) {
          ipsToFetch.push(ip)
          PENDING_IPS.add(ip)
        }
      }

      if (ipsToFetch.length === 0) {
        // All cached — no network call needed
        setIsLoading(false)
        return
      }

      dispatchedByThisEffect.current = ipsToFetch
      setIsLoading(true)

      try {
        const results = await window.desktop.getIpLocations(ipsToFetch)
        const cacheNow = Date.now()

        setLocations((prev) => {
          const next = new Map(prev)
          let changed = false
          Object.entries(results).forEach(([ip, loc]) => {
            if (loc) {
              const geoLoc: GeoLocation = { ...loc, ip }
              GLOBAL_IP_CACHE.set(ip, { location: geoLoc, expiresAt: cacheNow + POSITIVE_CACHE_TTL_MS })
              next.set(ip, geoLoc)
              changed = true
            } else {
              // Null = known IP with no geo data (CDN, private ASN, etc.)
              GLOBAL_IP_CACHE.set(ip, { location: null, expiresAt: cacheNow + NEGATIVE_CACHE_TTL_MS })
            }
          })
          return changed ? next : prev
        })
      } catch (error) {
        console.error('Failed to resolve IPs:', error)
      } finally {
        for (const ip of ipsToFetch) PENDING_IPS.delete(ip)
        dispatchedByThisEffect.current = []
        setIsLoading(false)
      }
    }

    const timer = setTimeout(() => { void resolveIps() }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      // Only release IPs whose fetch hasn't started yet (timer was cancelled)
      for (const ip of dispatchedByThisEffect.current) PENDING_IPS.delete(ip)
      dispatchedByThisEffect.current = []
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
