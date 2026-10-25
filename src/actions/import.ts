"use server"

import { z } from "zod"

import {
  previewClients,
  previewCompanies,
  previewSubscriptions,
  type ImportKind,
} from "@/lib/domain/import"
import { refreshApp, subscriptionData } from "@/lib/server/action-utils"
import { audit } from "@/lib/server/audit"
import { prisma } from "@/lib/server/db"
import { loadImportContext } from "@/lib/server/import-context"
import { requireAdmin } from "@/lib/server/session"
import type { ActionResult } from "@/types/actions"

const MAX_ROWS = 2000
const input = z.object({
  kind: z.enum(["clients", "companies", "subscriptions"]),
  rows: z.array(z.record(z.string(), z.string().max(5000))).max(MAX_ROWS),
  updateExisting: z.boolean(),
})

type Counts = { created: number; updated: number; skipped: number }

/**
 * Imports one CSV (docs/04 §9, docs/14 §9) in one transaction. The raw rows
 * are previewed again here against what the database holds now; rows with
 * errors are skipped, existing records are updated only when asked.
 */
export async function commitImportAction(
  kind: ImportKind,
  rows: Record<string, string>[],
  updateExisting: boolean
): Promise<ActionResult<Counts>> {
  await requireAdmin()
  const parsed = input.safeParse({ kind, rows, updateExisting })
  if (!parsed.success)
    return { ok: false, error: "Choose a CSV with no more than 2,000 rows." }
  const p = parsed.data

  const counts = await prisma.$transaction(
    async (tx) => {
      const ctx = await loadImportContext(tx)
      const counts: Counts = { created: 0, updated: 0, skipped: 0 }
      const tally = (existingId: number | null) => {
        if (existingId && !p.updateExisting) counts.skipped++
        else if (existingId) counts.updated++
        else counts.created++
        return !existingId || p.updateExisting
      }

      if (p.kind === "clients") {
        for (const r of previewClients(p.rows, ctx)) {
          if (!r.data) {
            counts.skipped++
            continue
          }
          if (!tally(r.existingId)) continue
          if (r.existingId)
            await tx.client.update({ where: { id: r.existingId }, data: r.data })
          else await tx.client.create({ data: r.data })
        }
      } else if (p.kind === "companies") {
        for (const r of previewCompanies(p.rows, ctx)) {
          if (!r.data) {
            counts.skipped++
            continue
          }
          if (!tally(r.existingId)) continue
          if (r.existingId)
            await tx.company.update({ where: { id: r.existingId }, data: r.data })
          else await tx.company.create({ data: r.data })
        }
      } else {
        for (const r of previewSubscriptions(p.rows, ctx)) {
          if (!r.data) {
            counts.skipped++
            continue
          }
          if (!tally(r.existingId)) continue
          const data = subscriptionData(r.data)
          if (r.existingId)
            await tx.subscription.update({ where: { id: r.existingId }, data })
          else await tx.subscription.create({ data })
        }
      }
      return counts
    },
    { timeout: 60_000 }
  )
  await audit("import.csv", { details: { kind: p.kind, ...counts } })
  refreshApp()
  return { ok: true, data: counts }
}
