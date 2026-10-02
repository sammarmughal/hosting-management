import type { Metadata } from "next"
import { BellIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import {
  NotificationsFeed,
  type NotificationGroup,
} from "@/components/notifications/notifications-feed"
import { addDays, formatDatePK, todayPK } from "@/lib/domain/dates"
import { formatRelative } from "@/lib/domain/relative-time"
import { listNotifications } from "@/lib/data"

export const metadata: Metadata = { title: "Notifications" }

// docs/06 §4.11: grouped by Pakistan calendar day, newest first.
export default async function NotificationsPage() {
  const { items } = await listNotifications()
  const now = new Date()
  const today = todayPK(now)
  const yesterday = addDays(today, -1)

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState
          icon={BellIcon}
          message="No notifications yet. Renewals, failed emails and payments show up here."
        />
      </div>
    )
  }

  const groups: NotificationGroup[] = []
  for (const item of items) {
    const day = todayPK(new Date(item.createdAt))
    const label =
      day === today ? "Today" : day === yesterday ? "Yesterday" : formatDatePK(day)
    let group = groups.find((g) => g.label === label)
    if (!group) groups.push((group = { label, items: [] }))
    group.items.push({ ...item, initialTime: formatRelative(item.createdAt, now) })
  }

  return <NotificationsFeed groups={groups} />
}
