import { describe, expect, it } from 'vitest'
import { getTimezoneOrigin, getVisibleArcStart } from './timezone-origin'

describe('getTimezoneOrigin', () => {
  it('matches Calcutta/Kolkata to India before generic Asia', () => {
    expect(getTimezoneOrigin('Asia/Kolkata').label).toBe('India timezone estimate')
  })

  it('matches regions to their estimates', () => {
    expect(getTimezoneOrigin('Europe/Berlin').label).toBe('Europe timezone estimate')
    expect(getTimezoneOrigin('America/New_York').label).toBe('North America timezone estimate')
    expect(getTimezoneOrigin('America/Santiago').label).toBe('Americas timezone estimate')
    expect(getTimezoneOrigin('Australia/Sydney').label).toBe('Australia timezone estimate')
  })

  it('falls back for unknown timezones', () => {
    expect(getTimezoneOrigin('Pacific/Auckland')).toEqual({ lat: 0, lon: 0, label: 'Timezone unavailable' })
  })
})

describe('getVisibleArcStart', () => {
  it('returns the origin when far from the endpoint', () => {
    expect(getVisibleArcStart({ lat: 0, lon: 0, label: '' }, 50, 50)).toEqual({ lat: 0, lon: 0 })
  })

  it('nudges the origin when it coincides with the endpoint', () => {
    expect(getVisibleArcStart({ lat: 0, lon: 0, label: '' }, 0.1, 0.1)).toEqual({ lat: 0, lon: 12 })
  })
})
