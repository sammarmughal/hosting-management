"use server"

import { redirect } from "next/navigation"

import {
  clientSchema,
  currencyOptions,
  newClientSchema,
  serviceSchema,
  type ClientInput,
  type Currency,
  type NewClientInput,
  type ServiceInput,
} from "@/lib/domain/validation"
import {
  checkFields,
  invalid,
  numericId,
  refreshApp,
  serviceData,
} from "@/lib/server/action-utils"
import { audit } from "@/lib/server/audit"
import { prisma, type Tx } from "@/lib/server/db"
import { fromDbDate } from "@/lib/server/db-dates"
import { getAppSettings } from "@/lib/server/settings"
import { requireAdmin } from "@/lib/server/session"
import type { ActionResult } from "@/types/actions"

// docs/07 §2 actions/clients.ts + actions/services.ts.

const TAKEN = "This domain already belongs to a client"

async function domainTaken(domain: string, exceptServiceId?: number) {
  const found = await prisma.service.findFirst({
    where: { domain, ...(exceptServiceId ? { id: { not: exceptServiceId } } : {}) },
    select: { id: true },
  })
  return !!found
}

/** The currency must be enabled in settings; an edit may keep its current one. */
async function currencyError(
  currency: Currency,
  field: string,
  current?: string
): Promise<ActionResult<never> | null> {
  const { enabledCurrencies } = await getAppSettings()
  if (currencyOptions(enabledCurrencies, current).includes(currency)) return null
  return {
    ok: false,
    error: "Check the highlighted fields.",
    fieldErrors: { [field]: `${currency} isn’t turned on in Settings` },
  }
}

export async function createClientWithServiceAction(
  input: NewClientInput
): Promise<ActionResult> {
  await requireAdmin()
  const parsed = newClientSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  const bad = await currencyError(parsed.data.service.currency, "service.currency")
  if (bad) return bad
  if (await domainTaken(parsed.data.service.domain))
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { "service.domain": TAKEN },
    }
  const client = await prisma.client.create({
    data: {
      ...parsed.data.client,
      services: { create: [serviceData(parsed.data.service)] },
    },
  })
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
  const { count } = await prisma.client.updateMany({ where: { id }, data: parsed.data })
  if (!count) return { ok: false, error: "Client not found." }
  await audit("client.update", { entity: "client", entityId: id })
  refreshApp()
  redirect(`/clients/${id}?saved=client`)
}

export async function deleteClientAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  // Cascades to services, payments, reminders and notifications (docs/03 §6).
  const { count } = await prisma.client.deleteMany({ where: { id } })
  if (!count) return { ok: false, error: "Client not found." }
  await audit("client.delete", { entity: "client", entityId: id })
  refreshApp()
  redirect("/clients?deleted=client")
}

export async function createServiceAction(
  clientId: number,
  input: ServiceInput
): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(clientId).success) return invalid()
  const parsed = serviceSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  const bad = await currencyError(parsed.data.currency, "currency")
  if (bad) return bad
  if (await domainTaken(parsed.data.domain))
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: { domain: TAKEN } }
  if (!(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } })))
    return { ok: false, error: "Client not found." }
  const service = await prisma.service.create({
    data: { clientId, ...serviceData(parsed.data) },
  })
  await audit("service.create", { entity: "service", entityId: service.id })
  refreshApp()
  redirect(`/clients/${clientId}?saved=service`)
}

/** docs/03 §6: a hand-edited renewal date skips the old cycle's open reminders. */
async function skipOldCycle(tx: Tx, serviceId: number, oldCycle: Date) {
  await tx.reminder.updateMany({
    where: { serviceId, cycleDate: oldCycle, status: { in: ["pending", "failed", "opened"] } },
    data: { status: "skipped" },
  })
}

export async function updateServiceAction(
  id: number,
  input: ServiceInput
): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const parsed = serviceSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  const current = await prisma.service.findUnique({ where: { id } })
  if (!current) return { ok: false, error: "Service not found." }
  const bad = await currencyError(parsed.data.currency, "currency", current.currency)
  if (bad) return bad
  if (await domainTaken(parsed.data.domain, id))
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: { domain: TAKEN } }
  await prisma.$transaction(async (tx) => {
    await tx.service.update({ where: { id }, data: serviceData(parsed.data) })
    if (fromDbDate(current.renewalDate) !== parsed.data.renewalDate)
      await skipOldCycle(tx, id, current.renewalDate)
  })
  await audit("service.update", { entity: "service", entityId: id })
  refreshApp()
  redirect(`/clients/${current.clientId}?saved=service`)
}

export async function toggleCancelServiceAction(
  id: number
): Promise<ActionResult<{ status: "active" | "cancelled" }>> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const current = await prisma.service.findUnique({ where: { id } })
  if (!current) return { ok: false, error: "Service not found." }
  const status = current.status === "cancelled" ? "active" : "cancelled"
  await prisma.$transaction(async (tx) => {
    await tx.service.update({
      where: { id },
      data: { status, remindersEnabled: status === "active" },
    })
    // A cancelled service has no reminders (docs/10 §2).
    if (status === "cancelled") await skipOldCycle(tx, id, current.renewalDate)
  })
  await audit("service.cancel", { entity: "service", entityId: id, details: { status } })
  refreshApp()
  return { ok: true, data: { status } }
}

export async function deleteServiceAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const { count } = await prisma.service.deleteMany({ where: { id } })
  if (!count) return { ok: false, error: "Service not found." }
  await audit("service.delete", { entity: "service", entityId: id })
  refreshApp()
  return { ok: true }
}
