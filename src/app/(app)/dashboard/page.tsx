import type { Metadata } from "next"

import { PagePlaceholder } from "@/components/page-placeholder"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return (
    <PagePlaceholder>
      Stat cards, the reminder queue (Send all emails, WhatsApp, Skip) and the due-soon
      list.
    </PagePlaceholder>
  )
}
