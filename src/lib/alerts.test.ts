import { describe, expect, it } from 'vitest'
import { parseRateToBps, resolveAlertEntry } from './alerts'

describe('resolveAlertEntry', () => {
  it('prefers structured direction and rateLabel', () => {
    expect(resolveAlertEntry({
      title: 'ignored',
      body: 'ignored',
      time: '2026-01-01T00:00:00.000Z',
      direction: 'tx',
      rxSec: 1,
      txSec: 2,
      rateLabel: '2 B/s',
    })).toMatchObject({ direction: 'tx', rate: '2 B/s', rateBps: 2 })
  })

  it('keeps the numeric rate for severity classification', () => {
    const resolved = resolveAlertEntry({
      title: 'High Download Traffic',
      body: 'Download speed: 99 MB/s',
      time: '',
      direction: 'rx',
      rxSec: 60 * 1024 * 1024,
      txSec: 0,
      rateBps: 60 * 1024 * 1024,
      rateLabel: '60 MB/s',
    })
    expect(resolved.rateBps).toBe(60 * 1024 * 1024)
  })

  it('parses legacy rate labels into bytes/sec', () => {
    expect(parseRateToBps('1.5 MB/s')).toBe(1.5 * 1024 * 1024)
    expect(parseRateToBps('nonsense')).toBe(0)
  })

  it('falls back to title/body parsing for legacy payloads', () => {
    expect(resolveAlertEntry({
      title: 'High Download Traffic',
      body: 'Download speed: 123 B/s',
      time: '',
    })).toMatchObject({ direction: 'rx', rate: '123 B/s' })
  })

  it('defaults to tx/High when nothing matches', () => {
    expect(resolveAlertEntry({ title: '???', body: 'blah', time: '' }))
      .toMatchObject({ direction: 'tx', rate: 'High' })
  })

  it('always returns a time string', () => {
    expect(typeof resolveAlertEntry({ title: 't', body: 'b', time: '' }).time).toBe('string')
  })
})
