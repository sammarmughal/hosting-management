import { Badge } from "@/components/ui/badge"
import { STATUS_LABEL } from "@/lib/domain/status"
import { cn } from "@/lib/utils"
import type { Colour } from "@/types/view"

export const STATUS_DOT: Record<Colour, string> = {
  green: "bg-green",
  orange: "bg-orange",
  red: "bg-red",
  expired: "bg-expired",
  cancelled: "bg-cancelled",
}

export function StatusBadge({
  colour,
  className,
}: {
  colour: Colour
  className?: string
}) {
  return (
    <Badge variant={colour} className={className}>
      <span aria-hidden className={cn("status-dot", STATUS_DOT[colour])} />
      {STATUS_LABEL[colour]}
    </Badge>
  )
}
