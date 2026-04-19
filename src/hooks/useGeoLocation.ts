import { useState, useEffect, useRef, useMemo } from 'react'
import { isPrivateOrLocalIp } from '../lib/network'
import type { IpLocation } from '../lib/ipc'

interface GeoLocation extends IpLocation {
  ip: string
}

interface CachedGeoEntry {
  location: GeoLocation | null
  expiresAt: number
}

const POSITIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000

const GLOBAL_IP_CACHE = new Map<string, CachedGeoEntry>()

export function useGeoLocation(ips: string[]) {
  const [locations, setLocations] = useState<Map<string, GeoLocation>>(() => {
    const now = Date.now()
    const initialMap = new Map<string, GeoLocation>()
    GLOBAL_IP_CACHE.forEach((entry, key) => {
      if (entry.expiresAt <= now) {
        GLOBAL_IP_CACHE.delete(key)
        return
      }

      if (entry.location) {
        initialMap.set(key, entry.location)
      }
    })
    return initialMap
  })

  const pendingRequests = useRef<Set<string>>(new Set())

  useEffect(() => {
    const now = Date.now()
    const requestedIps = ips.filter((ip) => !isPrivateOrLocalIp(ip))

    setLocations((prev) => {
      const next = new Map(prev)
      let changed = false

      for (const ip of requestedIps) {
        const cachedEntry = GLOBAL_IP_CACHE.get(ip)
        if (!cachedEntry) {
          continue
        }

        if (cachedEntry.expiresAt <= now) {
          GLOBAL_IP_CACHE.delete(ip)
          if (next.delete(ip)) {
            changed = true
          }
          continue
        }

        if (cachedEntry.location && !next.has(ip)) {
          next.set(ip, cachedEntry.location)
          changed = true
        }
      }

      return changed ? next : prev
    })

    const resolveIps = async () => {
      const ipsToFetch: string[] = []
      const scanNow = Date.now()

      for (const ip of ips) {
        if (isPrivateOrLocalIp(ip)) {
          continue
        }

        const cachedEntry = GLOBAL_IP_CACHE.get(ip)
        const isCacheFresh = Boolean(cachedEntry && cachedEntry.expiresAt > scanNow)

        if (!isCacheFresh) {
          GLOBAL_IP_CACHE.delete(ip)
        }

        if (!isCacheFresh && !pendingRequests.current.has(ip)) {
          ipsToFetch.push(ip)
          pendingRequests.current.add(ip)
        }
      }

      if (ipsToFetch.length === 0) return

      try {
        const results = await window.desktop.getIpLocations(ipsToFetch)
        const cacheNow = Date.now()

        setLocations((prev) => {
          const next = new Map(prev)
          let changed = false

          Object.entries(results).forEach(([ip, loc]) => {
            if (loc) {
              const geoLoc: GeoLocation = { ...loc, ip }
              GLOBAL_IP_CACHE.set(ip, {
                location: geoLoc,
                expiresAt: cacheNow + POSITIVE_CACHE_TTL_MS,
              })
              next.set(ip, geoLoc)
              changed = true
            } else {
              GLOBAL_IP_CACHE.set(ip, {
                location: null,
                expiresAt: cacheNow + NEGATIVE_CACHE_TTL_MS,
              })
            }

            pendingRequests.current.delete(ip)
          })

          return changed ? next : prev
        })
      } catch (error) {
        console.error('Failed to resolve IPs', error)
        ipsToFetch.forEach((ip) => pendingRequests.current.delete(ip))
      }
    }

    if (ips.length > 0) {
      const timer = setTimeout(() => {
        void resolveIps()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [ips])

  const locationList = useMemo(() => Array.from(locations.values()), [locations])

  const myLocation = useMemo<GeoLocation | null>(() => {
    if (locationList.length === 0) {
      return null
    }

    const averaged = locationList.reduce(
      (accumulator, location) => {
        accumulator.lat += location.lat
        accumulator.lon += location.lon
        return accumulator
      },
      { lat: 0, lon: 0 },
    )

    return {
      lat: averaged.lat / locationList.length,
      lon: averaged.lon / locationList.length,
      city: 'Approximate Origin',
      country: 'Local Estimate',
      ip: 'self',
    }
  }, [locationList])

  return { locations: locationList, myLocation }
}
