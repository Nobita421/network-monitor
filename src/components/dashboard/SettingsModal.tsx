import * as Lucide from 'lucide-react'
import { formatBytes, formatMinutesDuration } from '../../lib/utils'

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

export function SettingsModal({ isOpen, onClose, draft, updateDraft, onSave }: SettingsModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
                <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Alert Settings</h3>
                    <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white">
                        <Lucide.X size={20} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Bandwidth Threshold (MB/s)</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="0.5"
                                max="100"
                                step="0.5"
                                value={draft.thresholdMb}
                                onChange={(e) => { updateDraft('thresholdMb', Number(e.target.value)) }}
                                className="flex-1 accent-sky-500"
                            />
                            <span className="w-20 text-right text-sm font-mono text-sky-400">{draft.thresholdMb} MB/s</span>
                        </div>
                        <p className="text-xs text-slate-500">Alerts trigger when traffic exceeds {formatBytes(draft.thresholdMb * 1024 * 1024)}/s</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Alert Cooldown</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="5"
                                max="3600"
                                step="5"
                                value={Math.round(draft.cooldown * 60)}
                                onChange={(e) => { updateDraft('cooldown', Number(e.target.value) / 60) }}
                                className="flex-1 accent-emerald-500"
                            />
                            <span className="w-20 text-right text-sm font-mono text-emerald-400">{formatMinutesDuration(draft.cooldown)}</span>
                        </div>
                        <p className="text-xs text-slate-500">Minimum time between consecutive notifications</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Pause Duration</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="5"
                                max="7200"
                                step="5"
                                value={Math.round(draft.pauseMinutes * 60)}
                                onChange={(e) => { updateDraft('pauseMinutes', Number(e.target.value) / 60) }}
                                className="flex-1 accent-amber-500"
                            />
                            <span className="w-20 text-right text-sm font-mono text-amber-400">{formatMinutesDuration(draft.pauseMinutes)}</span>
                        </div>
                        <p className="text-xs text-slate-500">How long to suspend telemetry when paused</p>
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 py-2.5 text-sm font-semibold text-white hover:from-sky-400 hover:to-indigo-400"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    )
}
