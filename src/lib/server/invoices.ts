import "server-only"

import { randomBytes } from "node:crypto"

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
import { currencyDecimals } from "@/lib/domain/currency"
import { formatMoney, MONEY_SCALE } from "@/lib/domain/money"
import { paymentSnapshot } from "@/lib/domain/payment-accounts"
import { audit } from "@/lib/server/audit"
import { today as clockToday } from "@/lib/server/clock"
import { prisma, type Tx } from "@/lib/server/db"
import { fromDbDate, toDbDate } from "@/lib/server/db-dates"
import { getAppSettings, type AppSettings } from "@/lib/server/settings"

// Invoices (docs/13 §2–§5). Every write that touches numbers or a cycle's
// invoice runs inside a transaction.

type Db = Tx | typeof prisma

/* Numbering (docs/13 §3) --------------------------------------------- */

/**
 * Takes the next number for the issue date's year. The upsert takes the
 * year's counter row lock straight away (exclusive), so concurrent
 * transactions queue on it and two invoices can never get the same number;
 * the read after it sees this transaction's own write. If the surrounding
 * transaction rolls back, so does the counter; a committed number is never
 * reused (voided invoices keep theirs).
 */
export async function allocateInvoiceNumber(tx: Tx, issueDate: ISODate, prefix: string) {
  const year = numberYear(issueDate)
  await tx.$executeRaw`
    INSERT INTO invoice_counters (year, \`next\`, updated_at)
    VALUES (${year}, 2, UTC_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE \`next\` = \`next\` + 1, updated_at = UTC_TIMESTAMP(3)`
  const [row] = await tx.$queryRaw<{ seq: bigint | number }[]>`
    SELECT \`next\` - 1 AS seq FROM invoice_counters WHERE year = ${year}`
  if (!row) throw new Error("Could not allocate an invoice number")
  return formatInvoiceNumber(prefix, year, Number(row.seq))
}

/** 64 lowercase hex characters: safe under the case-insensitive collation. */
const publicToken = () => randomBytes(32).toString("hex")

/** A unique-key clash (P2002), e.g. a parallel request created the same cycle's invoice. */
const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002"

/* Snapshots ------------------------------------------------------------ */

/**
 * The business details an invoice keeps. The payment account is the one for
 * the invoice's currency (else the Default), chosen now and never again
 * unless "Refresh business details" runs on an unpaid invoice.
 */
export function sellerSnapshot(s: AppSettings, currency: string): SellerSnapshot {
  return {
    businessName: s.businessName,
    tagline: s.businessTagline,
    address: s.invoices.address,
    phone: s.businessPhone,
    email: s.smtp.fromEmail || s.adminEmail,
    ntn: s.invoices.ntn,
    logo: s.invoices.logo,
    payment: paymentSnapshot(s.invoices.accounts, s.invoices.wallet, currency),
    footer: s.invoices.footer,
  }
}

type Contact = {
  name: string
  email: string | null
  phone: string | null
  address: string | null
}

/**
 * Bill to: the client, plus the subscription's company when it has one
 * (docs/14 §5). Reminders still go to the client only.
 */
export function billToSnapshot(c: Contact, company?: Contact | null): BillToSnapshot {
  return {
    name: c.name,
    company: company
      ? {
          name: company.name,
          email: company.email,
          phone: company.phone,
          address: company.address,
        }
      : null,
    email: c.email,
    phone: c.phone,
    address: c.address,
  }
}

/** What an invoice is built from: the subscription with its client, company and type. */
export const invoiceSourceInclude = {
  client: true,
  company: true,
  serviceType: { select: { name: true } },
} satisfies Prisma.SubscriptionInclude
type SubscriptionForInvoice = Prisma.SubscriptionGetPayload<{
  include: typeof invoiceSourceInclude
}>

/** Items and totals from the subscription as it is now. */
function amountsFrom(
  subscription: SubscriptionForInvoice,
  s: AppSettings,
  periodStart: ISODate,
  periodEnd: ISODate
) {
  const unit = subscription.chargeAmount.toFixed(MONEY_SCALE)
  const totals = invoiceTotals([{ quantity: 1, unitAmount: unit }], {
    taxRate: s.invoices.taxEnabled ? s.invoices.taxRate : "0",
    // Tax rounds to the currency's minor unit (PKR 0, USD 2, KWD 3).
    decimals: currencyDecimals(subscription.currency),
  })
  return {
    currency: subscription.currency,
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxRate: totals.taxRate,
    taxAmount: totals.taxAmount,
    total: totals.total,
    items: [
      {
        position: 0,
        description: itemDescription(
          subscription.serviceType.name,
          subscription.domain,
          subscription.planLabel
        ),
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
 * The invoice for the subscription's current cycle (periodStart = renewal date).
 * Idempotent: returns the existing one if the cycle already has an invoice.
 * Cancelled subscriptions never get one. Must run inside a transaction.
 */
export async function createCycleInvoice(
  tx: Tx,
  subscription: SubscriptionForInvoice,
  settings: AppSettings,
  source: "auto" | "manual",
  today: ISODate = clockToday()
): Promise<CreateResult | null> {
  if (subscription.status !== "active") return null
  const renewal = fromDbDate(subscription.renewalDate)
  const existing = await tx.invoice.findUnique({
    where: {
      uq_invoice_cycle: {
        subscriptionId: subscription.id,
        periodStart: subscription.renewalDate,
      },
    },
    select: { id: true, number: true },
  })
  if (existing) return { ...existing, created: false }

  const { periodStart, periodEnd, dueDate } = cyclePeriod(renewal)
  const { items, ...amounts } = amountsFrom(
    subscription,
    settings,
    periodStart,
    periodEnd
  )
  const number = await allocateInvoiceNumber(tx, today, settings.invoices.prefix)
  const invoice = await tx.invoice.create({
    data: {
      number,
      clientId: subscription.clientId,
      subscriptionId: subscription.id,
      periodStart: toDbDate(periodStart),
      periodEnd: toDbDate(periodEnd),
      issueDate: toDbDate(today),
      dueDate: toDbDate(dueDate),
      ...amounts,
      billTo: billToSnapshot(
        subscription.client,
        subscription.company
      ) as unknown as Prisma.InputJsonValue,
      seller: sellerSnapshot(
        settings,
        amounts.currency
      ) as unknown as Prisma.InputJsonValue,
      publicToken: publicToken(),
      items: { create: items },
    },
  })
  await recordInvoiceEvent(invoice.id, "created", { source }, { db: tx })
  await tx.notification.createMany({
    data: [
      {
        subscriptionId: subscription.id,
        type: "invoice_created",
        title: `Invoice ${number} created for ${subscription.domain}`,
        body: formatMoney(amounts.total, amounts.currency),
        dedupeKey: `invoice:${invoice.id}`,
      },
    ],
    skipDuplicates: true,
  })
  return { id: invoice.id, number, created: true }
}

/**
 * docs/13 §4: every active subscription with daysLeft ≤ leadDays and no invoice
 * for its cycle gets one. Runs inside runCheck's transaction (same lock).
 */
export async function createDueInvoices(tx: Tx, settings: AppSettings, today: ISODate) {
  const horizon = new Date(
    Date.parse(`${today}T00:00:00Z`) + settings.invoices.leadDays * 86_400_000
  )
  const subs = await tx.subscription.findMany({
    where: {
      status: "active",
      renewalDate: { lte: horizon },
      // No invoice yet for the current cycle: compared in JS below, since
      // Prisma can't compare two columns.
    },
    include: { ...invoiceSourceInclude, invoices: { select: { periodStart: true } } },
  })
  let created = 0
  for (const s of subs) {
    if (s.invoices.some((i) => i.periodStart.getTime() === s.renewalDate.getTime()))
      continue
    const res = await createCycleInvoice(tx, s, settings, "auto", today)
    if (res?.created) created++
  }
  return created
}

/** "Create invoice now" on the subscription card: any time, also outside the window. */
export async function createInvoiceNow(
  subscriptionId: number
): Promise<CreateResult | { error: string }> {
  const settings = await getAppSettings()
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: invoiceSourceInclude,
  })
  if (!subscription) return { error: "Subscription not found." }
  if (subscription.status !== "active")
    return { error: "Cancelled subscriptions don’t get invoices." }
  let res: CreateResult | null
  try {
    res = await prisma.$transaction(
      (tx) => createCycleInvoice(tx, subscription, settings, "manual"),
      { isolationLevel: "ReadCommitted" }
    )
  } catch (e) {
    // A parallel request (another tab, or the daily check) created this
    // cycle's invoice first. Our transaction rolled back, number included.
    if (!isUniqueViolation(e)) throw e
    const existing = await prisma.invoice.findUnique({
      where: {
        uq_invoice_cycle: {
          subscriptionId: subscription.id,
          periodStart: subscription.renewalDate,
        },
      },
      select: { id: true, number: true },
    })
    if (!existing) throw e
    res = { ...existing, created: false }
  }
  if (!res) return { error: "Cancelled subscriptions don’t get invoices." }
  if (res.created) await audit("invoice.create", { entity: "invoice", entityId: res.id })
  return res
}

/* Changes (docs/13 §4–§5) ---------------------------------------------- */

/**
 * Regenerates items, amounts and the bill-to (so a company added since shows
 * up, docs/14 §5) from the current subscription. Same number. Open invoices only.
 */
export async function updateFromSubscription(
  invoiceId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await getAppSettings()
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: { include: invoiceSourceInclude } },
    })
    if (!inv) return { ok: false as const, error: "Invoice not found." }
    if (!isOpenInvoice(inv.status))
      return { ok: false as const, error: "Paid and void invoices can’t be changed." }
    const { items, ...amounts } = amountsFrom(
      inv.subscription,
      settings,
      fromDbDate(inv.periodStart),
      fromDbDate(inv.periodEnd)
    )
    // A new currency needs that currency's payment details; the rest of the
    // business snapshot stays as it was (Refresh business details changes it).
    let seller: Prisma.InputJsonValue | undefined
    if (amounts.currency !== inv.currency) {
      const old = inv.seller as unknown as SellerSnapshot
      seller = {
        ...old,
        payment: paymentSnapshot(
          settings.invoices.accounts,
          settings.invoices.wallet,
          amounts.currency
        ),
      } as unknown as Prisma.InputJsonValue
    }
    await tx.invoiceItem.deleteMany({ where: { invoiceId } })
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        ...amounts,
        ...(seller ? { seller } : {}),
        billTo: billToSnapshot(
          inv.subscription.client,
          inv.subscription.company
        ) as unknown as Prisma.InputJsonValue,
        items: { create: items },
      },
    })
    await recordInvoiceEvent(
      invoiceId,
      "updated",
      { total: amounts.total, currency: amounts.currency },
      { db: tx }
    )
    return { ok: true as const }
  })
}

/**
 * Copies the current business details (Settings → Business and Invoices:
 * name, address, NTN, logo, payment account for the invoice's currency,
 * footer) into an unpaid invoice's seller snapshot. Paid and void invoices
 * stay locked.
 */
export async function refreshBusinessDetails(
  invoiceId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await getAppSettings()
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true, currency: true },
    })
    if (!inv) return { ok: false as const, error: "Invoice not found." }
    if (!isOpenInvoice(inv.status))
      return { ok: false as const, error: "Paid and void invoices can’t be changed." }
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        seller: sellerSnapshot(
          settings,
          inv.currency
        ) as unknown as Prisma.InputJsonValue,
      },
    })
    await recordInvoiceEvent(invoiceId, "details_refreshed", undefined, { db: tx })
    return { ok: true as const }
  })
}

/**
 * Inside renewSubscription's transaction (docs/13 §5): the open invoice for the
 * renewed cycle becomes paid and is linked to the payment.
 */
export async function markCycleInvoicePaid(
  tx: Tx,
  subscriptionId: number,
  cycle: Date,
  payment: { id: number; paidOn: ISODate }
) {
  const inv = await tx.invoice.findUnique({
    where: { uq_invoice_cycle: { subscriptionId, periodStart: cycle } },
  })
  if (!inv || !isOpenInvoice(inv.status)) return null
  await tx.invoice.update({
    where: { id: inv.id },
    data: { status: "paid", paidAt: toDbDate(payment.paidOn), paymentId: payment.id },
  })
  await recordInvoiceEvent(
    inv.id,
    "paid",
    { paymentId: payment.id, paidOn: payment.paidOn },
    { db: tx }
  )
  return inv.id
}

export async function voidInvoice(invoiceId: number, reason: string | null) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId } })
    if (!inv) return { ok: false as const, error: "Invoice not found." }
    if (inv.status === "paid")
      return { ok: false as const, error: "Paid invoices can’t be voided." }
    if (inv.status === "void") return { ok: true as const }
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "void", voidedAt: new Date(), voidReason: reason },
    })
    await recordInvoiceEvent(invoiceId, "voided", reason ? { reason } : undefined, {
      db: tx,
    })
    return { ok: true as const }
  })
}

/** docs/13 §8: a new token; the old link stops working at once. */
export async function regeneratePublicLink(invoiceId: number) {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true },
  })
  if (!inv) return null
  const token = publicToken()
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

/** Token format: 32 random bytes, lowercase hex (64 chars). Cheap check before any DB query. */
export const isTokenShaped = (token: string) => /^[0-9a-f]{64}$/.test(token)
