import { toCsv } from "@/lib/domain/csv"
import { todayPK } from "@/lib/domain/dates"
import { exportSubscriptions } from "@/lib/data"
import { CSV_BOM, SUBSCRIPTION_COLUMNS } from "@/lib/export-columns"
import { audit } from "@/lib/server/audit"
import { requireAdmin } from "@/lib/server/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/export/subscriptions (docs/07 §3, docs/14 §9): CSV download, formula-injection safe. */
export async function GET() {
  await requireAdmin()
  await audit("export.csv", { entity: "subscriptions" })
  const rows = await exportSubscriptions()
  return new Response(CSV_BOM + toCsv(rows, SUBSCRIPTION_COLUMNS), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscriptions-${todayPK()}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
