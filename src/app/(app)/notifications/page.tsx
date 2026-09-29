import type { Metadata } from "next"

import { PagePlaceholder } from "@/components/page-placeholder"

export const metadata: Metadata = { title: "Notifications" }

export default function NotificationsPage() {
  return (
    <PagePlaceholder>Notifications grouped by day, with Mark all read.</PagePlaceholder>
  )
}
