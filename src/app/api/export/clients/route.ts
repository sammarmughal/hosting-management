import { toCsv } from "@/lib/domain/csv"
import { todayPK } from "@/lib/domain/dates"
import { exportClients } from "@/lib/data"
import { CLIENT_COLUMNS, CSV_BOM } from "@/lib/export-columns"
import { audit } from "@/lib/server/audit"
import { requireAdmin } from "@/lib/server/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/export/clients: one row per client (docs/14 §9), formula-injection safe. */
export async function GET() {
  await requireAdmin()
  await audit("export.csv", { entity: "clients" })
  const rows = await exportClients()
  return new Response(CSV_BOM + toCsv(rows, CLIENT_COLUMNS), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${todayPK()}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
