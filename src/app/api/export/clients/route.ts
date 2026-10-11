import { toCsv } from "@/lib/domain/csv"
import { todayPK } from "@/lib/domain/dates"
import { exportClients, type ClientExportRow } from "@/lib/data"
import { audit } from "@/lib/server/audit"
import { requireAdmin } from "@/lib/server/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COLUMNS: {
  header: string
  value: (c: ClientExportRow) => string | number | null | undefined
}[] = [
  { header: "client_name", value: (c) => c.name },
  { header: "company", value: (c) => c.company },
  { header: "email", value: (c) => c.email },
  // Digits only: a leading "+" would get the formula-guard ' prefix.
  { header: "phone", value: (c) => c.phone },
  { header: "address", value: (c) => c.address },
  { header: "client_currency", value: (c) => c.currency },
  { header: "services", value: (c) => c.services },
  { header: "notes", value: (c) => c.notes },
  { header: "created_on", value: (c) => c.createdOn },
]

/** GET /api/export/clients: one row per client (Settings → Backup), formula-injection safe. */
export async function GET() {
  await requireAdmin()
  await audit("export.csv", { entity: "clients" })
  const rows = await exportClients()
  // BOM so Excel opens UTF-8 (Urdu names) correctly.
  return new Response("﻿" + toCsv(rows, COLUMNS), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${todayPK()}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
