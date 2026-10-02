import { Skeleton } from "@/components/ui/skeleton"
import { ListSkeleton } from "@/components/list-skeleton"

export default function Loading() {
  return <div aria-busy="true" aria-label="Loading client">
    <Skeleton className="mb-2 h-7 w-60 max-w-full" /><Skeleton className="mb-6 h-4 w-32" />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6"><Skeleton className="h-60 w-full rounded-lg" /><ListSkeleton rows={3} /></div>
      <Skeleton className="h-64 w-full rounded-lg max-xl:row-start-1" />
    </div>
  </div>
}
