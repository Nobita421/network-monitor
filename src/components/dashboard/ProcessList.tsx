import { useState } from 'react'
import { Cpu, Trash2, ArrowDown, ArrowUp } from 'lucide-react'
import type { ProcessUsageEntry } from '../../types'
import { formatBytes, cn } from '../../lib/utils'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { useProcessControl } from '../../hooks/useProcessControl'

interface ProcessListProps {
  processes: ProcessUsageEntry[]
}

export function ProcessList({ processes }: ProcessListProps) {
  const { killProcess, isKilling } = useProcessControl()
  const [toKill, setToKill] = useState<ProcessUsageEntry | null>(null)

  const handleKill = async () => {
    if (!toKill) return
    await killProcess(toKill.pid)
    setToKill(null)
  }

  return (
    <>
      <div className="rounded-2xl border border-white/5 bg-[#080c14]/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10">
              <Cpu size={13} className="text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">Top Network Processes</p>
          </div>
          <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-0.5 text-[10px] text-slate-400">
            {processes.length} active
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600">
                <th className="px-5 py-3 text-left">Process</th>
                <th className="px-4 py-3 text-left">PID</th>
                <th className="px-4 py-3 text-right">
                  <span className="flex items-center justify-end gap-1"><ArrowDown size={10} /> DL</span>
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="flex items-center justify-end gap-1"><ArrowUp size={10} /> UL</span>
                </th>
                <th className="px-4 py-3 text-center">Conns</th>
                <th className="px-5 py-3 text-center">Kill</th>
              </tr>
            </thead>
            <tbody>
              {processes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-600">
                    No active processes detected
                  </td>
                </tr>
              ) : processes.map((proc) => (
                <tr key={proc.pid} className="group border-b border-white/[0.03] transition-colors hover:bg-white/[0.025]">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2 font-medium text-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {proc.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{proc.pid}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{formatBytes(proc.rx)}/s</td>
                  <td className="px-4 py-3 text-right text-sky-400 font-semibold">{formatBytes(proc.tx)}/s</td>
                  <td className="px-4 py-3 text-center text-slate-400">{proc.connections}</td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => setToKill(proc)}
                      disabled={isKilling === proc.pid}
                      className={cn(
                        'rounded-lg p-1.5 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100',
                        'text-slate-500 hover:text-rose-400 hover:bg-rose-400/10',
                        isKilling === proc.pid && 'cursor-wait opacity-40'
                      )}
                      title="Kill Process"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!toKill}
        onClose={() => setToKill(null)}
        onConfirm={() => { void handleKill() }}
        title="Kill Process?"
        message={`Terminate "${toKill?.name}" (PID: ${toKill?.pid})? This cannot be undone.`}
        confirmLabel={isKilling === toKill?.pid ? 'Killing...' : 'Kill Process'}
        isDanger
      />
    </>
  )
}
