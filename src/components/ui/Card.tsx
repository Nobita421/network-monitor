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
        <div className={cn("rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur", className)}>
            {(title || action || Icon) && (
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {Icon && <Icon className="h-5 w-5 text-emerald-400" />}
                        {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            {children}
        </div>
    )
}
