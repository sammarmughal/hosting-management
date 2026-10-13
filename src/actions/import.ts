"use server"

import { z } from "zod"

import { newClientSchema, type NewClientInput } from "@/lib/domain/validation"
import { refreshApp, serviceData } from "@/lib/server/action-utils"
import { audit } from "@/lib/server/audit"
import { prisma } from "@/lib/server/db"
import { getAppSettings } from "@/lib/server/settings"
import { requireAdmin } from "@/lib/server/session"
import type { ActionResult } from "@/types/actions"

/**
 * Imports the valid preview rows in one transaction (docs/04 §9). Rows are
 * validated again here. Same client name + email or phone → one client
 * (an existing client keeps their currency; the new service has its own).
 */
export async function commitImportAction(
  rows: NewClientInput[],
  updateExisting: boolean
): Promise<ActionResult<{ created: number; updated: number; skipped: number }>> {
  await requireAdmin()
  if (!Array.isArray(rows) || rows.length > 2000 || !z.boolean().safeParse(updateExisting).success)
    return { ok: false, error: "Choose a CSV with no more than 2,000 rows." }
  const parsed = rows.map((row) => newClientSchema.safeParse(row))
  const { enabledCurrencies } = await getAppSettings()
  const enabled = (c: string) => enabledCurrencies.includes(c)
  if (
    parsed.some(
      (p) => !p.success || !enabled(p.data.client.currency) || !enabled(p.data.service.currency)
    )
  )
    return { ok: false, error: "Some rows are invalid. Review the file and try again." }

  const counts = await prisma.$transaction(
    async (tx) => {
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
        const existing = await tx.service.findFirst({ where: { domain: service.domain } })
        if (existing) {
          if (updateExisting) {
            await tx.service.update({ where: { id: existing.id }, data: serviceData(service) })
            counts.updated++
          } else counts.skipped++
          continue
        }
        const contact = [
          ...(client.email ? [{ email: client.email }] : []),
          ...(client.phone ? [{ phone: client.phone }] : []),
        ]
        const sameClient = contact.length
          ? await tx.client.findFirst({
              where: { name: { equals: client.name }, OR: contact },
            })
          : null
        if (sameClient)
          await tx.service.create({ data: { clientId: sameClient.id, ...serviceData(service) } })
        else
          await tx.client.create({
            data: { ...client, services: { create: [serviceData(service)] } },
          })
        counts.created++
      }
      return counts
    },
    { timeout: 60_000 }
  )
  await audit("import.csv", { details: counts })
  refreshApp()
  return { ok: true, data: counts }
}
