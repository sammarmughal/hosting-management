import { ListSkeleton } from "@/components/list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// Matches the Clients list: header row, search, table (cards on mobile).
export default function ClientsLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading clients">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48 rounded-md" />
      </div>
      <Skeleton className="h-9 w-full rounded-md sm:max-w-sm" />
      <ListSkeleton rows={8} />
    </div>
  )
}
