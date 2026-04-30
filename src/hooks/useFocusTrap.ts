import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Traps focus within the given ref element while active.
 * Compliant with WAI-ARIA Authoring Practices 1.2 §Modal Dialog.
 *
 * @param containerRef - ref to the modal/dialog container
 * @param active       - whether the trap is currently enabled
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean) {
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  // Save and restore focus when modal opens/closes
  useEffect(() => {
    if (active) {
      lastFocusedRef.current = document.activeElement as HTMLElement | null
    } else {
      lastFocusedRef.current?.focus()
    }
  }, [active])

  // Auto-focus the first focusable element when the trap activates
  useEffect(() => {
    if (!active || !containerRef.current) return
    requestAnimationFrame(() => {
      const el = containerRef.current
      if (!el) return
      const firstFocusable = el.querySelector<HTMLElement>(FOCUSABLE_SELECTORS)
      firstFocusable?.focus()
    })
  }, [active, containerRef])

  // Tab key handler to cycle focus within the container
  useEffect(() => {
    if (!active) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return

      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      ).filter((el) => !el.closest('[disabled]') && el.offsetParent !== null)

      if (focusable.length === 0) { e.preventDefault(); return }

      const first = focusable[0]
      const last  = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, containerRef])
}
