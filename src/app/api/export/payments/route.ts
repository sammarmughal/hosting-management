import { toCsv } from "@/lib/domain/csv"
import { todayPK } from "@/lib/domain/dates"
import { exportPayments } from "@/lib/data"
import { PAYMENT_COLUMNS } from "@/lib/export-columns"
import { parsePaymentParams } from "@/lib/list-filters"
import { audit } from "@/lib/server/audit"
import { requireAdmin } from "@/lib/server/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/export/payments?from&to (docs/07 §3): CSV download, formula-injection safe. */
export async function GET(request: Request) {
  await requireAdmin()
  await audit("export.csv", { entity: "payments" })
  const { searchParams } = new URL(request.url)
  const range = parsePaymentParams(Object.fromEntries(searchParams))
  const rows = await exportPayments(range)
  return new Response("﻿" + toCsv(rows, PAYMENT_COLUMNS), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${todayPK()}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
