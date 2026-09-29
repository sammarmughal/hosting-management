import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Matches the dashboard layout (docs/12 §5: skeletons, never a full-page spinner).
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-4 w-52" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6 md:gap-4 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg border border-border bg-surface p-4 sm:p-5",
              i < 3 ? "md:col-span-2 xl:col-span-1" : "md:col-span-3 xl:col-span-1",
              i === 4 && "col-span-2"
            )}
          >
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-3.5 h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-0"
          >
            <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-64 max-w-full" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-6 w-36 rounded-full" />
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-8 w-40 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-5 py-3.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-3 w-44" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex h-12 items-center gap-4 border-b border-border px-5 last:border-0"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-40 max-w-full" />
              <Skeleton className="h-2.5 w-28 max-w-full" />
            </div>
            <Skeleton className="hidden h-3 w-32 md:block" />
            <Skeleton className="hidden h-3 w-20 md:block" />
            <Skeleton className="h-6 w-36 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
