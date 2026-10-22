import { describe, expect, it } from 'vitest'
import { averagePing, extractPingSeries } from './latency'

describe('extractPingSeries', () => {
  it('keeps finite positive samples in order', () => {
    expect(extractPingSeries([
      { timestamp: 1, ping: 20 },
      { timestamp: 2 },
      { timestamp: 3, ping: 0 },
      { timestamp: 4, ping: NaN },
      { timestamp: 5, ping: 40 },
    ])).toEqual([
      { timestamp: 1, ping: 20 },
      { timestamp: 5, ping: 40 },
    ])
  })
})

describe('averagePing', () => {
  it('averages samples and returns 0 when empty', () => {
    expect(averagePing([{ timestamp: 1, ping: 10 }, { timestamp: 2, ping: 30 }])).toBe(20)
    expect(averagePing([])).toBe(0)
  })
})
