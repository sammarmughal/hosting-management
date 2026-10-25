// Empties tables between tests (FOREIGN_KEY_CHECKS=0 + TRUNCATE): every
// table with a foreign key to an emptied table is emptied too, and
// AUTO_INCREMENT counters start again at 1. Never touches app_locks (its
// 'check' row comes from the migration). service_types, which the migration
// also fills, gets its defaults back after it is emptied.
import type { PrismaClient } from "@/generated/prisma/client"
import { DEFAULT_SERVICE_TYPES } from "@/lib/domain/service-types"

/** Tables that hold a foreign key to the key table. */
const REFERENCED_BY: Record<string, string[]> = {
  admins: ["sessions", "password_resets"],
  clients: ["companies", "subscriptions", "invoices"],
  companies: ["subscriptions"],
  service_types: ["subscriptions"],
  subscriptions: ["payments", "reminders", "notifications", "invoices"],
  payments: ["invoices"],
  invoices: ["invoice_items", "invoice_events"],
}

export function withDependents(tables: string[]): string[] {
  const out = new Set<string>()
  const visit = (t: string) => {
    if (out.has(t)) return
    out.add(t)
    for (const child of REFERENCED_BY[t] ?? []) visit(child)
  }
  tables.forEach(visit)
  return [...out]
}

export async function resetDb(prisma: PrismaClient, tables: string[]) {
  const all = withDependents(tables)
  if (all.includes("app_locks")) throw new Error("app_locks must not be emptied")
  const bad = all.find((t) => !/^[a-z_]+$/.test(t))
  if (bad) throw new Error(`Not a table name: ${bad}`)
  // One connection for the whole reset, so the FOREIGN_KEY_CHECKS switch
  // applies to the TRUNCATEs and is switched back before the pool reuses it.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0")
    try {
      for (const t of all) await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``)
      if (all.includes("service_types"))
        await tx.serviceType.createMany({
          data: DEFAULT_SERVICE_TYPES.map((name, i) => ({ name, position: i + 1 })),
        })
    } finally {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1")
    }
  })
}
