import { Skeleton } from "@/components/ui/skeleton"

export default function NotificationsLoading() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading notifications"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      {[3, 4].map((n, g) => (
        <div key={g}>
          <Skeleton className="mb-3 h-3 w-16" />
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {Array.from({ length: n }, (_, i) => (
              <div
                key={i}
                className="flex gap-3 border-b border-border px-5 py-3.5 last:border-0"
              >
                <Skeleton className="size-4 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-3/5" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
