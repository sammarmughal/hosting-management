import { toCsv } from "@/lib/domain/csv"
import { todayPK } from "@/lib/domain/dates"
import { exportPayments } from "@/lib/data"
import { parsePaymentParams } from "@/lib/list-filters"
import { requireAdmin } from "@/lib/mock/auth"
import type { PaymentRow } from "@/types/view"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COLUMNS: {
  header: string
  value: (p: PaymentRow) => string | number | null | undefined
}[] = [
  { header: "paid_on", value: (p) => p.paidOn },
  { header: "client_name", value: (p) => p.clientName },
  { header: "domain", value: (p) => p.domain },
  { header: "amount", value: (p) => p.amount },
  { header: "currency", value: (p) => p.currency },
  { header: "method", value: (p) => p.method },
  { header: "reference", value: (p) => p.reference },
  { header: "period_from", value: (p) => p.periodFrom },
  { header: "period_to", value: (p) => p.periodTo },
]

/** GET /api/export/payments?from&to (docs/07 §3): CSV download, formula-injection safe. */
export async function GET(request: Request) {
  await requireAdmin()
  const { searchParams } = new URL(request.url)
  const range = parsePaymentParams(Object.fromEntries(searchParams))
  const rows = await exportPayments(range)
  return new Response("﻿" + toCsv(rows, COLUMNS), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${todayPK()}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
