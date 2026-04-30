import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isDanger?: boolean
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  isDanger     = false,
}: ConfirmationModalProps) {
  const modalRef   = useRef<HTMLDivElement>(null)
  const titleId    = 'confirm-modal-title'
  const descId     = 'confirm-modal-desc'

  useFocusTrap(modalRef, isOpen)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      aria-hidden={!isOpen}
    >
      <div
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-md bg-slate-900/90 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-800/50">
          <div className="flex items-center gap-3">
            {isDanger && <AlertTriangle className="w-5 h-5 text-red-400" aria-hidden />}
            <h2 id={titleId} className="text-lg font-semibold text-slate-100">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <p id={descId} className="text-slate-300 leading-relaxed">{message}</p>
        </div>

        {/* Footer — confirm does NOT call onClose; let the caller decide */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-800/30 border-t border-slate-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { void onConfirm() }}
            className={cn(
              'px-4 py-2 text-sm font-medium text-white rounded-lg shadow-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2',
              isDanger
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20 focus-visible:ring-red-400'
                : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20 focus-visible:ring-blue-400',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
