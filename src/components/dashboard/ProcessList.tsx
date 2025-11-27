import { useState } from 'react'
import { Activity, Trash2 } from 'lucide-react'
import { ProcessUsageEntry } from '../../types'
import { formatBytes, cn } from '../../lib/utils'
import { Card } from '../ui/Card'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { useProcessControl } from '../../hooks/useProcessControl'

interface ProcessListProps {
    processes: ProcessUsageEntry[]
}

export function ProcessList({ processes }: ProcessListProps) {
    const { killProcess, isKilling } = useProcessControl()
    const [processToKill, setProcessToKill] = useState<ProcessUsageEntry | null>(null)

    const handleKillConfirm = async () => {
        if (!processToKill) return

        const success = await killProcess(processToKill.pid)
        if (success) {
            console.log(`Successfully killed process ${processToKill.name} (${processToKill.pid})`)
        } else {
            console.error(`Failed to kill process ${processToKill.name} (${processToKill.pid})`)
        }
        setProcessToKill(null)
    }

    return (
        <>
            <Card title="Top Network Processes" icon={Activity} className="h-full">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-lg">Process</th>
                                <th className="px-4 py-3">PID</th>
                                <th className="px-4 py-3 text-right">Download</th>
                                <th className="px-4 py-3 text-right">Upload</th>
                                <th className="px-4 py-3 text-center">Conns</th>
                                <th className="px-4 py-3 rounded-tr-lg text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {processes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        No active processes found
                                    </td>
                                </tr>
                            ) : (
                                processes.map((proc) => (
                                    <tr key={proc.pid} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-4 py-3 font-medium text-slate-200 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            {proc.name}
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{proc.pid}</td>
                                        <td className="px-4 py-3 text-right text-emerald-400">{formatBytes(proc.rx)}/s</td>
                                        <td className="px-4 py-3 text-right text-blue-400">{formatBytes(proc.tx)}/s</td>
                                        <td className="px-4 py-3 text-center text-slate-300">{proc.connections}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setProcessToKill(proc)}
                                                disabled={isKilling === proc.pid}
                                                className={cn(
                                                    "p-1.5 rounded-md transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100",
                                                    "text-slate-400 hover:text-red-400 hover:bg-red-500/10",
                                                    isKilling === proc.pid && "opacity-50 cursor-wait"
                                                )}
                                                title="Kill Process"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <ConfirmationModal
                isOpen={!!processToKill}
                onClose={() => setProcessToKill(null)}
                onConfirm={handleKillConfirm}
                title="Kill Process?"
                message={`Are you sure you want to terminate "${processToKill?.name}" (PID: ${processToKill?.pid})? This action cannot be undone and might cause data loss if the application has unsaved work.`}
                confirmLabel={isKilling === processToKill?.pid ? 'Killing...' : 'Kill Process'}
                isDanger={true}
            />
        </>
    )
}
