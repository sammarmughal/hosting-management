"use server"

// docs/13 §4–§5, §8. Mark as paid goes through renewSubscriptionAction (the
// existing Renew dialog), which marks the cycle's invoice paid.
import { z } from "zod"

import { invalid, numericId, refreshApp } from "@/lib/server/action-utils"
import { audit } from "@/lib/server/audit"
import {
  createInvoiceNow,
  publicInvoiceUrl,
  refreshBusinessDetails,
  regeneratePublicLink,
  updateFromSubscription,
  voidInvoice,
} from "@/lib/server/invoices"
import {
  buildShareData,
  recordWhatsappOpened,
  recordWhatsappSent,
  shareByEmail,
  type ShareData,
} from "@/lib/server/invoice-share"
import { requireAdmin } from "@/lib/server/session"
import type { ActionResult } from "@/types/actions"

export async function createInvoiceNowAction(
  subscriptionId: number
): Promise<ActionResult<{ id: number; number: string; created: boolean }>> {
  await requireAdmin()
  if (!numericId.safeParse(subscriptionId).success) return invalid()
  const res = await createInvoiceNow(subscriptionId)
  if ("error" in res) return { ok: false, error: res.error }
  refreshApp()
  return { ok: true, data: res }
}

export async function updateFromSubscriptionAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const res = await updateFromSubscription(id)
  if (!res.ok) return res
  await audit("invoice.update", { entity: "invoice", entityId: id })
  refreshApp()
  return { ok: true }
}

/** Unpaid invoices only: copies the current business details into the invoice. */
export async function refreshBusinessDetailsAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const res = await refreshBusinessDetails(id)
  if (!res.ok) return res
  await audit("invoice.refresh_business_details", { entity: "invoice", entityId: id })
  refreshApp()
  return { ok: true }
}

const reasonSchema = z.string().trim().max(300, "Keep it under 300 characters")

export async function voidInvoiceAction(
  id: number,
  reason: string
): Promise<ActionResult> {
  await requireAdmin()
  const r = reasonSchema.safeParse(reason ?? "")
  if (!numericId.safeParse(id).success || !r.success)
    return r.success
      ? invalid()
      : { ok: false, error: r.error.issues[0]?.message ?? "Invalid reason" }
  const res = await voidInvoice(id, r.data || null)
  if (!res.ok) return res
  await audit("invoice.void", { entity: "invoice", entityId: id })
  refreshApp()
  return { ok: true }
}

/* Share invoice (docs/13 §9) ----------------------------------------- */

/** Everything the Share / Mark as paid dialogs need, loaded when one opens. */
export async function getInvoiceShareDataAction(
  id: number
): Promise<ActionResult<ShareData>> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const data = await buildShareData(id)
  return data ? { ok: true, data } : { ok: false, error: "Invoice not found." }
}

const emailInput = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Enter a subject")
    .max(190, "Keep the subject under 190 characters"),
  text: z
    .string()
    .trim()
    .min(1, "Enter a message")
    .max(10_000, "Keep the message under 10,000 characters"),
})

export async function shareInvoiceEmailAction(
  id: number,
  edited: { subject: string; text: string }
): Promise<ActionResult<{ to: string }>> {
  await requireAdmin()
  const p = emailInput.safeParse(edited)
  if (!numericId.safeParse(id).success) return invalid()
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Check the message." }
  const res = await shareByEmail(id, p.data)
  refreshApp()
  return res.ok ? { ok: true, data: { to: res.to } } : res
}

/** WhatsApp was opened in the click handler; this records it. */
export async function invoiceWhatsappOpenedAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const res = await recordWhatsappOpened(id)
  refreshApp()
  return res
}

export async function invoiceWhatsappSentAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const res = await recordWhatsappSent(id)
  refreshApp()
  return res
}

/** "Both": WhatsApp already opened by the click; record it and send the email. */
export async function shareInvoiceBothAction(
  id: number,
  edited: { subject: string; text: string }
): Promise<
  ActionResult<{ email: { ok: true; to: string } | { ok: false; error: string } }>
> {
  await requireAdmin()
  const p = emailInput.safeParse(edited)
  if (!numericId.safeParse(id).success) return invalid()
  if (!p.success)
    return { ok: false, error: p.error.issues[0]?.message ?? "Check the message." }
  const opened = await recordWhatsappOpened(id)
  if (!opened.ok) return opened
  const email = await shareByEmail(id, p.data)
  refreshApp()
  return { ok: true, data: { email } }
}

export async function regenerateLinkAction(
  id: number
): Promise<ActionResult<{ url: string }>> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const token = await regeneratePublicLink(id)
  if (!token) return { ok: false, error: "Invoice not found." }
  await audit("invoice.link_regenerated", { entity: "invoice", entityId: id })
  refreshApp()
  return { ok: true, data: { url: publicInvoiceUrl(token) } }
}
