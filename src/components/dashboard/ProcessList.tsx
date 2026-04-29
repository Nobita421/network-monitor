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

  const maxRx = Math.max(...processes.map(p => p.rx), 1)
  const maxTx = Math.max(...processes.map(p => p.tx), 1)

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-[#060b18]/80 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-400/10">
              <Cpu size={13} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white leading-tight">Network Processes</p>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">Top consumers by bandwidth</p>
            </div>
          </div>
          <span className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-500 font-medium">
            {processes.length} active
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.03] text-[9px] uppercase tracking-[0.15em] text-slate-700">
                <th className="px-5 py-3 text-left font-semibold">Process</th>
                <th className="px-4 py-3 text-left font-semibold">PID</th>
                <th className="px-4 py-3 text-right font-semibold">
                  <span className="flex items-center justify-end gap-1">
                    <ArrowDown size={9} className="text-emerald-600" /> Download
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  <span className="flex items-center justify-end gap-1">
                    <ArrowUp size={9} className="text-sky-600" /> Upload
                  </span>
                </th>
                <th className="px-4 py-3 text-center font-semibold">Conns</th>
                <th className="px-5 py-3 text-center font-semibold">Kill</th>
              </tr>
            </thead>
            <tbody>
              {processes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Cpu size={20} className="text-slate-700" />
                      <p className="text-[13px] text-slate-700">No active processes detected</p>
                    </div>
                  </td>
                </tr>
              ) : processes.map((proc, idx) => (
                <tr
                  key={proc.pid}
                  className="group border-b border-white/[0.025] transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-slate-800 to-slate-900 border border-white/[0.05] text-[9px] font-bold text-slate-500 font-data">
                        {idx + 1}
                      </div>
                      <span className="font-medium text-[13px] text-slate-200 truncate max-w-[120px]">{proc.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[10px] text-slate-600">{proc.pid}</td>

                  {/* Download with mini bar */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[12px] font-semibold text-emerald-400 font-data">{formatBytes(proc.rx)}/s</span>
                      <div className="h-0.5 rounded-full bg-white/[0.04] w-16 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-400/60 transition-all duration-500"
                          style={{ width: `${(proc.rx / maxRx) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Upload with mini bar */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[12px] font-semibold text-sky-400 font-data">{formatBytes(proc.tx)}/s</span>
                      <div className="h-0.5 rounded-full bg-white/[0.04] w-16 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-400/60 transition-all duration-500"
                          style={{ width: `${(proc.tx / maxTx) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-center">
                    <span className="text-[12px] text-slate-500 font-data">{proc.connections}</span>
                  </td>

                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => setToKill(proc)}
                      disabled={isKilling === proc.pid}
                      className={cn(
                        'rounded-lg p-1.5 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100',
                        'border border-transparent text-slate-600',
                        'hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400',
                        isKilling === proc.pid && 'cursor-wait opacity-40'
                      )}
                      title="Kill Process"
                    >
                      <Trash2 size={12} />
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
