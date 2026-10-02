import { Skeleton } from "@/components/ui/skeleton"
export default function Loading() {
  return (
    <div className="space-y-6" aria-label="Loading import" aria-busy="true">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  )
}
