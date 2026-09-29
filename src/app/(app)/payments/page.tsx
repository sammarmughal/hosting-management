import type { Metadata } from "next"

import { PagePlaceholder } from "@/components/page-placeholder"

export const metadata: Metadata = { title: "Payments" }

export default function PaymentsPage() {
  return (
    <PagePlaceholder>
      All payments with a date filter, totals per currency and CSV export.
    </PagePlaceholder>
  )
}
