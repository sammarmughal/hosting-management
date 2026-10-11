import type { Metadata } from "next"

import { ImportFlow } from "@/components/import/import-flow"
import { exportServices, getSettings } from "@/lib/data"

export const metadata: Metadata = { title: "Import" }

export default async function ImportPage() {
  const [services, settings] = await Promise.all([exportServices(), getSettings()])
  return (
    <ImportFlow
      domains={services.map((s) => s.domain)}
      currencies={{
        default: settings.defaultCurrency,
        enabled: settings.enabledCurrencies,
      }}
    />
  )
}
