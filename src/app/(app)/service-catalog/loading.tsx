import { ListSkeleton } from "@/components/list-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// Matches the Service Catalog: header row and table.
export default function CatalogLoading() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label="Loading the Service Catalog"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48 rounded-md" />
      </div>
      <ListSkeleton rows={5} />
    </div>
  )
}
