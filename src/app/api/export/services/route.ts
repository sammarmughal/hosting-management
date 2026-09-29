import { toCsv } from "@/lib/domain/csv"
import { todayPK } from "@/lib/domain/dates"
import { exportServices } from "@/lib/data"
import { requireAdmin } from "@/lib/mock/auth"
import type { ServiceRow } from "@/types/view"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Same headers as the import template (docs/04 §9) plus status and days left.
const COLUMNS: {
  header: string
  value: (s: ServiceRow) => string | number | null | undefined
}[] = [
  { header: "client_name", value: (s) => s.clientName },
  { header: "company", value: (s) => s.company },
  { header: "email", value: (s) => s.email },
  // Digits only: a leading "+" would get the formula-guard ' prefix.
  { header: "phone", value: (s) => s.phone },
  { header: "domain", value: (s) => s.domain },
  { header: "plan_label", value: (s) => s.planLabel },
  { header: "start_date", value: (s) => s.startDate },
  { header: "renewal_date", value: (s) => s.renewalDate },
  { header: "charge_amount", value: (s) => s.chargeAmount },
  { header: "currency", value: (s) => s.currency },
  { header: "status", value: (s) => s.status },
  { header: "days_left", value: (s) => s.daysLeft },
  { header: "notes", value: (s) => s.notes },
]

/** GET /api/export/services (docs/07 §3): CSV download, formula-injection safe. */
export async function GET() {
  await requireAdmin()
  const rows = await exportServices()
  // BOM so Excel opens UTF-8 (Urdu names) correctly.
  const body = "﻿" + toCsv(rows, COLUMNS)
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="services-${todayPK()}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
