import { app } from 'electron'
import { Reader, type ReaderModel } from '@maxmind/geoip2-node'
import * as fs from 'node:fs'
import path from 'node:path'
import { isIP } from 'node:net'
import type { IpLocation } from '../src/lib/ipc'
import { isPublicRoutableIp, normalizeIpAddress } from '../src/lib/network'

export const MAX_IP_LOOKUP_BATCH_SIZE = 500
export const MAX_IP_LOOKUP_HANDLER_DURATION_MS = 1500

type GeoIpLookupResult = {
  ll: [number, number]
  country: string
  city: string
}

type GeoIpModule = {
  lookup: (ip: string) => GeoIpLookupResult | null
}

let asnReaderPromise: Promise<ReaderModel | null> | null = null
let geoIpModulePromise: Promise<GeoIpModule | null> | null = null

function isPackagedApp() {
  const candidate = app as { isPackaged?: unknown } | undefined
  return typeof candidate !== 'undefined' && candidate?.isPackaged === true
}

function isSafeAsnDbPath(candidate: string) {
  if (!path.isAbsolute(candidate) || !candidate.toLowerCase().endsWith('.mmdb')) return false
  try {
    const stat = fs.statSync(candidate)
    return stat.isFile()
  } catch {
    return false
  }
}

function getOptionalAsnDbPath() {
  const candidates = [
    process.env.MAXMIND_ASN_DB_PATH,
    path.join(process.cwd(), 'resources', 'GeoLite2-ASN.mmdb'),
    isPackagedApp() ? path.join(process.resourcesPath, 'GeoLite2-ASN.mmdb') : null,
  ].filter((candidate): candidate is string => Boolean(candidate))
  return candidates.find((candidate) => isSafeAsnDbPath(candidate)) ?? null
}

async function loadAsnReader() {
  if (asnReaderPromise) return asnReaderPromise
  const asnDbPath = getOptionalAsnDbPath()
  if (!asnDbPath) {
    asnReaderPromise = Promise.resolve(null)
    return asnReaderPromise
  }
  asnReaderPromise = Reader.open(asnDbPath).catch((error) => {
    console.warn('Failed to open ASN database:', error)
    return null
  })
  return asnReaderPromise
}

async function loadGeoIpModule() {
  if (geoIpModulePromise) return geoIpModulePromise
  geoIpModulePromise = import('geoip-lite')
    .then((module) => {
      const candidate = ((module as { default?: unknown }).default ?? module) as Partial<GeoIpModule>
      if (typeof candidate.lookup !== 'function') throw new Error('geoip-lite did not expose lookup()')
      return candidate as GeoIpModule
    })
    .catch((error) => {
      console.error('Failed to initialize geoip-lite:', error)
      return null
    })
  return geoIpModulePromise
}

/**
 * Resolves public IPs to geo locations. Filters private/local IPs, caps the
 * batch, and enforces a lookup deadline so slow DBs can't stall IPC.
 * Accepts unknown input (raw IPC payload) and validates it.
 */
export async function lookupIpLocations(ips: unknown): Promise<Record<string, IpLocation | null>> {
  try {
    const requestedIps = Array.isArray(ips) ? ips : []
    const uniqueIps = [
      ...new Set(
        requestedIps
          .filter((ip): ip is string => typeof ip === 'string' && ip.trim().length > 0)
          .map((ip) => normalizeIpAddress(ip))
          .filter(isPublicRoutableIp),
      ),
    ]
    const cappedIps = uniqueIps.slice(0, MAX_IP_LOOKUP_BATCH_SIZE)
    const results: Record<string, IpLocation | null> = {}

    for (const ip of uniqueIps.slice(MAX_IP_LOOKUP_BATCH_SIZE)) {
      results[ip] = null
    }

    // Load DBs first — cold start can take >1s and must not consume the
    // per-lookup deadline, otherwise every IP returns null on first call.
    const [asnReader, geoip] = await Promise.all([loadAsnReader(), loadGeoIpModule()])
    const lookupDeadline = Date.now() + MAX_IP_LOOKUP_HANDLER_DURATION_MS

    if (!geoip) {
      for (const ip of cappedIps) results[ip] = null
      return results
    }

    for (const ip of cappedIps) {
      if (Date.now() > lookupDeadline || isIP(ip) === 0) {
        results[ip] = null
        continue
      }

      const geo = geoip.lookup(ip)
      if (!geo) { results[ip] = null; continue }

      const lat = Number(geo.ll[0])
      const lon = Number(geo.ll[1])
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) { results[ip] = null; continue }

      let isp: string | undefined
      let asn: string | undefined

      if (asnReader) {
        try {
          const response = asnReader.asn(ip)
          isp = response.autonomousSystemOrganization || undefined
          asn = response.autonomousSystemNumber ? `AS${response.autonomousSystemNumber}` : undefined
        } catch {
          isp = undefined
          asn = undefined
        }
      }

      results[ip] = {
        lat, lon,
        country: geo.country,
        city:    geo.city,
        ...(isp ? { isp } : {}),
        ...(asn ? { asn } : {}),
      }
    }

    return results
  } catch (error) {
    console.error('Failed to lookup IPs:', error)
    return {}
  }
}
