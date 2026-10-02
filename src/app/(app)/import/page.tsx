import type { Metadata } from "next"

import { ImportFlow } from "@/components/import/import-flow"
import { exportServices } from "@/lib/data"

export const metadata: Metadata = { title: "Import" }

export default async function ImportPage() {
  const services = await exportServices()
  return <ImportFlow domains={services.map((s) => s.domain)} />
}
