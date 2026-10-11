import "server-only"

import type { InvoiceEventType, Prisma } from "@/generated/prisma/client"
import { type ISODate } from "@/lib/domain/dates"
import {
  cyclePeriod,
  formatInvoiceNumber,
  invoiceTotals,
  isOpenInvoice,
  itemDescription,
  numberYear,
  periodLabel,
  type BillToSnapshot,
  type SellerSnapshot,
} from "@/lib/domain/invoices"
import { formatMoney } from "@/lib/domain/money"
import { audit } from "@/lib/server/audit"
import { today as clockToday } from "@/lib/server/clock"
import { randomToken } from "@/lib/server/crypto"
import { prisma, type Tx } from "@/lib/server/db"
import { fromDbDate, toDbDate } from "@/lib/server/db-dates"
import { getAppSettings, type AppSettings } from "@/lib/server/settings"

// Invoices (docs/13 §2–§5). Every write that touches numbers or a cycle's
// invoice runs inside a transaction.

type Db = Tx | typeof prisma

/* Numbering (docs/13 §3) --------------------------------------------- */

/**
 * Takes the next number for the issue date's year. One atomic upsert on the
 * year's counter row: concurrent transactions queue on the row lock, so two
 * invoices can never get the same number. If the surrounding transaction
 * rolls back, so does the counter; a committed number is never reused
 * (voided invoices keep theirs).
 */
export async function allocateInvoiceNumber(tx: Tx, issueDate: ISODate, prefix: string) {
  const year = numberYear(issueDate)
  const [row] = await tx.$queryRaw<{ seq: number }[]>`
    INSERT INTO invoice_counters (year, next, updated_at)
    VALUES (${year}, 2, now())
    ON CONFLICT (year) DO UPDATE
      SET next = invoice_counters.next + 1, updated_at = now()
    RETURNING next - 1 AS seq`
  if (!row) throw new Error("Could not allocate an invoice number")
  return formatInvoiceNumber(prefix, year, Number(row.seq))
}

/* Snapshots ------------------------------------------------------------ */

export function sellerSnapshot(s: AppSettings): SellerSnapshot {
  return {
    businessName: s.businessName,
    address: s.invoices.address,
    phone: s.businessPhone,
    email: s.smtp.fromEmail || s.adminEmail,
    ntn: s.invoices.ntn,
    logo: s.invoices.logo,
    payment: {
      bankName: s.invoices.bankName,
      accountTitle: s.invoices.accountTitle,
      accountNumber: s.invoices.accountNumber,
      wallet: s.invoices.wallet,
    },
    footer: s.invoices.footer,
  }
}

export function billToSnapshot(c: {
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
}): BillToSnapshot {
  return { name: c.name, company: c.company, email: c.email, phone: c.phone, address: c.address }
}

type ServiceForInvoice = Prisma.ServiceGetPayload<{ include: { client: true } }>

/** Items and totals from the service as it is now. */
function amountsFrom(service: ServiceForInvoice, s: AppSettings, periodStart: ISODate, periodEnd: ISODate) {
  const unit = service.chargeAmount.toFixed(2)
  const totals = invoiceTotals([{ quantity: 1, unitAmount: unit }], {
    taxRate: s.invoices.taxEnabled ? s.invoices.taxRate : "0",
  })
  return {
    currency: service.currency,
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxRate: totals.taxRate,
    taxAmount: totals.taxAmount,
    total: totals.total,
    items: [
      {
        position: 0,
        description: itemDescription(service.domain, service.planLabel),
        periodLabel: periodLabel(periodStart, periodEnd),
        quantity: 1,
        unitAmount: unit,
        amount: totals.lines[0] ?? unit,
      },
    ],
  }
}

/* Events --------------------------------------------------------------- */

export async function recordInvoiceEvent(
  invoiceId: number,
  type: InvoiceEventType,
  details?: Prisma.InputJsonValue,
  opts: { ip?: string | null; db?: Db } = {}
) {
  await (opts.db ?? prisma).invoiceEvent.create({
    data: { invoiceId, type, details, ip: opts.ip ?? null },
  })
}

/* Creation (docs/13 §4) ------------------------------------------------ */

export interface CreateResult {
  id: number
  number: string
  created: boolean
}

/**
 * The invoice for the service's current cycle (periodStart = renewal date).
 * Idempotent: returns the existing one if the cycle already has an invoice.
 * Cancelled services never get one. Must run inside a transaction.
 */
export async function createCycleInvoice(
  tx: Tx,
  service: ServiceForInvoice,
  settings: AppSettings,
  source: "auto" | "manual",
  today: ISODate = clockToday()
): Promise<CreateResult | null> {
  if (service.status !== "active") return null
  const renewal = fromDbDate(service.renewalDate)
  const existing = await tx.invoice.findUnique({
    where: { uq_invoice_cycle: { serviceId: service.id, periodStart: service.renewalDate } },
    select: { id: true, number: true },
  })
  if (existing) return { ...existing, created: false }

  const { periodStart, periodEnd, dueDate } = cyclePeriod(renewal)
  const { items, ...amounts } = amountsFrom(service, settings, periodStart, periodEnd)
  const number = await allocateInvoiceNumber(tx, today, settings.invoices.prefix)
  const invoice = await tx.invoice.create({
    data: {
      number,
      clientId: service.clientId,
      serviceId: service.id,
      periodStart: toDbDate(periodStart),
      periodEnd: toDbDate(periodEnd),
      issueDate: toDbDate(today),
      dueDate: toDbDate(dueDate),
      ...amounts,
      billTo: billToSnapshot(service.client) as unknown as Prisma.InputJsonValue,
      seller: sellerSnapshot(settings) as unknown as Prisma.InputJsonValue,
      publicToken: randomToken(32),
      items: { create: items },
    },
  })
  await recordInvoiceEvent(invoice.id, "created", { source }, { db: tx })
  await tx.notification.createMany({
    data: [
      {
        serviceId: service.id,
        type: "invoice_created",
        title: `Invoice ${number} created for ${service.domain}`,
        body: formatMoney(amounts.total, amounts.currency),
        dedupeKey: `invoice:${invoice.id}`,
      },
    ],
    skipDuplicates: true,
  })
  return { id: invoice.id, number, created: true }
}

/**
 * docs/13 §4: every active service with daysLeft ≤ leadDays and no invoice
 * for its cycle gets one. Runs inside runCheck's transaction (same lock).
 */
export async function createDueInvoices(tx: Tx, settings: AppSettings, today: ISODate) {
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + settings.invoices.leadDays * 86_400_000)
  const services = await tx.service.findMany({
    where: {
      status: "active",
      renewalDate: { lte: horizon },
      // No invoice yet for the current cycle: compared in JS below, since
      // Prisma can't compare two columns.
    },
    include: { client: true, invoices: { select: { periodStart: true } } },
  })
  let created = 0
  for (const s of services) {
    if (s.invoices.some((i) => i.periodStart.getTime() === s.renewalDate.getTime())) continue
    const res = await createCycleInvoice(tx, s, settings, "auto", today)
    if (res?.created) created++
  }
  return created
}

/** "Create invoice now" on the service card: any time, also outside the window. */
export async function createInvoiceNow(serviceId: number): Promise<CreateResult | { error: string }> {
  const settings = await getAppSettings()
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { client: true },
  })
  if (!service) return { error: "Service not found." }
  if (service.status !== "active") return { error: "Cancelled services don’t get invoices." }
  const res = await prisma.$transaction((tx) => createCycleInvoice(tx, service, settings, "manual"))
  if (!res) return { error: "Cancelled services don’t get invoices." }
  if (res.created) await audit("invoice.create", { entity: "invoice", entityId: res.id })
  return res
}

/* Changes (docs/13 §4–§5) ---------------------------------------------- */

/** Regenerates items and amounts from the current service. Same number. Open invoices only. */
export async function updateFromService(invoiceId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await getAppSettings()
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { service: { include: { client: true } } },
    })
    if (!inv) return { ok: false as const, error: "Invoice not found." }
    if (!isOpenInvoice(inv.status))
      return { ok: false as const, error: "Paid and void invoices can’t be changed." }
    const { items, ...amounts } = amountsFrom(
      inv.service,
      settings,
      fromDbDate(inv.periodStart),
      fromDbDate(inv.periodEnd)
    )
    await tx.invoiceItem.deleteMany({ where: { invoiceId } })
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { ...amounts, items: { create: items } },
    })
    await recordInvoiceEvent(invoiceId, "updated", { total: amounts.total, currency: amounts.currency }, { db: tx })
    return { ok: true as const }
  })
}

/**
 * Copies the current business details (Settings → Business and Invoices:
 * name, address, NTN, logo, payment instructions, footer) into an unpaid
 * invoice's seller snapshot. Paid and void invoices stay locked.
 */
export async function refreshBusinessDetails(
  invoiceId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await getAppSettings()
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { status: true } })
    if (!inv) return { ok: false as const, error: "Invoice not found." }
    if (!isOpenInvoice(inv.status))
      return { ok: false as const, error: "Paid and void invoices can’t be changed." }
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { seller: sellerSnapshot(settings) as unknown as Prisma.InputJsonValue },
    })
    await recordInvoiceEvent(invoiceId, "details_refreshed", undefined, { db: tx })
    return { ok: true as const }
  })
}

/**
 * Inside renewService's transaction (docs/13 §5): the open invoice for the
 * renewed cycle becomes paid and is linked to the payment.
 */
export async function markCycleInvoicePaid(
  tx: Tx,
  serviceId: number,
  cycle: Date,
  payment: { id: number; paidOn: ISODate }
) {
  const inv = await tx.invoice.findUnique({
    where: { uq_invoice_cycle: { serviceId, periodStart: cycle } },
  })
  if (!inv || !isOpenInvoice(inv.status)) return null
  await tx.invoice.update({
    where: { id: inv.id },
    data: { status: "paid", paidAt: toDbDate(payment.paidOn), paymentId: payment.id },
  })
  await recordInvoiceEvent(inv.id, "paid", { paymentId: payment.id, paidOn: payment.paidOn }, { db: tx })
  return inv.id
}

export async function voidInvoice(invoiceId: number, reason: string | null) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId } })
    if (!inv) return { ok: false as const, error: "Invoice not found." }
    if (inv.status === "paid") return { ok: false as const, error: "Paid invoices can’t be voided." }
    if (inv.status === "void") return { ok: true as const }
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "void", voidedAt: new Date(), voidReason: reason },
    })
    await recordInvoiceEvent(invoiceId, "voided", reason ? { reason } : undefined, { db: tx })
    return { ok: true as const }
  })
}

/** docs/13 §8: a new token; the old link stops working at once. */
export async function regeneratePublicLink(invoiceId: number) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true } })
  if (!inv) return null
  const token = randomToken(32)
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { publicToken: token, publicTokenRevokedAt: new Date() },
  })
  await recordInvoiceEvent(invoiceId, "link_regenerated")
  return token
}

/** Marks the first share (docs/13 §9). */
export async function markSent(invoiceId: number, db: Db = prisma) {
  await db.invoice.updateMany({
    where: { id: invoiceId, status: "issued" },
    data: { status: "sent" },
  })
  await db.invoice.updateMany({
    where: { id: invoiceId, firstSentAt: null },
    data: { firstSentAt: new Date() },
  })
}

/** https://<app>/i/<token> */
export function publicInvoiceUrl(token: string) {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/i/${token}`
}

/** Token format: 32 random bytes, base64url (43 chars). Cheap check before any DB query. */
export const isTokenShaped = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token)
