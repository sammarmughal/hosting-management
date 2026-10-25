"use server"

import { redirect } from "next/navigation"

import { clientSchema, type ClientInput } from "@/lib/domain/validation"
import {
  checkFields,
  currencyError,
  invalid,
  numericId,
  refreshApp,
} from "@/lib/server/action-utils"
import { audit } from "@/lib/server/audit"
import { prisma } from "@/lib/server/db"
import { requireAdmin } from "@/lib/server/session"
import type { ActionResult } from "@/types/actions"

// docs/07 §2 actions/clients.ts. A client is customer info only; companies
// and subscriptions are added separately (docs/14 §0).

export async function createClientAction(input: ClientInput): Promise<ActionResult> {
  await requireAdmin()
  const parsed = clientSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  const bad = await currencyError(parsed.data.currency, "currency")
  if (bad) return bad
  const client = await prisma.client.create({ data: parsed.data })
  await audit("client.create", { entity: "client", entityId: client.id })
  refreshApp()
  redirect(`/clients/${client.id}?saved=client`)
}

export async function updateClientAction(
  id: number,
  input: ClientInput
): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const parsed = clientSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  const current = await prisma.client.findUnique({
    where: { id },
    select: { currency: true },
  })
  if (!current) return { ok: false, error: "Client not found." }
  // Existing subscriptions keep their own currency; only new ones start in this.
  const bad = await currencyError(parsed.data.currency, "currency", current.currency)
  if (bad) return bad
  const { count } = await prisma.client.updateMany({ where: { id }, data: parsed.data })
  if (!count) return { ok: false, error: "Client not found." }
  await audit("client.update", { entity: "client", entityId: id })
  refreshApp()
  redirect(`/clients/${id}?saved=client`)
}

export async function deleteClientAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  // Cascades to companies, subscriptions, payments, invoices, reminders and
  // notifications (docs/03 §6, docs/14 §1).
  const { count } = await prisma.client.deleteMany({ where: { id } })
  if (!count) return { ok: false, error: "Client not found." }
  await audit("client.delete", { entity: "client", entityId: id })
  refreshApp()
  redirect("/clients?deleted=client")
}
