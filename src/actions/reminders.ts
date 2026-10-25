"use server"

// docs/07 §2 actions/reminders.ts. One email per call (CLAUDE.md rule 10).
import { z } from "zod"

import { bigId, invalid, numericId, refreshApp } from "@/lib/server/action-utils"
import { prisma } from "@/lib/server/db"
import {
  openAdminSummaryWhatsapp,
  runCheck,
  sendAdminSummaryEmail,
  sendManualEmail,
  sendReminderEmail,
  setReminderStatus,
  type CheckResult,
} from "@/lib/server/reminders"
import { requireAdmin } from "@/lib/server/session"
import type { ActionResult } from "@/types/actions"

/** "Check now": the same idempotent check the dashboard runs, but forced. */
export async function checkNowAction(): Promise<ActionResult<CheckResult>> {
  await requireAdmin()
  const result = await runCheck({ force: true })
  refreshApp()
  return { ok: true, data: result }
}

export async function getPendingEmailIdsAction(): Promise<
  ActionResult<{ items: { id: string; name: string; email: string; domain: string }[] }>
> {
  await requireAdmin()
  const rows = await prisma.reminder.findMany({
    where: {
      channel: "email",
      recipient: "client",
      status: { in: ["pending", "failed"] },
    },
    include: { subscription: { include: { client: true } } },
    orderBy: { id: "asc" },
  })
  return {
    ok: true,
    data: {
      items: rows.flatMap((r) =>
        r.subscription.client.email
          ? [
              {
                id: r.id.toString(),
                name: r.subscription.client.name,
                email: r.subscription.client.email,
                domain: r.subscription.domain,
              },
            ]
          : []
      ),
    },
  }
}

export async function sendReminderEmailAction(
  id: string
): Promise<ActionResult<{ status: "sent"; sentAt: string }>> {
  await requireAdmin()
  const parsed = bigId.safeParse(id)
  if (!parsed.success) return invalid()
  const res = await sendReminderEmail(parsed.data)
  refreshApp()
  return res.ok
    ? { ok: true, data: { status: "sent", sentAt: res.sentAt } }
    : { ok: false, error: res.error }
}

async function setStatus(id: string, status: "opened" | "sent" | "skipped") {
  await requireAdmin()
  const parsed = bigId.safeParse(id)
  if (!parsed.success) return invalid()
  const res = await setReminderStatus(parsed.data, status)
  refreshApp()
  return res
}

export async function markOpenedAction(id: string): Promise<ActionResult> {
  await requireAdmin()
  return setStatus(id, "opened")
}

export async function markSentAction(id: string): Promise<ActionResult> {
  await requireAdmin()
  return setStatus(id, "sent")
}

export async function skipReminderAction(id: string): Promise<ActionResult> {
  await requireAdmin()
  return setStatus(id, "skipped")
}

const bothInput = z.object({
  emailId: z.string().nullable(),
  whatsappId: z.string().nullable(),
})

/**
 * The single-click "Send email + WhatsApp". The browser has already opened
 * the wa.me link synchronously in the click handler; this records that and
 * sends the email in the same request. Either id may be null when that
 * channel isn't available.
 */
export async function sendEmailAndWhatsappAction(input: {
  emailId: string | null
  whatsappId: string | null
}): Promise<
  ActionResult<{
    email: { ok: true; sentAt: string } | { ok: false; error: string } | null
    whatsapp: { ok: true; openedAt: string } | { ok: false; error: string } | null
  }>
> {
  await requireAdmin()
  const p = bothInput.safeParse(input)
  if (!p.success || (!p.data.emailId && !p.data.whatsappId)) return invalid()
  const emailId = p.data.emailId ? bigId.safeParse(p.data.emailId) : null
  const whatsappId = p.data.whatsappId ? bigId.safeParse(p.data.whatsappId) : null
  if ((emailId && !emailId.success) || (whatsappId && !whatsappId.success))
    return invalid()

  const whatsapp = whatsappId?.success
    ? await setReminderStatus(whatsappId.data, "opened").then((r) =>
        r.ok ? { ok: true as const, openedAt: new Date().toISOString() } : r
      )
    : null
  const email = emailId?.success ? await sendReminderEmail(emailId.data) : null
  refreshApp()
  return { ok: true, data: { email, whatsapp } }
}

export async function sendAdminSummaryEmailAction(): Promise<
  ActionResult<{ count: number }>
> {
  await requireAdmin()
  const res = await sendAdminSummaryEmail()
  refreshApp()
  return res.ok ? { ok: true, data: { count: res.count } } : res
}

/**
 * The admin WhatsApp summary: returns the link and marks the admin rows
 * opened. The dashboard already renders the link as an <a href> and calls
 * this on click (opening a URL after an await would be blocked as a popup).
 */
export async function adminSummaryWhatsappAction(): Promise<
  ActionResult<{ url: string }>
> {
  await requireAdmin()
  const res = await openAdminSummaryWhatsapp()
  refreshApp()
  return res.ok ? { ok: true, data: { url: res.url } } : res
}

export async function sendManualEmailAction(
  subscriptionId: number
): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(subscriptionId).success) return invalid()
  const res = await sendManualEmail(subscriptionId)
  refreshApp()
  return res.ok ? { ok: true } : res
}
