"use server"

// Phase 1 fake Server Actions (docs/06 §7.2, signatures from docs/07 §2).
// They wait 400–700 ms, validate input like the real ones will, and change
// nothing. About 1 in 5 emails fails so the error states can be designed.
import { redirect } from "next/navigation"
import { z } from "zod"

import { addOneYear, formatDatePK, todayPK } from "@/lib/domain/dates"
import { DEFAULT_TEMPLATES } from "@/lib/domain/default-templates"
import { formatMoney } from "@/lib/domain/money"
import { renderTemplate } from "@/lib/domain/templates"
import { buildWaLink } from "@/lib/domain/whatsapp"
import { requireAdmin } from "@/lib/mock/auth"
import { buildMockData, MOCK_SETTINGS } from "@/lib/mock/data"
import type { ActionResult } from "@/types/actions"
import type { NotificationItem } from "@/types/view"

const SMTP_ERRORS = [
  "Invalid login: 535 5.7.8 Error: authentication failed",
  "Connection timeout: smtp.hostinger.com:465 did not respond (ETIMEDOUT)",
  "550 5.1.1 Recipient address rejected: User unknown in virtual mailbox table",
  "421 4.7.0 Too many messages from this sender, try again later",
]

const stringId = z.string().min(1).max(64)
const numericId = z.number().int().positive()

function sleep() {
  return new Promise((r) => setTimeout(r, 400 + Math.random() * 300))
}

function invalid(): ActionResult<never> {
  return { ok: false, error: "Invalid request." }
}

/* Reminders --------------------------------------------------------- */

export async function checkNowAction(): Promise<
  ActionResult<{
    queuedNew: number
    skipped: number
    notificationsNew: number
    emailsSent: number
    emailsFailed: number
    lastCheckAt: string
  }>
> {
  await requireAdmin()
  await sleep()
  return {
    ok: true,
    data: {
      queuedNew: 0,
      skipped: 0,
      notificationsNew: 0,
      emailsSent: 0,
      emailsFailed: 0,
      lastCheckAt: new Date().toISOString(),
    },
  }
}

export async function getPendingEmailIdsAction(): Promise<
  ActionResult<{ items: { id: string; name: string; email: string; domain: string }[] }>
> {
  await requireAdmin()
  const items = buildMockData(new Date())
    .reminders.filter(
      (r) =>
        r.channel === "email" &&
        r.recipient === "client" &&
        (r.status === "pending" || r.status === "failed") &&
        r.service.email
    )
    .map((r) => ({
      id: r.id,
      name: r.service.clientName,
      email: r.service.email ?? "",
      domain: r.service.domain,
    }))
  return { ok: true, data: { items } }
}

export async function sendReminderEmailAction(
  id: string
): Promise<ActionResult<{ status: "sent"; sentAt: string }>> {
  await requireAdmin()
  if (!stringId.safeParse(id).success) return invalid()
  await sleep()
  if (Math.random() < 0.2) {
    const error =
      SMTP_ERRORS[Math.floor(Math.random() * SMTP_ERRORS.length)] ?? "Email failed"
    return { ok: false, error }
  }
  return { ok: true, data: { status: "sent", sentAt: new Date().toISOString() } }
}

export async function markOpenedAction(id: string): Promise<ActionResult> {
  await requireAdmin()
  if (!stringId.safeParse(id).success) return invalid()
  await sleep()
  return { ok: true }
}

export async function markSentAction(id: string): Promise<ActionResult> {
  await requireAdmin()
  if (!stringId.safeParse(id).success) return invalid()
  await sleep()
  return { ok: true }
}

export async function skipReminderAction(id: string): Promise<ActionResult> {
  await requireAdmin()
  if (!stringId.safeParse(id).success) return invalid()
  await sleep()
  return { ok: true }
}

export async function sendAdminSummaryEmailAction(): Promise<
  ActionResult<{ count: number }>
> {
  await requireAdmin()
  await sleep()
  const count = buildMockData(new Date()).reminders.filter(
    (r) => r.status !== "sent"
  ).length
  return { ok: true, data: { count } }
}

const SUMMARY_DOT = {
  red: "🔴",
  orange: "🟠",
  expired: "⚫",
  green: "🟢",
  cancelled: "⚪",
}

export async function adminSummaryWhatsappAction(): Promise<
  ActionResult<{ url: string }>
> {
  await requireAdmin()
  await sleep()
  const d = buildMockData(new Date())
  const services = [
    ...new Map(
      d.reminders.filter((r) => r.status !== "sent").map((r) => [r.serviceId, r.service])
    ).values(),
  ].sort((a, b) => a.daysLeft - b.daysLeft)

  const summaryList = services
    .map((s) => {
      const when =
        s.daysLeft < 0
          ? `expired ${-s.daysLeft} days ago`
          : s.daysLeft === 0
            ? "today"
            : `${s.daysLeft} days`
      return `${SUMMARY_DOT[s.colour]} ${s.domain} – ${s.clientName} – ${when} – ${formatMoney(s.chargeAmount, s.currency)}`
    })
    .join("\n")

  const text = renderTemplate(
    DEFAULT_TEMPLATES.admin_whatsapp.body,
    { today: formatDatePK(d.today), count: services.length, summary_list: summaryList },
    { mode: "text" }
  )
  return { ok: true, data: { url: buildWaLink(MOCK_SETTINGS.adminWhatsapp, text) } }
}

export async function sendManualEmailAction(serviceId: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(serviceId).success) return invalid()
  await sleep()
  if (Math.random() < 0.2) return { ok: false, error: SMTP_ERRORS[0] ?? "Email failed" }
  return { ok: true }
}

/* Payments ---------------------------------------------------------- */

const renewSchema = z
  .object({
    serviceId: numericId,
    amount: z
      .string()
      .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 6500 or 6500.50"),
    paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    method: z.enum(["Cash", "Bank transfer", "JazzCash", "Easypaisa", "Other"]),
    reference: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
    extendFrom: z.enum(["renewal", "today"]),
  })
  .strict()

export async function renewServiceAction(
  input: z.input<typeof renewSchema>
): Promise<ActionResult<{ newRenewalDate: string }>> {
  await requireAdmin()
  const parsed = renewSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues)
      fieldErrors[String(issue.path[0])] = issue.message
    return { ok: false, error: "Check the highlighted fields.", fieldErrors }
  }
  await sleep()
  const service = buildMockData(new Date()).services.find(
    (s) => s.id === parsed.data.serviceId
  )
  if (!service) return { ok: false, error: "Service not found." }
  const from = parsed.data.extendFrom === "today" ? todayPK() : service.renewalDate
  return { ok: true, data: { newRenewalDate: addOneYear(from) } }
}

export async function deletePaymentAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  await sleep()
  return { ok: true }
}

/* Clients and services ---------------------------------------------- */

export async function deleteClientAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  await sleep()
  redirect("/clients")
}

export async function toggleCancelServiceAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  await sleep()
  return { ok: true }
}

export async function deleteServiceAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  await sleep()
  return { ok: true }
}

/* Notifications ----------------------------------------------------- */

export async function getLatestNotificationsAction(): Promise<
  ActionResult<{ unread: number; items: NotificationItem[] }>
> {
  await requireAdmin()
  await sleep()
  const items = [...buildMockData(new Date()).notifications]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
  return { ok: true, data: { unread: items.filter((n) => !n.isRead).length, items } }
}

export async function markReadAction(id: string): Promise<ActionResult> {
  await requireAdmin()
  if (!stringId.safeParse(id).success) return invalid()
  return { ok: true }
}

export async function markAllReadAction(): Promise<ActionResult> {
  await requireAdmin()
  await sleep()
  return { ok: true }
}

/* Auth -------------------------------------------------------------- */

export async function logoutAction(): Promise<void> {
  await sleep()
  redirect("/login")
}
