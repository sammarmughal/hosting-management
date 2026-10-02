import { Skeleton } from "@/components/ui/skeleton"

/** Table rows (cards on mobile) for list loading states (docs/12 §5). */
export function ListSkeleton({
  rows = 8,
  columns = 4,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="hidden h-9 items-center border-b border-border px-5 md:flex">
        <Skeleton className="h-2.5 w-16" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-6 border-b border-border px-4 py-4 last:border-0 sm:px-5 md:h-12 md:py-0"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-40 max-w-full" />
            <Skeleton className="h-2.5 w-24 max-w-full md:hidden" />
          </div>
          {Array.from({ length: columns - 1 }, (_, c) => (
            <Skeleton key={c} className="hidden h-3 w-24 md:block" />
          ))}
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}
