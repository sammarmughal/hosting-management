import { Skeleton } from "@/components/ui/skeleton"

export function FormSkeleton({ sections = 1 }: { sections?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading form">
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-6 h-4 w-56 max-w-full" />
      {Array.from({ length: sections }, (_, i) => (
        <div key={i} className="grid gap-4 border-b py-6 first:pt-0 xl:grid-cols-[1fr_2fr] xl:gap-8">
          <div><Skeleton className="h-5 w-32" /><Skeleton className="mt-2 h-10 w-56 max-w-full" /></div>
          <div className="space-y-5 rounded-lg border bg-surface p-4 sm:p-5">
            {Array.from({ length: 5 }, (_, j) => <div key={j}><Skeleton className="mb-2 h-4 w-24" /><Skeleton className="h-11 w-full md:h-9" /></div>)}
          </div>
        </div>
      ))}
      <div className="mt-6 flex justify-end gap-2"><Skeleton className="h-11 w-24 md:h-9" /><Skeleton className="h-11 w-32 md:h-9" /></div>
    </div>
  )
}
