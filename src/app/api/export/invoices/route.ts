import { toCsv } from "@/lib/domain/csv"
import { todayPK } from "@/lib/domain/dates"
import { plainAmount } from "@/lib/domain/money"
import { exportInvoices, type InvoiceExportRow } from "@/lib/data"
import { audit } from "@/lib/server/audit"
import { requireAdmin } from "@/lib/server/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const money = (pick: (i: InvoiceExportRow) => string) => (i: InvoiceExportRow) =>
  plainAmount(pick(i), i.currency)

const COLUMNS: {
  header: string
  value: (i: InvoiceExportRow) => string | number | null | undefined
}[] = [
  { header: "number", value: (i) => i.number },
  { header: "issue_date", value: (i) => i.issueDate },
  { header: "due_date", value: (i) => i.dueDate },
  { header: "client_name", value: (i) => i.clientName },
  { header: "company", value: (i) => i.company },
  { header: "service_type", value: (i) => i.serviceName },
  { header: "domain", value: (i) => i.domain },
  { header: "period_start", value: (i) => i.periodStart },
  { header: "period_end", value: (i) => i.periodEnd },
  { header: "currency", value: (i) => i.currency },
  { header: "subtotal", value: money((i) => i.subtotal) },
  { header: "discount", value: money((i) => i.discount) },
  { header: "tax_rate", value: (i) => i.taxRate },
  { header: "tax_amount", value: money((i) => i.taxAmount) },
  { header: "total", value: money((i) => i.total) },
  { header: "status", value: (i) => i.status },
  { header: "paid_on", value: (i) => i.paidOn },
  { header: "void_reason", value: (i) => i.voidReason },
]

/** GET /api/export/invoices: every invoice (Settings → Backup), formula-injection safe. */
export async function GET() {
  await requireAdmin()
  await audit("export.csv", { entity: "invoices" })
  const rows = await exportInvoices()
  return new Response("﻿" + toCsv(rows, COLUMNS), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${todayPK()}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
