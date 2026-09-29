import type { Metadata } from "next"

import { PagePlaceholder } from "@/components/page-placeholder"

export const metadata: Metadata = { title: "Clients" }

export default function ClientsPage() {
  return (
    <PagePlaceholder>
      Search, status filter chips and the services table, which becomes cards on mobile.
    </PagePlaceholder>
  )
}
