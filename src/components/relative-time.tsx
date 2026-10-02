"use client"

import { useNow } from "@/hooks/use-now"
import { formatDateTimePK, formatRelative } from "@/lib/domain/relative-time"
import { cn } from "@/lib/utils"

/**
 * "2 hours ago" with the absolute Pakistan time in a tooltip (docs/12 §6).
 * Server-rendered pages pass `initial` (computed on the server) so the first
 * client render matches; after mount it follows the shared clock.
 */
export function RelativeTime({
  iso,
  initial,
  className,
}: {
  iso: string
  initial?: string
  className?: string
}) {
  const now = useNow()
  const text =
    now !== null
      ? formatRelative(iso, new Date(now))
      : (initial ?? formatRelative(iso, new Date()))
  return (
    <time
      dateTime={iso}
      title={formatDateTimePK(iso)}
      className={cn("tabular-nums", className)}
    >
      {text}
    </time>
  )
}
