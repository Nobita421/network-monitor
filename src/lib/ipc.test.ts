import { describe, expect, it } from 'vitest'
import { getDesktop, invokeWithTimeout, isDesktopAvailable } from './ipc'

describe('desktop bridge guards (node env)', () => {
  it('reports unavailable outside Electron', () => {
    expect(getDesktop()).toBeNull()
    expect(isDesktopAvailable()).toBe(false)
  })
})

describe('invokeWithTimeout', () => {
  it('resolves the task value', async () => {
    await expect(invokeWithTimeout(() => Promise.resolve(42))).resolves.toBe(42)
  })

  it('rejects when the task exceeds the timeout', async () => {
    await expect(invokeWithTimeout(() => new Promise(() => {}), 10)).rejects.toThrow(/timed out/)
  })
})
