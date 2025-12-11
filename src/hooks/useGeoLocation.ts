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

  const [myLocation, setMyLocation] = useState<GeoLocation | null>(null);

  useEffect(() => {
      // Fetch user's "Home" location for the globe center/arc origin
      const fetchMyLocation = async () => {
          try {
              // Try browser geolocation first for accuracy
              /* navigator.geolocation.getCurrentPosition(
                  (pos) => {
                      setMyLocation({
                          lat: pos.coords.latitude,
                          lon: pos.coords.longitude,
                          country: 'Local',
                          city: 'My Location',
                          ip: '127.0.0.1'
                      });
                  },
                  async () => { */
                      // Fallback to IP-based if geolocation fails/blocked (or just default for now to avoid permission prompts)
                      // SImulate or use a quick fetch if needed. For now, let's use a known public API *client-side* only if user allows.
                      // Actually, for a desktop app, we can guess based on the first "external" request or just default to 0,0 
                      // or better: let the user set it? 
                      // Let's try a simple fetch to a free geo-ip service (robustness: fail gracefully)
                      const res = await fetch('https://ipapi.co/json/');
                      if (res.ok) {
                          const data = await res.json();
                          setMyLocation({
                              lat: data.latitude,
                              lon: data.longitude,
                              country: data.country_name,
                              city: data.city,
                              ip: data.ip
                          });
                      }
                 /* }
              ); */
          } catch (e) {
              console.warn("Could not determine local location", e);
          }
      };

      fetchMyLocation();
  }, []);

  return { locations: Array.from(locations.values()), myLocation }
}
