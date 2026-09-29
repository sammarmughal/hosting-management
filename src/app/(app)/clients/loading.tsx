import { Skeleton } from "@/components/ui/skeleton"

// Matches the Clients list: header row, toolbar, chips, table (cards on mobile).
export default function ClientsLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading clients">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="hidden h-8 w-28 rounded-md md:block" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Skeleton className="h-9 w-full rounded-md sm:max-w-sm" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-md sm:w-44 sm:flex-none" />
            <Skeleton className="h-9 flex-1 rounded-md sm:w-56 sm:flex-none" />
          </div>
        </div>
        <Skeleton className="h-9 w-full max-w-lg rounded-md" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="hidden h-9 items-center gap-4 border-b border-border px-5 md:flex">
          <Skeleton className="h-2.5 w-16" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0 sm:px-5 md:h-12 md:py-0"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-40 max-w-full" />
              <Skeleton className="h-2.5 w-28 max-w-full" />
            </div>
            <Skeleton className="hidden h-3 w-32 md:block" />
            <Skeleton className="hidden h-3 w-20 lg:block" />
            <Skeleton className="hidden h-3 w-20 md:block" />
            <Skeleton className="h-6 w-36 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
