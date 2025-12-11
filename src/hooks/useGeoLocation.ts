import { useState, useEffect, useRef } from 'react'

interface GeoLocation {
  lat: number
  lon: number
  country: string
  city: string
  ip: string
}

// Global cache to persist across component unmounts/remounts
const GLOBAL_IP_CACHE = new Map<string, GeoLocation | null>();

export function useGeoLocation(ips: string[]) {
  // Initialize state with whatever is already in the global cache
  const [locations, setLocations] = useState<Map<string, GeoLocation>>(() => {
    const initialMap = new Map<string, GeoLocation>();
    GLOBAL_IP_CACHE.forEach((val, key) => {
      if (val) initialMap.set(key, val);
    });
    return initialMap;
  });

  // Keep track of which IPs we are currently fetching to avoid duplicate requests
  const pendingRequests = useRef<Set<string>>(new Set());

  useEffect(() => {
    const resolveIps = async () => {
      const ipsToFetch: string[] = [];

      // Identify IPs that are not in cache and not currently being fetched
      for (const ip of ips) {
        if (
          ip === '127.0.0.1' || 
          ip === '::1' || 
          ip.startsWith('192.168.') || 
          ip.startsWith('10.') ||
          ip.startsWith('172.16.') || // Docker/Private
          ip.startsWith('172.17.') ||
          ip.startsWith('172.18.') ||
          ip.startsWith('172.19.') ||
          ip.startsWith('172.2') ||
          ip.startsWith('172.30.') ||
          ip.startsWith('172.31.')
        ) {
          continue;
        }

        if (!GLOBAL_IP_CACHE.has(ip) && !pendingRequests.current.has(ip)) {
          ipsToFetch.push(ip);
          pendingRequests.current.add(ip);
        }
      }

      if (ipsToFetch.length === 0) return;

      try {
        // Batch request to Main process
        const results = await window.ipcRenderer.getIpLocations(ipsToFetch);
        
        let hasNewValidLocations = false;
        const newLocationsMap = new Map(locations);

        Object.entries(results).forEach(([ip, loc]) => {
          if (loc) {
            const geoLoc = { ...loc, ip };
            GLOBAL_IP_CACHE.set(ip, geoLoc);
            newLocationsMap.set(ip, geoLoc);
            hasNewValidLocations = true;
          } else {
            // Mark as null in cache so we don't retry
            GLOBAL_IP_CACHE.set(ip, null);
          }
          pendingRequests.current.delete(ip);
        });

        if (hasNewValidLocations) {
          setLocations(newLocationsMap);
        }
      } catch (error) {
        console.error(`Failed to resolve IPs`, error);
        // Clear pending status on error so we might retry later
        ipsToFetch.forEach(ip => pendingRequests.current.delete(ip));
      }
    };

    if (ips.length > 0) {
      // Debounce slightly to allow array to settle if it's changing rapidly
      const timer = setTimeout(resolveIps, 500);
      return () => clearTimeout(timer);
    }
  }, [ips, locations]);

  return { locations: Array.from(locations.values()) }
}
