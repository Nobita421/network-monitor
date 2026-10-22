import { memo, useEffect, useState } from 'react'
import { formatDuration } from '../../lib/utils'

/**
 * Self-contained 1s session timer. Isolated so the 1Hz tick re-renders
 * only this leaf instead of the whole Sidebar tree.
 */
export const SessionTimer = memo(function SessionTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => { setElapsedSeconds((seconds) => seconds + 1) }, 1000)
    return () => { window.clearInterval(id) }
  }, [])

  return (
    <p className="text-xs text-slate-200 font-semibold font-data">{formatDuration(elapsedSeconds)}</p>
  )
})
