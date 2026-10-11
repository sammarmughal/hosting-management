import type { Metadata } from "next"
import { SettingsPanel } from "@/components/settings/settings-panel"
import { countInvoices, getCurrencyUsage, getPreferences, getRecentLogins } from "@/lib/data"
import { currencyCatalog } from "@/lib/domain/currency"
import { todayPK } from "@/lib/domain/dates"
export const metadata: Metadata = { title: "Settings" }
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const [initial, params, logins, invoiceCount, currencyUsage] = await Promise.all([
    getPreferences(),
    searchParams,
    getRecentLogins(),
    countInvoices(),
    getCurrencyUsage(),
  ])
  return (
    <SettingsPanel
      initial={initial}
      tab={params.tab ?? "business"}
      today={todayPK()}
      logins={logins}
      invoiceCount={invoiceCount}
      currencyCatalog={currencyCatalog()}
      currencyUsage={currencyUsage}
    />
  )
}
