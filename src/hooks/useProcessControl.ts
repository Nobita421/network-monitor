import { useState, useCallback } from 'react'

export function useProcessControl() {
  const [isKilling, setIsKilling] = useState<number | null>(null)

  const killProcess = useCallback(async (pid: number) => {
    setIsKilling(pid)
    try {
      const success = await window.ipcRenderer.killProcess(pid)
      return success
    } catch (error) {
      console.error('Failed to kill process:', error)
      return false
    } finally {
      setIsKilling(null)
    }
  }, [])

  return { killProcess, isKilling }
}
