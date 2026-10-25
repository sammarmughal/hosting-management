import { toCsv } from "@/lib/domain/csv"
import { todayPK } from "@/lib/domain/dates"
import { exportCompanies } from "@/lib/data"
import { COMPANY_COLUMNS, CSV_BOM } from "@/lib/export-columns"
import { audit } from "@/lib/server/audit"
import { requireAdmin } from "@/lib/server/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/export/companies: one row per company (docs/14 §9), formula-injection safe. */
export async function GET() {
  await requireAdmin()
  await audit("export.csv", { entity: "companies" })
  const rows = await exportCompanies()
  return new Response(CSV_BOM + toCsv(rows, COMPANY_COLUMNS), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="companies-${todayPK()}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
