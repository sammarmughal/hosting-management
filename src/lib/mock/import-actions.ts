"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/mock/auth"
import { buildMockData } from "@/lib/mock/data"
import * as store from "@/lib/mock/mutations"
import { newClientSchema, type NewClientInput } from "@/lib/domain/validation"
import type { ActionResult } from "@/types/actions"

export async function commitImportAction(
  rows: NewClientInput[],
  updateExisting: boolean
): Promise<ActionResult<{ created: number; updated: number; skipped: number }>> {
  await requireAdmin()
  if (!Array.isArray(rows) || rows.length > 2000 || typeof updateExisting !== "boolean")
    return { ok: false, error: "Choose a CSV with no more than 2,000 rows." }
  const parsed = rows.map((row) => newClientSchema.safeParse(row))
  if (parsed.some((p) => !p.success))
    return { ok: false, error: "Some rows are invalid. Review the file and try again." }
  await new Promise((r) => setTimeout(r, 500))
  const counts = { created: 0, updated: 0, skipped: 0 }
  const seen = new Set<string>()
  for (const result of parsed) {
    if (!result.success) continue
    const { client, service } = result.data
    if (seen.has(service.domain)) {
      counts.skipped++
      continue
    }
    seen.add(service.domain)
    const data = buildMockData(new Date())
    const existing = data.services.find((s) => s.domain === service.domain)
    if (existing) {
      if (updateExisting) {
        store.updateService(existing.id, service)
        counts.updated++
      } else counts.skipped++
      continue
    }
    const sameClient = data.clients.find(
      (c) =>
        c.name.toLowerCase() === client.name.toLowerCase() &&
        ((client.email && client.email === c.email) ||
          (client.phone && client.phone === c.phone))
    )
    if (sameClient) store.createService(sameClient.id, service)
    else store.createClientWithService(client, service)
    counts.created++
  }
  revalidatePath("/", "layout")
  return { ok: true, data: counts }
}
