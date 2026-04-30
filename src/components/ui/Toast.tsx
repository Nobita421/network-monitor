import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  duration?: number // ms, default 5000; 0 = sticky
}

// ─── Singleton event bus (avoids prop-drilling) ───────────────────────────────

type ToastListener = (toast: ToastMessage) => void
const listeners = new Set<ToastListener>()

export const toast = {
  show: (msg: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    listeners.forEach((l) => l({ id, ...msg }))
  },
  success: (title: string, description?: string) =>
    toast.show({ variant: 'success', title, description }),
  error: (title: string, description?: string) =>
    toast.show({ variant: 'error', title, description, duration: 8000 }),
  warning: (title: string, description?: string) =>
    toast.show({ variant: 'warning', title, description }),
  info: (title: string, description?: string) =>
    toast.show({ variant: 'info', title, description }),
}

// ─── Individual toast item ────────────────────────────────────────────────────

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle  className="h-4 w-4 text-emerald-400" />,
  error:   <XCircle      className="h-4 w-4 text-rose-400"    />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400"  />,
  info:    <Info         className="h-4 w-4 text-sky-400"     />,
}

const BORDER_COLORS: Record<ToastVariant, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/[0.06]',
  error:   'border-rose-500/30    bg-rose-500/[0.06]',
  warning: 'border-amber-500/30   bg-amber-500/[0.06]',
  info:    'border-sky-500/30     bg-sky-500/[0.06]',
}

function ToastItem({ toast: msg, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const duration = msg.duration ?? 5000
    if (duration <= 0) return
    const t = setTimeout(() => onDismiss(msg.id), duration)
    return () => clearTimeout(t)
  }, [msg, onDismiss])

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex w-80 items-start gap-3 rounded-xl border p-4 shadow-2xl shadow-black/60 backdrop-blur-xl',
        'animate-fade-in-up',
        BORDER_COLORS[msg.variant],
      )}
      style={{ background: 'rgba(6,11,24,0.92)' }}
    >
      <span className="mt-0.5 shrink-0">{ICONS[msg.variant]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white">{msg.title}</p>
        {msg.description && (
          <p className="mt-0.5 text-[11px] text-slate-400">{msg.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(msg.id)}
        className="ml-1 shrink-0 rounded-lg p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Toast container (mount once in App root) ─────────────────────────────────

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const listener: ToastListener = (msg) => {
      setToasts((prev) => [...prev.slice(-4), msg]) // max 5 visible
    }
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  if (!toasts.length) return null

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  )
}
