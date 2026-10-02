import { ListSkeleton } from "@/components/list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function RemindersLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading reminders">
      <div className="flex h-10 items-center gap-4 border-b border-border">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-12" />
      </div>
      <ListSkeleton rows={6} columns={5} />
    </div>
  )
}
