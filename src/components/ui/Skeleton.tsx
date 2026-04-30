import { cn } from '../../lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-white/[0.04]',
        className,
      )}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#060b18]/80 p-5">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-6 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-28 mb-2" />
      <Skeleton className="h-2.5 w-20" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-white/[0.04]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-3 w-full max-w-[100px]" />
        </td>
      ))}
    </tr>
  )
}

export function ProcessRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]">
      <Skeleton className="h-6 w-6 rounded-lg shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}
