import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatCountdown,
  formatDuration,
  formatMinutesDuration,
  loadStoredNumber,
} from './utils'

describe('formatBytes', () => {
  it('formats zero and exact units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })

  it('formats fractional values', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('handles sub-byte, negative, and non-finite input safely', () => {
    expect(formatBytes(0.5)).toBe('0 B')
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })
})

describe('formatDuration', () => {
  it('formats seconds, minutes, and hours', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(90)).toBe('1m 30s')
    expect(formatDuration(3660)).toBe('1h 1m')
  })
})

describe('formatCountdown', () => {
  it('formats countdown values', () => {
    expect(formatCountdown(0)).toBe('0s')
    expect(formatCountdown(30)).toBe('30s')
    expect(formatCountdown(90)).toBe('1m 30s')
  })
})

describe('formatMinutesDuration', () => {
  it('uses seconds below one minute', () => {
    expect(formatMinutesDuration(0.5)).toBe('30 sec')
  })

  it('uses minutes otherwise', () => {
    expect(formatMinutesDuration(2)).toBe('2 min')
    expect(formatMinutesDuration(1.5)).toBe('1.5 min')
  })
})

describe('loadStoredNumber', () => {
  it('returns null outside the browser', () => {
    expect(loadStoredNumber('anything')).toBeNull()
  })
})
