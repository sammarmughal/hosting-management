// Rendering reminder messages (docs/08). Pure: the caller passes the
// templates, business details and "today" in. Shared by email sending, the
// WhatsApp links built on the server, and the tests.
import { formatDatePK, type ISODate } from "@/lib/domain/dates"
import { formatAmount, formatMoney, totalsByCurrency } from "@/lib/domain/money"
import {
  daysText,
  escapeHtml,
  pickSection,
  renderForDays,
  renderTemplate,
} from "@/lib/domain/templates"
import { formatPhone } from "@/lib/domain/whatsapp"
import type { Colour } from "@/types/view"

export interface MessageService {
  domain: string
  clientName: string
  company?: string | null
  /** Normalised digits. */
  phone?: string | null
  renewalDate: ISODate
  daysLeft: number
  chargeAmount: string
  currency: string
  colour: Colour
}

export interface MessageBusiness {
  businessName: string
  businessPhone: string
  /** Optional line under the name in the email header. */
  businessTagline?: string
}

export interface Template {
  subject?: string | null
  body: string
}

/** The cycle's invoice, for {{invoice_*}} placeholders (docs/13 §10). */
export interface MessageInvoice {
  number: string
  /** https://<app>/i/<token> */
  link: string
  total: string
  currency: string
  dueDate: ISODate
}

/** Names and subjects must never carry header line breaks (docs/05 §6). */
export const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim()

function invoiceVars(inv?: MessageInvoice | null) {
  return {
    invoice_number: inv?.number ?? "",
    invoice_link: inv?.link ?? "",
    invoice_total: inv ? formatMoney(inv.total, inv.currency) : "",
    due_date: inv ? formatDatePK(inv.dueDate) : "",
  }
}

const mentionsLink = (template: string) => /\{\{?invoice_link\}?\}/.test(template)

export function clientVars(
  s: MessageService,
  b: MessageBusiness,
  today: ISODate,
  invoice?: MessageInvoice | null
) {
  return {
    ...invoiceVars(invoice),
    client_name: s.clientName,
    company: s.company ?? "",
    domain: s.domain,
    renewal_date: formatDatePK(s.renewalDate),
    days_left: Math.abs(s.daysLeft),
    days_text: daysText(s.daysLeft),
    amount: formatAmount(s.chargeAmount, s.currency),
    currency: s.currency,
    business_name: b.businessName,
    business_phone: b.businessPhone,
    today: formatDatePK(today),
  }
}

/**
 * Client WhatsApp text for one service (the wa.me message). With an invoice
 * for the cycle, the invoice link is added unless the template places it.
 */
export function clientWhatsappText(
  t: Template,
  s: MessageService,
  b: MessageBusiness,
  today: ISODate,
  invoice?: MessageInvoice | null
) {
  const text = renderForDays(t.body, s.daysLeft, clientVars(s, b, today, invoice), {
    mode: "text",
  })
  return invoice && !mentionsLink(t.body)
    ? `${text}\n\nInvoice ${invoice.number}: ${invoice.link}`
    : text
}

/** Client email: subject, wrapped HTML body and the plain-text alternative. */
export function clientEmail(
  t: Template,
  s: MessageService,
  b: MessageBusiness,
  today: ISODate,
  invoice?: MessageInvoice | null
) {
  const vars = clientVars(s, b, today, invoice)
  const subject = oneLine(
    renderTemplate(pickSection(t.subject ?? "", s.daysLeft), vars, { mode: "text" })
  )
  let body = renderForDays(t.body, s.daysLeft, vars, { mode: "html" })
  if (invoice && !mentionsLink(t.body)) {
    const link = escapeHtml(invoice.link)
    body += `\n<p>Invoice <b>${escapeHtml(invoice.number)}</b> is attached. You can also view it online: <a href="${link}">${link}</a></p>`
  }
  return { subject, html: wrapEmail(body, b), text: htmlToText(body) }
}

/** The "Invoice" template (docs/13 §10), for Share invoice. */
export function invoiceEmail(
  t: Template,
  s: MessageService,
  b: MessageBusiness,
  today: ISODate,
  invoice: MessageInvoice
) {
  const vars = clientVars(s, b, today, invoice)
  const subject = oneLine(renderTemplate(pickSection(t.subject ?? "", s.daysLeft), vars, { mode: "text" }))
  const body = renderForDays(t.body, s.daysLeft, vars, { mode: "html" })
  return { subject, body, html: wrapEmail(body, b), text: htmlToText(body) }
}

export function invoiceWhatsappText(
  t: Template,
  s: MessageService,
  b: MessageBusiness,
  today: ISODate,
  invoice: MessageInvoice
) {
  const text = renderForDays(t.body, s.daysLeft, clientVars(s, b, today, invoice), { mode: "text" })
  return mentionsLink(t.body) ? text : `${text}\n\n${invoice.link}`
}

/* Admin summary (docs/08 §5) ----------------------------------------- */

// Status words, not the emoji in docs/08 §5.2: the UI review (docs/ui-review.md)
// replaced them per docs/12 §6.
const DOT: Record<Colour, string> = {
  red: "Urgent:",
  orange: "Expiring:",
  expired: "Expired:",
  green: "Active:",
  cancelled: "Cancelled:",
}
const COLOUR_HEX: Record<Colour, string> = {
  red: "#b42323",
  orange: "#a35400",
  expired: "#7a1c1c",
  green: "#177a45",
  cancelled: "#6b7280",
}

const mostUrgentFirst = (services: readonly MessageService[]) =>
  [...services].sort((a, b) => a.daysLeft - b.daysLeft)

function whenText(days: number) {
  if (days < 0) return `expired ${-days} ${-days === 1 ? "day" : "days"} ago`
  if (days === 0) return "today"
  return `${days} ${days === 1 ? "day" : "days"}`
}

/** "Urgent: clientb.pk – Client B – 2 days – PKR 6,500", one line per service. */
export function summaryList(services: readonly MessageService[]) {
  return mostUrgentFirst(services)
    .map(
      (s) =>
        `${DOT[s.colour]} ${s.domain} – ${s.clientName} – ${whenText(s.daysLeft)} – ${formatMoney(s.chargeAmount, s.currency)}`
    )
    .join("\n")
}

/** The admin email table, escaped here, with a total row per currency. */
export function summaryTable(services: readonly MessageService[]) {
  const cell = "padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:left"
  const rows = mostUrgentFirst(services)
    .map(
      (s) => `<tr>
<td style="${cell}">${escapeHtml(s.domain)}</td>
<td style="${cell}">${escapeHtml(s.clientName)}</td>
<td style="${cell}">${s.phone ? escapeHtml(formatPhone(s.phone)) : "—"}</td>
<td style="${cell}">${formatDatePK(s.renewalDate)}</td>
<td style="${cell};color:${COLOUR_HEX[s.colour]};font-weight:600">${escapeHtml(whenText(s.daysLeft))}</td>
<td style="${cell};text-align:right">${escapeHtml(formatMoney(s.chargeAmount, s.currency))}</td>
</tr>`
    )
    .join("\n")
  const totals = totalsByCurrency(
    services.map((s) => ({ currency: s.currency, amount: s.chargeAmount }))
  )
    .map(
      (t) => `<tr>
<td colspan="5" style="padding:6px 8px;font-weight:600">Total expected (${escapeHtml(t.currency)})</td>
<td style="padding:6px 8px;text-align:right;font-weight:600">${escapeHtml(formatMoney(t.total, t.currency))}</td>
</tr>`
    )
    .join("\n")
  const head = ["Domain", "Client", "Phone", "Renewal date", "Days left", "Amount"]
    .map(
      (h) =>
        `<th style="padding:6px 8px;border-bottom:1px solid #d1d5db;text-align:left;font-size:12px;color:#6b7280">${h}</th>`
    )
    .join("")
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">
<thead><tr>${head}</tr></thead>
<tbody>
${rows}
${totals}
</tbody>
</table>`
}

function adminVars(services: readonly MessageService[], b: MessageBusiness, today: ISODate) {
  return {
    count: services.length,
    today: formatDatePK(today),
    business_name: b.businessName,
    business_phone: b.businessPhone,
  }
}

export function adminEmail(
  t: Template,
  services: readonly MessageService[],
  b: MessageBusiness,
  today: ISODate
) {
  const vars = { ...adminVars(services, b, today), summary_table: summaryTable(services) }
  const subject = oneLine(renderTemplate(t.subject ?? "", vars, { mode: "text" }))
  const body = renderTemplate(t.body, vars, { mode: "html" })
  const textVars = { ...vars, summary_table: summaryList(services) }
  return {
    subject,
    html: wrapEmail(body, b),
    text: htmlToText(renderTemplate(t.body, textVars, { mode: "html", raw: ["summary_table"] })),
  }
}

export function adminWhatsappText(
  t: Template,
  services: readonly MessageService[],
  b: MessageBusiness,
  today: ISODate
) {
  return renderTemplate(
    t.body,
    { ...adminVars(services, b, today), summary_list: summaryList(services) },
    { mode: "text" }
  )
}

/* Email wrapper and plain text (docs/08 §2) -------------------------- */

/** Geist where the reader has it, else the system UI font (no web fonts in email). */
const WORDMARK_FONT = "Geist,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/**
 * The header wordmark: the business name as text (there is no logo image in
 * emails), 19 px semibold in ink, and the tagline under it in muted text only
 * when one is set.
 */
export function emailWordmark(b: { businessName: string; businessTagline?: string }) {
  const name = escapeHtml(oneLine(b.businessName))
  const tagline = oneLine(b.businessTagline ?? "")
  return `<div style="font-family:${WORDMARK_FONT};font-size:19px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;color:#111827">${name}</div>${
    tagline
      ? `<div style="font-family:${WORDMARK_FONT};margin-top:2px;font-size:13px;line-height:1.4;color:#6b7280">${escapeHtml(tagline)}</div>`
      : ""
  }`
}

/** 600 px card, the business wordmark as header, small grey footer. Inline CSS only. */
export function wrapEmail(
  bodyHtml: string,
  b: { businessName: string; businessTagline?: string }
) {
  const name = escapeHtml(oneLine(b.businessName))
  return `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px">
<tr><td style="padding:16px 24px;border-bottom:1px solid #e5e7eb;word-break:break-word">${emailWordmark(b)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:12px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">This is an automated reminder from ${name}</td></tr>
</table>
</body></html>`
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
}

/** Strips tags for the plain-text alternative, keeping paragraphs and line breaks. */
export function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h\d|table)>/gi, "\n\n")
    .replace(/<\/(div|tr|li)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
