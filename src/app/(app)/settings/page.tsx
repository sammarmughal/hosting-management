import type { Metadata } from "next"
import { SettingsPanel } from "@/components/settings/settings-panel"
import { countInvoices, getPreferences, getRecentLogins } from "@/lib/data"
import { todayPK } from "@/lib/domain/dates"
export const metadata: Metadata = { title: "Settings" }
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const [initial, params, logins, invoiceCount] = await Promise.all([
    getPreferences(),
    searchParams,
    getRecentLogins(),
    countInvoices(),
  ])
  return (
    <SettingsPanel
      initial={initial}
      tab={params.tab ?? "business"}
      today={todayPK()}
      logins={logins}
      invoiceCount={invoiceCount}
    />
  )
}
