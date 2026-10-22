import { describe, expect, it } from 'vitest'
import { resolveAlertEntry } from './alerts'

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
    })).toMatchObject({ direction: 'tx', rate: '2 B/s' })
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
