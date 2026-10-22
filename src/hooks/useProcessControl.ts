import { useState, useCallback } from 'react'
import { getDesktop, invokeWithTimeout } from '../lib/ipc'
import { toast } from '../components/ui/Toast'

export interface KillResult {
  ok: boolean
  reason?: string
}

export function useProcessControl() {
  const [isKilling, setIsKilling] = useState<number | null>(null)

  const killProcess = useCallback(async (pid: number): Promise<KillResult> => {
    if (!Number.isInteger(pid) || pid <= 0) {
      return { ok: false, reason: 'Invalid process ID.' }
    }
    const desktop = getDesktop()
    if (!desktop) {
      return { ok: false, reason: 'Desktop bridge unavailable.' }
    }
    setIsKilling(pid)
    try {
      const success = await invokeWithTimeout(() => desktop.killProcess(pid))
      if (success) {
        toast.success('Process terminated', `PID ${pid} was killed successfully`)
        return { ok: true }
      }
      const reason = 'Process could not be terminated. It may require elevated privileges or has already exited.'
      return { ok: false, reason }
    } catch (error) {
      console.error('Failed to kill process:', error)
      const reason = error instanceof Error ? error.message : 'Unknown error'
      return { ok: false, reason }
    } finally {
      setIsKilling(null)
    }
  }, [])

  return { killProcess, isKilling }
}
