import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { PagePlaceholder } from "@/components/page-placeholder"

export const metadata: Metadata = { title: "Add client" }

export default function NewClientPage() {
  return (
    <>
      <PageHeader title="Add client" />
      <PagePlaceholder>
        Client details and the first hosting service, with a live timer preview.
      </PagePlaceholder>
    </>
  )
}
