import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface CardProps {
    children: ReactNode
    className?: string
    title?: string
    icon?: LucideIcon
    action?: ReactNode
}

export function Card({ children, className, title, icon: Icon, action }: CardProps) {
    return (
        <div
          className={cn(
            'rounded-2xl border border-white/[0.06] p-5 backdrop-blur-sm',
            'bg-[#060b18]/90',
            className
          )}
        >
            {(title || action || Icon) && (
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        {Icon && (
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
                            <Icon className="h-4 w-4 text-emerald-400" />
                          </div>
                        )}
                        {title && <h3 className="text-[14px] font-semibold text-white">{title}</h3>}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            {children}
        </div>
    )
}
