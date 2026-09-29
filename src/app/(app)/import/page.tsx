import type { Metadata } from "next"

import { PagePlaceholder } from "@/components/page-placeholder"

export const metadata: Metadata = { title: "Import" }

export default function ImportPage() {
  return (
    <PagePlaceholder>
      Upload a CSV, preview every row, then import the valid ones.
    </PagePlaceholder>
  )
}
