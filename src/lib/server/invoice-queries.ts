import "server-only"

// Invoice reads for pages (re-exported by src/lib/data.ts) and for the PDF
// and public routes. Returns the view models in src/types/view.ts.
import type { Prisma } from "@/generated/prisma/client"
import { formatDatePK } from "@/lib/domain/dates"
import {
  displayStatus,
  type BillToSnapshot,
  type SellerSnapshot,
} from "@/lib/domain/invoices"
import { formatMoney, MONEY_SCALE, totalsByCurrency, type CurrencyTotal } from "@/lib/domain/money"
import type { InvoiceParams } from "@/lib/list-filters"
import { prisma } from "@/lib/server/db"
import { fromDbDate, toDbDate } from "@/lib/server/db-dates"
import { publicInvoiceUrl } from "@/lib/server/invoices"
import { getAppSettings } from "@/lib/server/settings"
import { serviceInclude, toServiceRow, viewContext } from "@/lib/server/view"
import type {
  InvoiceDetail,
  InvoiceDocumentData,
  InvoiceEventItem,
  InvoiceRow,
} from "@/types/view"

export const INVOICE_PAGE_SIZE = 25

const listInclude = {
  client: { select: { name: true, company: true, email: true } },
  service: { select: { domain: true } },
} satisfies Prisma.InvoiceInclude

type ListRecord = Prisma.InvoiceGetPayload<{ include: typeof listInclude }>

function toRow(i: ListRecord, today: string): InvoiceRow {
  const due = fromDbDate(i.dueDate)
  return {
    id: i.id,
    number: i.number,
    clientId: i.clientId,
    clientName: i.client.name,
    company: i.client.company,
    email: i.client.email,
    serviceId: i.serviceId,
    domain: i.service.domain,
    issueDate: fromDbDate(i.issueDate),
    dueDate: due,
    total: i.total.toFixed(MONEY_SCALE),
    currency: i.currency,
    status: displayStatus(i.status, due, today),
    rawStatus: i.status,
    publicUrl: publicInvoiceUrl(i.publicToken),
  }
}

function invoiceWhere(p: Omit<InvoiceParams, "page">, today: string): Prisma.InvoiceWhereInput {
  const ci = p.q ? ({ contains: p.q, mode: "insensitive" } as const) : null
  const open = { in: ["issued", "sent"] as ("issued" | "sent")[] }
  const status: Prisma.InvoiceWhereInput =
    p.status === "unpaid"
      ? { status: open }
      : p.status === "overdue"
        ? { status: open, dueDate: { lt: toDbDate(today) } }
        : p.status === "paid" || p.status === "void"
          ? { status: p.status }
          : {}
  return {
    ...status,
    ...(p.currency ? { currency: p.currency } : {}),
    ...(p.from || p.to
      ? {
          issueDate: {
            ...(p.from ? { gte: toDbDate(p.from) } : {}),
            ...(p.to ? { lte: toDbDate(p.to) } : {}),
          },
        }
      : {}),
    ...(ci
      ? {
          OR: [
            { number: ci },
            { service: { domain: ci } },
            { client: { name: ci } },
            { client: { company: ci } },
            { client: { email: ci } },
          ],
        }
      : {}),
  }
}

export interface InvoiceList {
  rows: InvoiceRow[]
  total: number
  totalAll: number
  page: number
  pageSize: number
  /** Per currency, never added across currencies (docs/13 §6). Void excluded. */
  invoiced: CurrencyTotal[]
  /** Unpaid (issued + sent) per currency. */
  outstanding: CurrencyTotal[]
  /** Currencies that have invoices (for the filter). */
  currencies: string[]
}

export async function listInvoices(p: InvoiceParams): Promise<InvoiceList> {
  const [ctx, s] = await Promise.all([viewContext(), getAppSettings()])
  const where = invoiceWhere(p, ctx.today)
  const [total, totalAll, invoicedSums, openSums, currencies] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.count(),
    prisma.invoice.groupBy({
      by: ["currency"],
      where: { AND: [where, { status: { not: "void" } }] },
      _sum: { total: true },
    }),
    prisma.invoice.groupBy({
      by: ["currency"],
      where: { AND: [where, { status: { in: ["issued", "sent"] } }] },
      _sum: { total: true },
    }),
    prisma.invoice.findMany({ distinct: ["currency"], select: { currency: true } }),
  ])
  const pages = Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE))
  const page = Math.min(Math.max(1, p.page), pages)
  const rows = await prisma.invoice.findMany({
    where,
    include: listInclude,
    orderBy: [{ issueDate: "desc" }, { id: "desc" }],
    skip: (page - 1) * INVOICE_PAGE_SIZE,
    take: INVOICE_PAGE_SIZE,
  })
  const sums = (g: typeof invoicedSums) =>
    totalsByCurrency(
      g.map((x) => ({ currency: x.currency, amount: (x._sum.total ?? 0).toFixed(MONEY_SCALE) })),
      s.defaultCurrency
    )
  return {
    rows: rows.map((r) => toRow(r, ctx.today)),
    total,
    totalAll,
    page,
    pageSize: INVOICE_PAGE_SIZE,
    invoiced: sums(invoicedSums),
    outstanding: sums(openSums),
    currencies: currencies.map((c) => c.currency).sort(),
  }
}

/** The client page's Invoices tab, newest first. */
export async function listClientInvoices(clientId: number): Promise<InvoiceRow[]> {
  const ctx = await viewContext()
  const rows = await prisma.invoice.findMany({
    where: { clientId },
    include: listInclude,
    orderBy: [{ issueDate: "desc" }, { id: "desc" }],
  })
  return rows.map((r) => toRow(r, ctx.today))
}

/* Detail --------------------------------------------------------------- */

const detailInclude = {
  items: { orderBy: { position: "asc" } },
  events: { orderBy: { createdAt: "desc" }, take: 100 },
  service: { include: serviceInclude },
  payment: { select: { paidOn: true, method: true, reference: true } },
} satisfies Prisma.InvoiceInclude

type DetailRecord = Prisma.InvoiceGetPayload<{ include: typeof detailInclude }>

function documentData(i: DetailRecord, today: string): InvoiceDocumentData {
  const due = fromDbDate(i.dueDate)
  return {
    number: i.number,
    status: displayStatus(i.status, due, today),
    issueDate: fromDbDate(i.issueDate),
    dueDate: due,
    periodStart: fromDbDate(i.periodStart),
    periodEnd: fromDbDate(i.periodEnd),
    currency: i.currency,
    subtotal: i.subtotal.toFixed(MONEY_SCALE),
    discount: i.discount.toFixed(MONEY_SCALE),
    taxRate: i.taxRate.toFixed(2),
    taxAmount: i.taxAmount.toFixed(MONEY_SCALE),
    total: i.total.toFixed(MONEY_SCALE),
    items: i.items.map((it) => ({
      id: it.id,
      description: it.description,
      periodLabel: it.periodLabel,
      quantity: it.quantity,
      unitAmount: it.unitAmount.toFixed(MONEY_SCALE),
      amount: it.amount.toFixed(MONEY_SCALE),
    })),
    billTo: i.billTo as unknown as BillToSnapshot,
    seller: i.seller as unknown as SellerSnapshot,
    notes: i.notes,
    paidAt: i.paidAt ? fromDbDate(i.paidAt) : null,
  }
}

const EVENT_TEXT: Record<string, (d: Record<string, unknown>) => string> = {
  created: (d) => (d.source === "manual" ? "Invoice created by hand" : "Invoice created by the daily check"),
  updated: () => "Updated from the service",
  email_sent: (d) => `Emailed to ${String(d.to ?? "the client")}`,
  email_failed: (d) => `Email to ${String(d.to ?? "the client")} failed`,
  whatsapp_opened: (d) => `WhatsApp opened for ${String(d.to ?? "the client")}`,
  whatsapp_marked_sent: () => "WhatsApp marked as sent",
  link_viewed: () => "Invoice link viewed",
  pdf_downloaded: (d) => (d.via === "admin" ? "PDF downloaded by you" : "PDF downloaded from the link"),
  paid: (d) =>
    typeof d.paidOn === "string" ? `Marked as paid (paid on ${formatDatePK(d.paidOn)})` : "Marked as paid",
  voided: () => "Invoice voided",
  link_regenerated: () => "Link regenerated (the old link stopped working)",
  details_refreshed: () => "Business details refreshed from Settings",
}

function toEvent(e: DetailRecord["events"][number]): InvoiceEventItem {
  const d = (e.details ?? {}) as Record<string, unknown>
  return {
    id: e.id.toString(),
    type: e.type,
    at: e.createdAt.toISOString(),
    text: (EVENT_TEXT[e.type] ?? (() => e.type))(d),
    detail:
      typeof d.error === "string"
        ? d.error
        : typeof d.reason === "string"
          ? d.reason
          : typeof d.total === "string" && typeof d.currency === "string"
            ? `New total ${formatMoney(d.total, d.currency)}`
            : null,
  }
}

export async function getInvoice(id: number): Promise<InvoiceDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const [inv, ctx] = await Promise.all([
    prisma.invoice.findUnique({ where: { id }, include: detailInclude }),
    viewContext(),
  ])
  if (!inv) return null
  return {
    ...documentData(inv, ctx.today),
    id: inv.id,
    rawStatus: inv.status,
    publicUrl: publicInvoiceUrl(inv.publicToken),
    service: toServiceRow(inv.service, ctx),
    firstSentAt: inv.firstSentAt?.toISOString() ?? null,
    voidedAt: inv.voidedAt?.toISOString() ?? null,
    voidReason: inv.voidReason,
    events: inv.events.map(toEvent),
  }
}

/** For the public page and PDF: the invoice behind a live token, or null. */
export async function getInvoiceByToken(token: string) {
  const [inv, ctx] = await Promise.all([
    prisma.invoice.findUnique({ where: { publicToken: token }, include: detailInclude }),
    viewContext(),
  ])
  if (!inv) return null
  return { id: inv.id, domain: inv.service.domain, document: documentData(inv, ctx.today) }
}

/** For the authenticated PDF route. */
export async function getInvoiceDocument(id: number) {
  const [inv, ctx] = await Promise.all([
    prisma.invoice.findUnique({ where: { id }, include: detailInclude }),
    viewContext(),
  ])
  if (!inv) return null
  return { id: inv.id, domain: inv.service.domain, document: documentData(inv, ctx.today) }
}

/** Settings → Invoices: the next number is editable only before the first invoice. */
export const countInvoices = () => prisma.invoice.count()
