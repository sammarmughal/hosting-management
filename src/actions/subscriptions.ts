"use server"

import { redirect } from "next/navigation"

import { subscriptionSchema, type SubscriptionInput } from "@/lib/domain/validation"
import {
  checkFields,
  currencyError,
  fieldProblems,
  invalid,
  numericId,
  refreshApp,
  subscriptionData,
} from "@/lib/server/action-utils"
import { audit } from "@/lib/server/audit"
import { prisma, type Tx } from "@/lib/server/db"
import { fromDbDate } from "@/lib/server/db-dates"
import { requireAdmin } from "@/lib/server/session"
import { subscriptionProblems } from "@/lib/server/subscriptions"
import type { ActionResult } from "@/types/actions"

// docs/07 §2, docs/14 §4: subscriptions (were "services").

const savedHref = (clientId: number) =>
  `/clients/${clientId}?tab=subscriptions&saved=subscription`

export async function createSubscriptionAction(
  input: SubscriptionInput
): Promise<ActionResult> {
  await requireAdmin()
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  const bad = await currencyError(parsed.data.currency, "currency")
  if (bad) return bad
  const problems = await subscriptionProblems(parsed.data)
  if (problems) return fieldProblems(problems)
  const sub = await prisma.subscription.create({ data: subscriptionData(parsed.data) })
  await audit("subscription.create", { entity: "subscription", entityId: sub.id })
  refreshApp()
  redirect(savedHref(sub.clientId))
}

/** docs/03 §6: a hand-edited renewal date skips the old cycle's open reminders. */
async function skipOldCycle(tx: Tx, subscriptionId: number, oldCycle: Date) {
  await tx.reminder.updateMany({
    where: {
      subscriptionId,
      cycleDate: oldCycle,
      status: { in: ["pending", "failed", "opened"] },
    },
    data: { status: "skipped" },
  })
}

export async function updateSubscriptionAction(
  id: number,
  input: SubscriptionInput
): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  const current = await prisma.subscription.findUnique({ where: { id } })
  if (!current) return { ok: false, error: "Subscription not found." }
  const bad = await currencyError(parsed.data.currency, "currency", current.currency)
  if (bad) return bad
  const problems = await subscriptionProblems(parsed.data, {
    id,
    currentServiceTypeId: current.serviceTypeId,
  })
  if (problems) return fieldProblems(problems)
  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({ where: { id }, data: subscriptionData(parsed.data) })
    if (fromDbDate(current.renewalDate) !== parsed.data.renewalDate)
      await skipOldCycle(tx, id, current.renewalDate)
  })
  await audit("subscription.update", { entity: "subscription", entityId: id })
  refreshApp()
  redirect(savedHref(parsed.data.clientId))
}

export async function toggleCancelSubscriptionAction(
  id: number
): Promise<ActionResult<{ status: "active" | "cancelled" }>> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const current = await prisma.subscription.findUnique({ where: { id } })
  if (!current) return { ok: false, error: "Subscription not found." }
  const status = current.status === "cancelled" ? "active" : "cancelled"
  if (status === "active") {
    // Re-activating must not create a duplicate of an active one (docs/14 §4).
    const problems = await subscriptionProblems(current, {
      id,
      currentServiceTypeId: current.serviceTypeId,
    })
    if (problems?.domain) return { ok: false, error: problems.domain }
  }
  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id },
      data: { status, remindersEnabled: status === "active" },
    })
    // A cancelled subscription has no reminders (docs/10 §2).
    if (status === "cancelled") await skipOldCycle(tx, id, current.renewalDate)
  })
  await audit("subscription.cancel", {
    entity: "subscription",
    entityId: id,
    details: { status },
  })
  refreshApp()
  return { ok: true, data: { status } }
}

export async function deleteSubscriptionAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const { count } = await prisma.subscription.deleteMany({ where: { id } })
  if (!count) return { ok: false, error: "Subscription not found." }
  await audit("subscription.delete", { entity: "subscription", entityId: id })
  refreshApp()
  return { ok: true }
}
