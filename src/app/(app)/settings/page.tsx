import type { Metadata } from "next"

import { PagePlaceholder } from "@/components/page-placeholder"

export const metadata: Metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <PagePlaceholder>
      Business, reminders, email, templates and security settings.
    </PagePlaceholder>
  )
}
