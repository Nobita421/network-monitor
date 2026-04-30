import { useEffect, useRef } from 'react'
import * as Lucide from 'lucide-react'
import { formatBytes, formatMinutesDuration } from '../../lib/utils'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  draft: {
    thresholdMb: number
    cooldown: number
    pauseMinutes: number
  }
  updateDraft: (field: 'thresholdMb' | 'cooldown' | 'pauseMinutes', value: number) => void
  onSave: () => void
}

interface SliderRowProps {
  id: string
  label: string
  description: string
  min: number
  max: number
  step: number
  value: number
  displayValue: string
  accentColor: string
  onChange: (v: number) => void
  icon: React.ReactNode
  unit?: string
}

function SliderRow({ id, label, description, min, max, step, value, displayValue, accentColor, onChange, icon }: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={accentColor} aria-hidden>{icon}</span>
          <label htmlFor={id} className="text-[13px] font-semibold text-slate-200">{label}</label>
        </div>
        <span className={`text-[13px] font-bold font-data ${accentColor}`} aria-live="polite">{displayValue}</span>
      </div>
      <div className="relative">
        <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden" aria-hidden>
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${pct}%`,
              background: accentColor.includes('sky')     ? 'linear-gradient(90deg, #0ea5e9, #38bdf8)'
                : accentColor.includes('emerald') ? 'linear-gradient(90deg, #10b981, #34d399)'
                : 'linear-gradient(90deg, #d97706, #fbbf24)',
            }}
          />
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={displayValue}
          aria-label={label}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-1.5"
          style={{ background: 'transparent' }}
        />
        {/* Custom thumb (decorative) */}
        <div
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow-md shadow-black/40 border border-white/20 transition-all"
          style={{ left: `calc(${pct}% - 8px)` }}
          aria-hidden
        />
      </div>
      <p className="text-[11px] text-slate-600">{description}</p>
    </div>
  )
}

export function SettingsModal({ isOpen, onClose, draft, updateDraft, onSave }: SettingsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const titleId  = 'settings-modal-title'

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      aria-hidden={!isOpen}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl animate-fade-in-up"
        style={{
          background: 'linear-gradient(145deg, rgba(10,15,30,0.98) 0%, rgba(5,10,20,0.99) 100%)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(56,189,248,0.04)',
        }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-sky-400/20 blur-lg" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10">
                <Lucide.SlidersHorizontal size={14} className="text-sky-400" />
              </div>
            </div>
            <div>
              <h2 id={titleId} className="text-[15px] font-bold text-white leading-tight">Alert Settings</h2>
              <p className="text-[10px] text-slate-600">Configure telemetry thresholds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-slate-500 hover:bg-white/[0.08] hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <Lucide.X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          <SliderRow
            id="settings-threshold"
            label="Bandwidth Threshold"
            description={`Alerts trigger when traffic exceeds ${formatBytes(draft.thresholdMb * 1024 * 1024)}/s`}
            min={0.5} max={100} step={0.5}
            value={draft.thresholdMb}
            displayValue={`${draft.thresholdMb} MB/s`}
            accentColor="text-sky-400"
            onChange={(v) => updateDraft('thresholdMb', v)}
            icon={<Lucide.Gauge size={14} />}
          />

          <SliderRow
            id="settings-cooldown"
            label="Alert Cooldown"
            description="Minimum time between consecutive notifications"
            min={5} max={3600} step={5}
            value={Math.round(draft.cooldown * 60)}
            displayValue={formatMinutesDuration(draft.cooldown)}
            accentColor="text-emerald-400"
            onChange={(v) => updateDraft('cooldown', v / 60)}
            icon={<Lucide.Timer size={14} />}
          />

          <SliderRow
            id="settings-pause"
            label="Pause Duration"
            description="How long to suspend telemetry when paused"
            min={5} max={7200} step={5}
            value={Math.round(draft.pauseMinutes * 60)}
            displayValue={formatMinutesDuration(draft.pauseMinutes)}
            accentColor="text-amber-400"
            onChange={(v) => updateDraft('pauseMinutes', v / 60)}
            icon={<Lucide.Clock size={14} />}
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.03] py-2.5 text-[13px] font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-500 hover:shadow-sky-400/25 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
