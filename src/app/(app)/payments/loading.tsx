import { ListSkeleton } from "@/components/list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function PaymentsLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading payments">
      <div className="flex w-fit gap-8 rounded-lg border border-border bg-surface px-5 py-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-6 w-36" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-8" />
        </div>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:justify-between">
        <Skeleton className="h-9 w-full rounded-md md:max-w-sm" />
        <Skeleton className="h-9 w-full rounded-md md:w-96" />
      </div>
      <ListSkeleton rows={8} columns={6} />
    </div>
  )
}
