import { useState, useEffect } from 'react'

interface GeoLocation {
  lat: number
  lon: number
  country: string
  city: string
  ip: string
}

export function useGeoLocation(ips: string[]) {
  const [locations, setLocations] = useState<Map<string, GeoLocation>>(new Map())

  useEffect(() => {
    const resolveIps = async () => {
      const newLocations = new Map(locations)
      let hasChanges = false

      for (const ip of ips) {
        if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) continue
        if (newLocations.has(ip)) continue

        try {
          const loc = await window.ipcRenderer.getIpLocation(ip)
          if (loc) {
            newLocations.set(ip, { ...loc, ip })
            hasChanges = true
          }
        } catch (error) {
          console.error(`Failed to resolve IP ${ip}`, error)
        }
      }

      if (hasChanges) {
        setLocations(newLocations)
      }
    }

    if (ips.length > 0) {
      resolveIps()
    }
  }, [ips]) // Dependency on ips array. In a real app, we might want to debounce this.

  return { locations: Array.from(locations.values()) }
}
