import { describe, expect, it } from 'vitest'
import { backoffDelayMs } from './polling'

describe('backoffDelayMs', () => {
  it('returns the base interval with no errors', () => {
    expect(backoffDelayMs(1000, 0)).toBe(1000)
  })

  it('adds 1s per consecutive error', () => {
    expect(backoffDelayMs(1000, 2)).toBe(3000)
  })

  it('caps the backoff at +4s', () => {
    expect(backoffDelayMs(1000, 99)).toBe(5000)
  })

  it('clamps negative streaks to zero', () => {
    expect(backoffDelayMs(1000, -3)).toBe(1000)
  })
})
