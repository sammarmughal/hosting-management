import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// docs/12 §5: a small line icon, one sentence, one button. No illustrations.
export function EmptyState({
  icon: Icon,
  message,
  action,
  className,
}: {
  icon: LucideIcon
  message: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <Icon aria-hidden className="size-6 text-ink-subtle" strokeWidth={1.75} />
      <p className="mt-3 max-w-xs text-base text-ink-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
