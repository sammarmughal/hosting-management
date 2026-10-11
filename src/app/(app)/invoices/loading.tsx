import { ListSkeleton } from "@/components/list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function InvoicesLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading invoices">
      <div className="flex w-fit gap-8 rounded-lg border border-border bg-surface px-5 py-3">
        {[16, 32, 32].map((w, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6" style={{ width: `${w * 4}px` }} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-80 max-w-full rounded-md" />
        <div className="flex flex-col gap-2 md:flex-row md:justify-between">
          <Skeleton className="h-9 w-full rounded-md md:max-w-sm" />
          <Skeleton className="h-9 w-full rounded-md md:w-96" />
        </div>
      </div>
      <ListSkeleton rows={8} columns={7} />
    </div>
  )
}
