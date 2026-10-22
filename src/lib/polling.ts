/**
 * Capped linear backoff for monitoring loops: base interval + 1s per
 * consecutive error, capped at +4s. Prevents a failing collector from
 * busy-looping the CPU while recovering quickly once healthy.
 */
export function backoffDelayMs(baseMs: number, errorStreak: number) {
  const cappedStreak = Math.min(Math.max(Math.trunc(errorStreak), 0), 4)
  return baseMs + cappedStreak * 1000
}
