import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { addDays, daysLeft as daysBetween } from "@/lib/domain/dates"
import {
  adminEmail as renderAdminEmail,
  adminWhatsappText,
  clientEmail,
} from "@/lib/domain/messages"
import { checkHorizon, checkIsDue, planCheck } from "@/lib/domain/reminder-engine"
import { linkProvider } from "@/lib/domain/whatsapp"
import { audit } from "@/lib/server/audit"
import { today as clockToday } from "@/lib/server/clock"
import { prisma, type Tx } from "@/lib/server/db"
import { fromDbDate, toDbDate } from "@/lib/server/db-dates"
import { MailError, sendMail } from "@/lib/server/mail"
import { invoiceFilename } from "@/lib/domain/invoices"
import { renderInvoicePdf } from "@/lib/server/invoice-pdf"
import { getInvoiceDocument } from "@/lib/server/invoice-queries"
import {
  createDueInvoices,
  markSent as markInvoiceSent,
  recordInvoiceEvent,
} from "@/lib/server/invoices"
import { getAppSettings, getTemplate, updateSettings } from "@/lib/server/settings"
import {
  messageInvoice,
  subscriptionInclude,
  toSubscriptionRow,
  viewContext,
} from "@/lib/server/view"
import type { SubscriptionRow } from "@/types/view"

// The reminder check (docs/04 §4) and sending (docs/04 §5). There is no
// cron: runCheck runs on dashboard load (throttled) and from "Check now",
// and it is idempotent, so running it twice queues nothing new.

const OPEN = ["pending", "failed", "opened"] as const
const LOCK_NAME = "check"

/**
 * Takes the `app_locks` row for the check without waiting. The row lock lasts
 * until the transaction ends, so a crash or rollback can't leave it held.
 */
async function tryCheckLock(tx: Tx): Promise<boolean> {
  const got = await tx.$queryRaw<{ name: string }[]>`
    SELECT name FROM app_locks WHERE name = ${LOCK_NAME} FOR UPDATE SKIP LOCKED`
  if (got.length) return true
  // Nothing back: either another check holds it, or the row is missing.
  const [row] = await tx.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM app_locks WHERE name = ${LOCK_NAME}`
  if (Number(row?.n ?? 0) === 0)
    throw new Error(
      `The "${LOCK_NAME}" lock row is missing: run the database migrations.`
    )
  return false
}

export interface CheckResult {
  /** false when it was throttled or another request held the lock. */
  ran: boolean
  subscriptionsChecked: number
  queuedNew: number
  skipped: number
  notificationsNew: number
  /** Invoices created for cycles inside the lead window (docs/13 §4). */
  invoicesNew: number
  emailsSent: number
  emailsFailed: number
  lastCheckAt: string
}

export async function runCheck({
  force = false,
  now = new Date(),
}: { force?: boolean; now?: Date } = {}): Promise<CheckResult> {
  const settings = await getAppSettings()
  const result: CheckResult = {
    ran: false,
    subscriptionsChecked: 0,
    queuedNew: 0,
    skipped: 0,
    notificationsNew: 0,
    invoicesNew: 0,
    emailsSent: 0,
    emailsFailed: 0,
    lastCheckAt: settings.lastCheckAt ?? now.toISOString(),
  }
  if (!force && !checkIsDue(settings.lastCheckAt, settings.checkIntervalMinutes, now))
    return result

  const today = clockToday(now)
  const horizon = checkHorizon(settings.stages)

  const ran = await prisma.$transaction(
    async (tx) => {
      // Another tab checking right now? The unique keys would block duplicates
      // anyway; the lock just avoids the wasted work.
      if (!(await tryCheckLock(tx))) return false

      const subs =
        horizon === null
          ? []
          : await tx.subscription.findMany({
              where: {
                status: "active",
                remindersEnabled: true,
                renewalDate: { lte: toDbDate(addDays(today, horizon)) },
              },
              select: {
                id: true,
                domain: true,
                renewalDate: true,
                status: true,
                remindersEnabled: true,
                client: { select: { email: true, phone: true } },
              },
            })
      const plans = planCheck(
        subs.map((s) => ({
          id: s.id,
          domain: s.domain,
          renewalDate: fromDbDate(s.renewalDate),
          status: s.status,
          remindersEnabled: s.remindersEnabled,
          clientEmail: s.client.email,
          clientPhone: s.client.phone,
        })),
        {
          today,
          stages: settings.stages,
          postExpiryToClient: settings.postExpiryToClient,
          hasAdminEmail: settings.adminEmail !== "",
          hasAdminWhatsapp: settings.adminWhatsapp !== "",
        }
      )
      result.subscriptionsChecked = subs.length

      // Skip superseded stages of this cycle and leftovers from older cycles.
      const byService = new Map(plans.map((p) => [p.subscriptionId, p]))
      const open = await tx.reminder.findMany({
        where: {
          subscriptionId: { in: [...byService.keys()] },
          status: { in: [...OPEN] },
        },
        select: { id: true, subscriptionId: true, cycleDate: true, stage: true },
      })
      const stale = open.filter((r) => {
        const p = byService.get(r.subscriptionId)
        return !!p && (fromDbDate(r.cycleDate) !== p.cycle || r.stage > p.stage)
      })
      if (stale.length) {
        const { count } = await tx.reminder.updateMany({
          where: { id: { in: stale.map((r) => r.id) } },
          data: { status: "skipped" },
        })
        result.skipped = count
      }

      const rows = plans.flatMap((p) =>
        p.rows.map((r) => ({
          subscriptionId: p.subscriptionId,
          cycleDate: toDbDate(p.cycle),
          stage: p.stage,
          channel: r.channel,
          recipient: r.recipient,
        }))
      )
      if (rows.length)
        result.queuedNew = (
          await tx.reminder.createMany({ data: rows, skipDuplicates: true })
        ).count
      if (plans.length)
        result.notificationsNew = (
          await tx.notification.createMany({
            data: plans.map((p) => ({
              subscriptionId: p.subscriptionId,
              ...p.notification,
            })),
            skipDuplicates: true,
          })
        ).count

      // docs/13 §4: invoices for active subscriptions inside the lead window.
      result.invoicesNew = await createDueInvoices(tx, settings, today)

      result.lastCheckAt = now.toISOString()
      await updateSettings({ last_check_at: result.lastCheckAt }, tx)
      return true
    },
    // READ COMMITTED: reads after the lock see what the
    // previous check committed (MySQL's default is REPEATABLE READ).
    { timeout: 20_000, isolationLevel: "ReadCommitted" }
  )
  result.ran = ran

  // docs/04 §4 step 7: optional auto-send, outside the transaction.
  if (ran && settings.autoSendEmails) {
    const pending = await prisma.reminder.findMany({
      where: { channel: "email", recipient: "client", status: "pending" },
      orderBy: { id: "asc" },
      take: settings.autoSendBatchSize,
      select: { id: true },
    })
    for (const r of pending) {
      const res = await sendReminderEmail(r.id)
      if (res.ok) result.emailsSent++
      else result.emailsFailed++
    }
    const summary = await sendAdminSummaryEmail()
    if (summary.ok && summary.count > 0) result.emailsSent++
    else if (!summary.ok) result.emailsFailed++
  }
  return result
}

/* Sending ------------------------------------------------------------ */

export type SendResult = { ok: true; sentAt: string } | { ok: false; error: string }

const reminderInclude = {
  subscription: { include: subscriptionInclude },
} satisfies Prisma.ReminderInclude

/** Client email for one reminder row (docs/04 §5.1). The SMTP error is stored on the row. */
export async function sendReminderEmail(id: bigint): Promise<SendResult> {
  const row = await prisma.reminder.findUnique({
    where: { id },
    include: reminderInclude,
  })
  if (!row || row.channel !== "email" || row.recipient !== "client")
    return { ok: false, error: "Reminder not found." }
  if (row.status !== "pending" && row.status !== "failed")
    return { ok: false, error: "This reminder was already handled." }
  const to = row.subscription.client.email
  if (!to) return { ok: false, error: "This client has no email address." }
  return deliverClientEmail(row.id, row.subscription, to)
}

async function deliverClientEmail(
  id: bigint,
  subscription: Prisma.SubscriptionGetPayload<{ include: typeof subscriptionInclude }>,
  to: string
): Promise<SendResult> {
  const [settings, template, ctx] = await Promise.all([
    getAppSettings(),
    getTemplate("client_email"),
    viewContext(),
  ])
  const view = toSubscriptionRow(subscription, ctx)
  // docs/13 §10: with an invoice for this cycle, attach the PDF and add the link.
  const cycleInvoice = subscription.invoices.find(
    (i) => i.periodStart.getTime() === subscription.renewalDate.getTime()
  )
  const message = clientEmail(
    template,
    view,
    ctx.business,
    ctx.today,
    cycleInvoice ? messageInvoice(cycleInvoice) : null
  )
  const at = new Date()
  try {
    const doc = cycleInvoice ? await getInvoiceDocument(cycleInvoice.id) : null
    const attachments = doc
      ? [
          {
            filename: invoiceFilename(doc.document.number, doc.domain),
            content: await renderInvoicePdf(doc.document),
            contentType: "application/pdf",
          },
        ]
      : undefined
    await sendMail(settings, { to, ...message, attachments })
    if (cycleInvoice) {
      await recordInvoiceEvent(cycleInvoice.id, "email_sent", { to, via: "reminder" })
      await markInvoiceSent(cycleInvoice.id)
    }
  } catch (err) {
    const error = err instanceof MailError ? err.message : "Email failed"
    await prisma.$transaction([
      prisma.reminder.update({
        where: { id },
        data: {
          status: "failed",
          attempts: { increment: 1 },
          lastError: error,
          sentAt: at,
        },
      }),
      prisma.notification.upsert({
        where: { dedupeKey: `email_failed:${id}` },
        create: {
          subscriptionId: subscription.id,
          type: "email_failed",
          title: `Email to ${subscription.client.name} failed`,
          body: error.slice(0, 500),
          dedupeKey: `email_failed:${id}`,
        },
        update: { isRead: false, body: error.slice(0, 500), createdAt: at },
      }),
    ])
    await audit("reminder.email.failed", {
      entity: "reminder",
      entityId: Number(id),
      details: { error },
    })
    return { ok: false, error }
  }
  await prisma.reminder.update({
    where: { id },
    data: { status: "sent", attempts: { increment: 1 }, lastError: null, sentAt: at },
  })
  await audit("reminder.email.sent", { entity: "reminder", entityId: Number(id) })
  return { ok: true, sentAt: at.toISOString() }
}

/** Distinct subscriptions behind a set of admin rows, most urgent first. */
async function adminRowsAndSubscriptions(
  channel: "email" | "whatsapp",
  statuses: string[]
) {
  const rows = await prisma.reminder.findMany({
    where: {
      channel,
      recipient: "admin",
      status: { in: statuses as ("pending" | "failed" | "opened")[] },
    },
    include: reminderInclude,
  })
  const ctx = await viewContext()
  const subs = new Map<number, SubscriptionRow>()
  for (const r of rows)
    if (!subs.has(r.subscriptionId))
      subs.set(r.subscriptionId, toSubscriptionRow(r.subscription, ctx))
  return { rows, subs: [...subs.values()], ctx }
}

/** One summary email to the admin (docs/04 §5.2); marks the admin-email rows sent. */
export async function sendAdminSummaryEmail(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const settings = await getAppSettings()
  if (!settings.adminEmail)
    return { ok: false, error: "Add your admin email in Settings → Business." }
  const { rows, subs, ctx } = await adminRowsAndSubscriptions("email", [
    "pending",
    "failed",
  ])
  if (subs.length === 0) return { ok: true, count: 0 }
  const template = await getTemplate("admin_email")
  const ids = rows.map((r) => r.id)
  try {
    await sendMail(settings, {
      to: settings.adminEmail,
      ...renderAdminEmail(template, subs, ctx.business, ctx.today),
    })
  } catch (err) {
    const error = err instanceof MailError ? err.message : "Email failed"
    await prisma.reminder.updateMany({
      where: { id: { in: ids } },
      data: { status: "failed", lastError: error, attempts: { increment: 1 } },
    })
    return { ok: false, error }
  }
  await prisma.reminder.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "sent",
      sentAt: new Date(),
      lastError: null,
      attempts: { increment: 1 },
    },
  })
  await audit("reminder.email.sent", {
    entity: "admin_summary",
    details: { count: subs.length },
  })
  return { ok: true, count: subs.length }
}

/** The admin WhatsApp summary link; marks the admin-WhatsApp rows opened (docs/04 §5.3). */
export async function openAdminSummaryWhatsapp(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const settings = await getAppSettings()
  const { rows, subs, ctx } = await adminRowsAndSubscriptions("whatsapp", [
    "pending",
    "failed",
  ])
  const prepared = linkProvider.prepare({
    to: settings.adminWhatsapp,
    text: adminWhatsappText(
      await getTemplate("admin_whatsapp"),
      subs,
      ctx.business,
      ctx.today
    ),
  })
  if (!prepared)
    return { ok: false, error: "Add your WhatsApp number in Settings → Business." }
  if (rows.length)
    await prisma.reminder.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: "opened", sentAt: new Date() },
    })
  return { ok: true, url: prepared.url }
}

/** WhatsApp rows: opened (link clicked) → sent (admin confirms) or skipped. */
export async function setReminderStatus(
  id: bigint,
  status: "opened" | "sent" | "skipped"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.reminder.findUnique({ where: { id } })
  if (!row) return { ok: false, error: "Reminder not found." }
  if (status !== "skipped" && row.channel !== "whatsapp")
    return { ok: false, error: "Only WhatsApp reminders are marked by hand." }
  if (row.status === "sent" && status !== "sent")
    return { ok: false, error: "This reminder was already sent." }
  await prisma.reminder.update({
    where: { id },
    data: { status, ...(status === "skipped" ? {} : { sentAt: new Date() }) },
  })
  await audit(status === "skipped" ? "reminder.skipped" : `reminder.whatsapp.${status}`, {
    entity: "reminder",
    entityId: Number(id),
  })
  return { ok: true }
}

/**
 * A reminder outside the stages (docs/07 §2): logged with stage = the
 * current days left, then sent like any client email.
 */
export async function sendManualEmail(subscriptionId: number): Promise<SendResult> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: subscriptionInclude,
  })
  if (!subscription) return { ok: false, error: "Subscription not found." }
  const to = subscription.client.email
  if (!to) return { ok: false, error: "This client has no email address." }
  const cycle = subscription.renewalDate
  const stage = daysBetween(fromDbDate(cycle), clockToday())
  const key = {
    subscriptionId,
    cycleDate: cycle,
    stage,
    channel: "email",
    recipient: "client",
  } as const
  const row = await prisma.reminder.upsert({
    where: { uq_reminder: key },
    create: key,
    update: {},
  })
  return deliverClientEmail(row.id, subscription, to)
}
