"use server"

import { z } from "zod"

import { serviceTypeDeleteBlock } from "@/lib/domain/service-types"
import { serviceTypeSchema, type ServiceTypeInput } from "@/lib/domain/validation"
import {
  checkFields,
  fieldProblems,
  invalid,
  numericId,
  refreshApp,
} from "@/lib/server/action-utils"
import { audit } from "@/lib/server/audit"
import { prisma } from "@/lib/server/db"
import { requireAdmin } from "@/lib/server/session"
import type { ActionResult } from "@/types/actions"

// The Service Catalog (docs/14 §2). Edited in a dialog, so no redirects.

const TAKEN = "A service with this name already exists"

/** Names are unique ignoring case (the collation does that). */
async function nameTaken(name: string, exceptId?: number) {
  const found = await prisma.serviceType.findFirst({
    where: { name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  })
  return !!found
}

export async function createServiceTypeAction(
  input: ServiceTypeInput
): Promise<ActionResult> {
  await requireAdmin()
  const parsed = serviceTypeSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  if (await nameTaken(parsed.data.name)) return fieldProblems({ name: TAKEN })
  const last = await prisma.serviceType.aggregate({ _max: { position: true } })
  const type = await prisma.serviceType.create({
    data: { ...parsed.data, position: (last._max.position ?? 0) + 1 },
  })
  await audit("service_type.create", { entity: "service_type", entityId: type.id })
  refreshApp()
  return { ok: true }
}

export async function updateServiceTypeAction(
  id: number,
  input: ServiceTypeInput
): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const parsed = serviceTypeSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  if (await nameTaken(parsed.data.name, id)) return fieldProblems({ name: TAKEN })
  const { count } = await prisma.serviceType.updateMany({
    where: { id },
    data: parsed.data,
  })
  if (!count) return { ok: false, error: "Service not found." }
  await audit("service_type.update", { entity: "service_type", entityId: id })
  refreshApp()
  return { ok: true }
}

/** Active ⇄ inactive. Inactive types can't be picked for new subscriptions. */
export async function setServiceTypeActiveAction(
  id: number,
  isActive: boolean
): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success || !z.boolean().safeParse(isActive).success)
    return invalid()
  const { count } = await prisma.serviceType.updateMany({
    where: { id },
    data: { isActive },
  })
  if (!count) return { ok: false, error: "Service not found." }
  await audit("service_type.update", {
    entity: "service_type",
    entityId: id,
    details: { isActive },
  })
  refreshApp()
  return { ok: true }
}

/** Only an unused type can go; the foreign key refuses it too (docs/14 §2). */
export async function deleteServiceTypeAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const usedBy = await prisma.subscription.count({ where: { serviceTypeId: id } })
  const block = serviceTypeDeleteBlock(usedBy)
  if (block) return { ok: false, error: block }
  const { count } = await prisma.serviceType.deleteMany({ where: { id } })
  if (!count) return { ok: false, error: "Service not found." }
  await audit("service_type.delete", { entity: "service_type", entityId: id })
  refreshApp()
  return { ok: true }
}
