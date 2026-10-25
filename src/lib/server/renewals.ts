import "server-only"

import { nextRenewal } from "@/lib/domain/cycles"
import { formatDatePK, type ISODate } from "@/lib/domain/dates"
import { PAYMENT_METHOD_KEYS, type RenewData } from "@/lib/domain/validation"
import { audit } from "@/lib/server/audit"
import { today as clockToday } from "@/lib/server/clock"
import { prisma } from "@/lib/server/db"
import { fromDbDate, toDbDate } from "@/lib/server/db-dates"
import { markCycleInvoicePaid } from "@/lib/server/invoices"

/**
 * docs/04 §6, one transaction: record the payment, move the renewal date
 * one billing cycle on (docs/14 §1), skip the old cycle's open reminders, add a notification.
 */
export async function renewSubscription(input: RenewData): Promise<ISODate | null> {
  const today = clockToday()
  const result = await prisma.$transaction(
    async (tx) => {
      // Lock the row so two renewals can't both extend from the same date.
      const locked = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM subscriptions WHERE id = ${input.subscriptionId} FOR UPDATE`
      if (locked.length === 0) return null
      const s = await tx.subscription.findUniqueOrThrow({
        where: { id: input.subscriptionId },
      })
      const oldRenewal = fromDbDate(s.renewalDate)
      const from = input.extendFrom === "today" ? today : oldRenewal
      const newRenewal = nextRenewal(from)

      const payment = await tx.payment.create({
        data: {
          subscriptionId: s.id,
          amount: input.amount,
          currency: s.currency,
          paidOn: toDbDate(input.paidOn),
          method: PAYMENT_METHOD_KEYS[input.method],
          reference: input.reference || null,
          notes: input.notes || null,
          periodFrom: toDbDate(from),
          periodTo: toDbDate(newRenewal),
        },
      })
      await tx.subscription.update({
        where: { id: s.id },
        data: { renewalDate: toDbDate(newRenewal) },
      })
      // docs/13 §5: the cycle's open invoice becomes paid and links the payment.
      await markCycleInvoicePaid(tx, s.id, s.renewalDate, {
        id: payment.id,
        paidOn: input.paidOn,
      })
      await tx.reminder.updateMany({
        where: {
          subscriptionId: s.id,
          cycleDate: s.renewalDate,
          status: { in: ["pending", "failed", "opened"] },
        },
        data: { status: "skipped" },
      })
      await tx.notification.createMany({
        data: [
          {
            subscriptionId: s.id,
            type: "renewed",
            title: `${s.domain} renewed until ${formatDatePK(newRenewal)}`,
            dedupeKey: `renew:${s.id}:${newRenewal}`,
          },
        ],
        skipDuplicates: true,
      })
      await audit("subscription.renew", {
        entity: "subscription",
        entityId: s.id,
        details: { from, to: newRenewal, amount: input.amount },
        db: tx,
      })
      return newRenewal
      // READ COMMITTED: the reads after FOR UPDATE see the latest
      // committed row, not a snapshot (MySQL's default is REPEATABLE READ).
    },
    { isolationLevel: "ReadCommitted" }
  )
  return result
}
