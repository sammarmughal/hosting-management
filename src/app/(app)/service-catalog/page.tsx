import type { Metadata } from "next"

import { ServiceCatalog } from "@/components/catalog/service-catalog"
import { listServiceTypes } from "@/lib/data"

export const metadata: Metadata = { title: "Service Catalog" }

// docs/14 §2
export default async function ServiceCatalogPage() {
  return <ServiceCatalog rows={await listServiceTypes()} />
}
