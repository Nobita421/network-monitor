import { describe, expect, it } from 'vitest'
import { lookupIpLocations, MAX_IP_LOOKUP_BATCH_SIZE } from '../../electron/geoip'

describe('lookupIpLocations', () => {
  it('resolves public IPs and filters private/invalid input', async () => {
    const results = await lookupIpLocations(['8.8.8.8', '192.168.0.1', '', 'notaip', 123])

    expect(results['8.8.8.8']).toMatchObject({ country: 'US' })
    expect(results['192.168.0.1']).toBeUndefined()
    expect(results['notaip']).toBeUndefined()
  })

  it('returns {} for non-array input', async () => {
    await expect(lookupIpLocations(null)).resolves.toEqual({})
    await expect(lookupIpLocations('8.8.8.8')).resolves.toEqual({})
  })

  it('nulls IPs beyond the batch cap instead of looking them up', async () => {
    // 9.0.0.0/8 is public; generate 502 unique IPs so 2 spill over the cap.
    const ips = Array.from({ length: MAX_IP_LOOKUP_BATCH_SIZE + 2 }, (_, i) => `9.${Math.floor(i / 254)}.${(i % 254) + 1}.1`)
    const results = await lookupIpLocations(ips)
    const nulled = Object.values(results).filter((loc) => loc === null)
    expect(nulled.length).toBe(2)
  }, 20000)
})
