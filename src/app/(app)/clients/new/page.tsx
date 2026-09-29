import type { Metadata } from "next"

import { PagePlaceholder } from "@/components/page-placeholder"

export const metadata: Metadata = { title: "Add client" }

export default function NewClientPage() {
  return (
    <PagePlaceholder>
      Client details and the first hosting service, with a live timer preview.
    </PagePlaceholder>
  )
}
