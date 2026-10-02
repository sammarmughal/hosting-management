import { Badge } from "@/components/ui/badge"
import type { ReminderRow } from "@/types/view"

const BADGE: Record<
  ReminderRow["status"],
  { label: string; variant: "neutral" | "brand" | "green" | "red" }
> = {
  pending: { label: "Pending", variant: "neutral" },
  opened: { label: "Opened", variant: "brand" },
  sent: { label: "Sent", variant: "green" },
  failed: { label: "Failed", variant: "red" },
  skipped: { label: "Skipped", variant: "neutral" },
}

export const REMINDER_STATUS_LABEL = Object.fromEntries(
  Object.entries(BADGE).map(([k, v]) => [k, v.label])
) as Record<ReminderRow["status"], string>

export function ReminderStatusBadge({ status }: { status: ReminderRow["status"] }) {
  const b = BADGE[status]
  return <Badge variant={b.variant}><span aria-hidden className="status-dot bg-current" />{b.label}</Badge>
}
