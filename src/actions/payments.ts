"use server"

import { renewSchema, type RenewInput } from "@/lib/domain/validation"
import { checkFields, invalid, numericId, refreshApp } from "@/lib/server/action-utils"
import { audit } from "@/lib/server/audit"
import { today } from "@/lib/server/clock"
import { prisma } from "@/lib/server/db"
import { renewService } from "@/lib/server/renewals"
import { requireAdmin } from "@/lib/server/session"
import type { ActionResult } from "@/types/actions"

export async function renewServiceAction(
  input: RenewInput
): Promise<ActionResult<{ newRenewalDate: string }>> {
  await requireAdmin()
  const first = renewSchema(today()).safeParse(input)
  if (!first.success) return checkFields(first.error)
  // The payment takes the service's currency, so its decimals apply.
  const service = await prisma.service.findUnique({
    where: { id: first.data.serviceId },
    select: { currency: true },
  })
  if (!service) return { ok: false, error: "Service not found." }
  const parsed = renewSchema(today(), service.currency).safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  const newRenewalDate = await renewService(parsed.data)
  if (!newRenewalDate) return { ok: false, error: "Service not found." }
  refreshApp()
  return { ok: true, data: { newRenewalDate } }
}

/** Removes the record only; the renewal date is not rolled back (docs/07 §2). */
export async function deletePaymentAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const { count } = await prisma.payment.deleteMany({ where: { id } })
  if (!count) return { ok: false, error: "Payment not found." }
  await audit("payment.delete", { entity: "payment", entityId: id })
  refreshApp()
  return { ok: true }
}
