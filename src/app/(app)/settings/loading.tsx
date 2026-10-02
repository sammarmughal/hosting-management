import { Skeleton } from "@/components/ui/skeleton"
export default function Loading() {
  return (
    <div
      className="grid gap-6 md:grid-cols-[152px_1fr]"
      aria-label="Loading settings"
      aria-busy="true"
    >
      <Skeleton className="h-11 md:h-48" />
      <div className="space-y-6 rounded-lg border border-border bg-surface p-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
