import type { Metadata } from "next"

import { PagePlaceholder } from "@/components/page-placeholder"

export const metadata: Metadata = { title: "Reminders" }

export default function RemindersPage() {
  return (
    <PagePlaceholder>The reminder queue and the full log, with filters.</PagePlaceholder>
  )
}
