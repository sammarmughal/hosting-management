import { Skeleton } from "@/components/ui/skeleton"

export default function InvoiceLoading() {
  return (
    <div aria-busy="true" aria-label="Loading invoice">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3.5 w-64" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="order-2 rounded-lg border border-border bg-surface p-5 sm:p-8 xl:order-1">
          <div className="flex justify-between gap-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="mt-10 h-3 w-20" />
          <Skeleton className="mt-2 h-4 w-48" />
          <div className="mt-10 flex flex-col gap-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="mt-6 ml-auto h-16 w-64 max-w-full" />
        </div>
        <div className="order-1 flex flex-col gap-2 rounded-lg border border-border bg-surface p-5 xl:order-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}
