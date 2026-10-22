export interface GlobeOrigin {
  lat: number
  lon: number
  label: string
}

const TIMEZONE_ORIGINS: { match: RegExp; origin: GlobeOrigin }[] = [
  { match: /^Asia\/(Calcutta|Kolkata)$/i, origin: { lat: 20.5937, lon: 78.9629, label: 'India timezone estimate' } },
  { match: /^Asia\//i, origin: { lat: 1.3521, lon: 103.8198, label: 'Asia timezone estimate' } },
  { match: /^Europe\//i, origin: { lat: 50.1109, lon: 8.6821, label: 'Europe timezone estimate' } },
  { match: /^America\/(New_York|Detroit|Toronto|Montreal|Indiana|Kentucky)/i, origin: { lat: 39.8283, lon: -98.5795, label: 'North America timezone estimate' } },
  { match: /^America\//i, origin: { lat: 39.8283, lon: -98.5795, label: 'Americas timezone estimate' } },
  { match: /^Australia\//i, origin: { lat: -25.2744, lon: 133.7751, label: 'Australia timezone estimate' } },
]

export function getTimezoneOrigin(timezone?: string): GlobeOrigin {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  const matched = TIMEZONE_ORIGINS.find(({ match }) => match.test(tz))
  return matched?.origin ?? { lat: 0, lon: 0, label: 'Timezone unavailable' }
}

/**
 * Nudges arc origins that coincide with the endpoint so arcs remain visible
 * instead of collapsing to a dot.
 */
export function getVisibleArcStart(origin: GlobeOrigin, endLat: number, endLng: number) {
  const nearSamePoint = Math.abs(origin.lat - endLat) < 0.25 && Math.abs(origin.lon - endLng) < 0.25
  if (!nearSamePoint) return { lat: origin.lat, lon: origin.lon }
  return { lat: origin.lat, lon: ((origin.lon + 12 + 540) % 360) - 180 }
}
