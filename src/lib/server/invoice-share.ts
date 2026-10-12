import "server-only"

import { daysLeft } from "@/lib/domain/dates"
import { invoiceFilename } from "@/lib/domain/invoices"
import { invoiceEmail, invoiceWhatsappText, oneLine, wrapEmail } from "@/lib/domain/messages"
import { MONEY_SCALE } from "@/lib/domain/money"
import { escapeHtml } from "@/lib/domain/templates"
import { normalisePhone } from "@/lib/domain/whatsapp"
import { audit } from "@/lib/server/audit"
import { today as clockToday } from "@/lib/server/clock"
import { prisma } from "@/lib/server/db"
import { fromDbDate } from "@/lib/server/db-dates"
import { renderInvoicePdf } from "@/lib/server/invoice-pdf"
import { getInvoiceDocument } from "@/lib/server/invoice-queries"
import { markSent, publicInvoiceUrl, recordInvoiceEvent } from "@/lib/server/invoices"
import { MailError, sendMail } from "@/lib/server/mail"
import { getAppSettings, getTemplate } from "@/lib/server/settings"
import { serviceInclude, toServiceRow, viewContext } from "@/lib/server/view"
import type { ShareData } from "@/types/view"

// Share invoice (docs/13 §9). Every share is logged in the invoice events and
// the reminder log, and sets the invoice to "sent" the first time.

export type { ShareData }


async function loadInvoice(invoiceId: number) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { service: { include: serviceInclude } },
  })
}

export async function buildShareData(invoiceId: number): Promise<ShareData | null> {
  const inv = await loadInvoice(invoiceId)
  if (!inv) return null
  const [ctx, emailT, waT] = await Promise.all([
    viewContext(),
    getTemplate("invoice_email"),
    getTemplate("invoice_whatsapp"),
  ])
  const service = toServiceRow(inv.service, ctx)
  const message = {
    number: inv.number,
    link: publicInvoiceUrl(inv.publicToken),
    total: inv.total.toFixed(MONEY_SCALE),
    currency: inv.currency,
    dueDate: fromDbDate(inv.dueDate),
  }
  const email = inv.service.client.email
  const phone = normalisePhone(inv.service.client.phone)
  const rendered = invoiceEmail(emailT, service, ctx.business, ctx.today, message)
  const voided = inv.status === "void" ? "This invoice is void" : null
  return {
    invoiceId: inv.id,
    number: inv.number,
    rawStatus: inv.status,
    clientId: inv.clientId,
    clientName: inv.service.client.name,
    email,
    phone,
    emailUnavailable: voided ?? (email ? null : "No email address for this client"),
    whatsappUnavailable:
      voided ??
      (inv.service.client.phone
        ? phone
          ? null
          : "The client's WhatsApp number isn't valid"
        : "No WhatsApp number for this client"),
    emailSubject: rendered.subject,
    emailText: rendered.text,
    whatsappText: invoiceWhatsappText(waT, service, ctx.business, ctx.today, message),
    publicUrl: message.link,
    service,
  }
}

/** Plain text (edited in the dialog) → safe HTML paragraphs with links. */
export function textToHtml(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => {
      const html = escapeHtml(para)
        .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`)
        .replace(/\n/g, "<br>")
      return `<p>${html}</p>`
    })
    .join("\n")
}

/** Logs the share in the reminder log (docs/13 §9): a client row for this cycle. */
async function logReminder(
  inv: { serviceId: number; periodStart: Date },
  channel: "email" | "whatsapp",
  status: "sent" | "opened" | "failed",
  lastError: string | null = null
) {
  // Prefer the cycle's existing row for this channel (the queue's current
  // stage), so a share updates that row instead of adding a second queue item.
  const existing = await prisma.reminder.findFirst({
    where: { serviceId: inv.serviceId, cycleDate: inv.periodStart, channel, recipient: "client" },
    orderBy: { stage: "asc" },
  })
  if (existing) {
    await prisma.reminder.update({
      where: { id: existing.id },
      data: {
        status,
        lastError,
        sentAt: new Date(),
        ...(channel === "email" ? { attempts: { increment: 1 } } : {}),
      },
    })
    return
  }
  const stage = daysLeft(fromDbDate(inv.periodStart), clockToday())
  const key = {
    serviceId: inv.serviceId,
    cycleDate: inv.periodStart,
    stage: Math.max(-32768, Math.min(32767, stage)),
    channel,
    recipient: "client" as const,
  }
  const data = {
    status,
    lastError,
    sentAt: new Date(),
    ...(channel === "email" ? { attempts: { increment: 1 } } : {}),
  }
  await prisma.reminder.upsert({
    where: { uq_reminder: key },
    create: { ...key, status, lastError, sentAt: data.sentAt, attempts: channel === "email" ? 1 : 0 },
    update: data,
  })
}

export type EmailShareResult = { ok: true; to: string } | { ok: false; error: string }

/** Email with the PDF attached and the link in the body (docs/13 §9). */
export async function shareByEmail(
  invoiceId: number,
  edited: { subject: string; text: string }
): Promise<EmailShareResult> {
  const inv = await loadInvoice(invoiceId)
  if (!inv) return { ok: false, error: "Invoice not found." }
  if (inv.status === "void") return { ok: false, error: "This invoice is void." }
  const to = inv.service.client.email
  if (!to) return { ok: false, error: "This client has no email address." }
  const [settings, doc] = await Promise.all([getAppSettings(), getInvoiceDocument(invoiceId)])
  if (!doc) return { ok: false, error: "Invoice not found." }

  // Make sure the link is in the body even if it was edited out.
  const link = publicInvoiceUrl(inv.publicToken)
  const text = edited.text.includes(link) ? edited.text : `${edited.text.trim()}\n\n${link}`
  try {
    const pdf = await renderInvoicePdf(doc.document)
    await sendMail(settings, {
      to,
      subject: oneLine(edited.subject),
      html: wrapEmail(textToHtml(text), settings),
      text,
      attachments: [
        {
          filename: invoiceFilename(inv.number, inv.service.domain),
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    })
  } catch (err) {
    const error = err instanceof MailError ? err.message : "Email failed"
    await recordInvoiceEvent(invoiceId, "email_failed", { to, error })
    await logReminder(inv, "email", "failed", error)
    return { ok: false, error }
  }
  await recordInvoiceEvent(invoiceId, "email_sent", { to })
  await logReminder(inv, "email", "sent")
  await markSent(invoiceId)
  await audit("invoice.share.email", { entity: "invoice", entityId: invoiceId })
  return { ok: true, to }
}

/** The browser already opened wa.me (synchronously in the click). Record it. */
export async function recordWhatsappOpened(invoiceId: number) {
  const inv = await loadInvoice(invoiceId)
  if (!inv) return { ok: false as const, error: "Invoice not found." }
  const to = normalisePhone(inv.service.client.phone)
  await recordInvoiceEvent(invoiceId, "whatsapp_opened", { to })
  await logReminder(inv, "whatsapp", "opened")
  await markSent(invoiceId)
  await audit("invoice.share.whatsapp", { entity: "invoice", entityId: invoiceId })
  return { ok: true as const }
}

export async function recordWhatsappSent(invoiceId: number) {
  const inv = await loadInvoice(invoiceId)
  if (!inv) return { ok: false as const, error: "Invoice not found." }
  await recordInvoiceEvent(invoiceId, "whatsapp_marked_sent")
  await logReminder(inv, "whatsapp", "sent")
  return { ok: true as const }
}
