"use server"

// Phase 1 fake Server Actions (docs/06 §7.2, signatures from docs/07 §2).
// They wait 400–700 ms, validate input like the real ones will, and write
// to the in-memory mock store. About 1 in 5 emails fails so the error
// states can be designed.
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { todayPK } from "@/lib/domain/dates"
import {
  clientSchema,
  fieldErrorsFrom,
  newClientSchema,
  renewSchema,
  serviceSchema,
  type ClientInput,
  type NewClientInput,
  type RenewInput,
  type ServiceInput,
} from "@/lib/domain/validation"
import { buildWaLink } from "@/lib/domain/whatsapp"
import { requireAdmin } from "@/lib/mock/auth"
import { adminSummaryText, buildMockData, MOCK_SETTINGS } from "@/lib/mock/data"
import * as store from "@/lib/mock/mutations"
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

function checkFields(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: "Check the highlighted fields.",
    fieldErrors: fieldErrorsFrom(error),
  }
}

/** Refresh every page that shows services (the real actions list paths). */
function refresh() {
  revalidatePath("/", "layout")
}

/* Reminders --------------------------------------------------------- */

export interface CheckResult {
  servicesChecked: number
  queuedNew: number
  skipped: number
  notificationsNew: number
  emailsSent: number
  emailsFailed: number
  lastCheckAt: string
}

export async function checkNowAction(): Promise<ActionResult<CheckResult>> {
  await requireAdmin()
  await sleep()
  const services = buildMockData(new Date()).services
  return {
    ok: true,
    data: {
      servicesChecked: services.filter((s) => s.status === "active" && s.remindersEnabled)
        .length,
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
  const now = new Date().toISOString()
  if (Math.random() < 0.2) {
    const error =
      SMTP_ERRORS[Math.floor(Math.random() * SMTP_ERRORS.length)] ?? "Email failed"
    store.setReminder(id, "failed", { sentAt: now, lastError: error })
    return { ok: false, error }
  }
  store.setReminder(id, "sent", { sentAt: now, lastError: null })
  return { ok: true, data: { status: "sent", sentAt: now } }
}

export async function markOpenedAction(id: string): Promise<ActionResult> {
  await requireAdmin()
  if (!stringId.safeParse(id).success) return invalid()
  await sleep()
  store.setReminder(id, "opened", { sentAt: new Date().toISOString() })
  return { ok: true }
}

export async function markSentAction(id: string): Promise<ActionResult> {
  await requireAdmin()
  if (!stringId.safeParse(id).success) return invalid()
  await sleep()
  store.setReminder(id, "sent", { sentAt: new Date().toISOString() })
  return { ok: true }
}

export async function skipReminderAction(id: string): Promise<ActionResult> {
  await requireAdmin()
  if (!stringId.safeParse(id).success) return invalid()
  await sleep()
  store.setReminder(id, "skipped", { sentAt: new Date().toISOString() })
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

/**
 * Returns the admin summary link and marks the admin WhatsApp rows opened.
 * The dashboard already renders the link as an <a href> (opening a URL
 * after an await would be blocked as a popup), and calls this on click.
 */
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
  ]
  const text = adminSummaryText(services, d.today)
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

export async function renewServiceAction(
  input: RenewInput
): Promise<ActionResult<{ newRenewalDate: string }>> {
  await requireAdmin()
  const parsed = renewSchema(todayPK()).safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  await sleep()
  const newRenewalDate = store.renewService(parsed.data)
  if (!newRenewalDate) return { ok: false, error: "Service not found." }
  refresh()
  return { ok: true, data: { newRenewalDate } }
}

export async function deletePaymentAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  await sleep()
  return { ok: true }
}

/* Clients and services ---------------------------------------------- */

export async function createClientWithServiceAction(
  input: NewClientInput
): Promise<ActionResult> {
  await requireAdmin()
  const parsed = newClientSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  await sleep()
  if (store.domainTaken(parsed.data.service.domain)) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { "service.domain": "This domain already belongs to a client" },
    }
  }
  const id = store.createClientWithService(parsed.data.client, parsed.data.service)
  refresh()
  redirect(`/clients/${id}?saved=client`)
}

export async function updateClientAction(
  id: number,
  input: ClientInput
): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const parsed = clientSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  await sleep()
  if (!store.updateClient(id, parsed.data))
    return { ok: false, error: "Client not found." }
  refresh()
  redirect(`/clients/${id}?saved=client`)
}

export async function deleteClientAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  await sleep()
  if (!store.deleteClient(id)) return { ok: false, error: "Client not found." }
  refresh()
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
  await sleep()
  if (store.domainTaken(parsed.data.domain)) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { domain: "This domain already belongs to a client" },
    }
  }
  if (store.createService(clientId, parsed.data) === null) {
    return { ok: false, error: "Client not found." }
  }
  refresh()
  redirect(`/clients/${clientId}?saved=service`)
}

export async function updateServiceAction(
  id: number,
  input: ServiceInput
): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const parsed = serviceSchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  await sleep()
  if (store.domainTaken(parsed.data.domain, id)) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: { domain: "This domain already belongs to a client" },
    }
  }
  const clientId = store.updateService(id, parsed.data)
  if (clientId === null) return { ok: false, error: "Service not found." }
  refresh()
  redirect(`/clients/${clientId}?saved=service`)
}

export async function toggleCancelServiceAction(
  id: number
): Promise<ActionResult<{ status: "active" | "cancelled" }>> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  await sleep()
  const status = store.toggleCancelService(id)
  if (!status) return { ok: false, error: "Service not found." }
  refresh()
  return { ok: true, data: { status } }
}

export async function deleteServiceAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  await sleep()
  if (store.deleteService(id) === null) return { ok: false, error: "Service not found." }
  refresh()
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
