// Invoices (docs/13 §2–§5). Pure: numbering format, totals with tax, the
// creation window, the derived overdue status and display labels. Money is
// handled as integer cents (see money.ts), never JS floats.
import { addOneYear, formatDatePK, type ISODate } from "@/lib/domain/dates"
import { fromCents, toCents } from "@/lib/domain/money"

/* Numbering (docs/13 §3) --------------------------------------------- */

export const DEFAULT_INVOICE_PREFIX = "INV"
export const PREFIX_RE = /^[A-Z0-9]{1,10}$/

/** ("INV", 2026, 12) → "INV-2026-0012". Wider when seq passes 9999. */
export function formatInvoiceNumber(prefix: string, year: number, seq: number): string {
  if (!PREFIX_RE.test(prefix)) throw new RangeError(`Invalid invoice prefix: ${prefix}`)
  if (!Number.isInteger(year) || year < 2000 || year > 9999)
    throw new RangeError(`Invalid year: ${year}`)
  if (!Number.isInteger(seq) || seq < 1) throw new RangeError(`Invalid sequence: ${seq}`)
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`
}

/** The year the number belongs to: the issue date's year (PK calendar). */
export const numberYear = (issueDate: ISODate) => Number(issueDate.slice(0, 4))

/* Totals --------------------------------------------------------------- */

export interface InvoiceLine {
  quantity: number
  /** Decimal string, e.g. "6500.00". */
  unitAmount: string
}

export interface InvoiceTotals {
  /** Line amounts, in the same order. */
  lines: string[]
  subtotal: string
  discount: string
  /** Percent as a decimal string, e.g. "17.00". */
  taxRate: string
  taxAmount: string
  total: string
}

/** "17" / "17.5" → 1700 / 1750 (hundredths of a percent). */
function rateBasisPoints(rate: string): bigint {
  const cents = toCents(rate) // same parsing: two decimals, half-up
  if (cents < 0n || cents > 10000n) throw new RangeError(`Invalid tax rate: ${rate}`)
  return cents
}

/** Integer division rounding half away from zero. */
function divRound(n: bigint, d: bigint): bigint {
  const q = n / d
  const r = n % d
  return r * 2n >= d ? q + 1n : q
}

/**
 * Subtotal = Σ qty × unit; tax = (subtotal − discount) × rate, rounded half-up
 * to the cent; total = subtotal − discount + tax. Discount can't exceed the subtotal.
 */
export function invoiceTotals(
  lines: readonly InvoiceLine[],
  { discount = "0", taxRate = "0" }: { discount?: string; taxRate?: string } = {}
): InvoiceTotals {
  const amounts = lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity < 1)
      throw new RangeError(`Invalid quantity: ${l.quantity}`)
    return toCents(l.unitAmount) * BigInt(l.quantity)
  })
  const subtotal = amounts.reduce((a, b) => a + b, 0n)
  const disc = toCents(discount)
  if (disc < 0n || disc > subtotal) throw new RangeError("Discount must be between 0 and the subtotal")
  const bp = rateBasisPoints(taxRate)
  const tax = divRound((subtotal - disc) * bp, 10000n)
  return {
    lines: amounts.map(fromCents),
    subtotal: fromCents(subtotal),
    discount: fromCents(disc),
    taxRate: fromCents(bp),
    taxAmount: fromCents(tax),
    total: fromCents(subtotal - disc + tax),
  }
}

/* Window and lifecycle (docs/13 §4–§5) -------------------------------- */

export const LEAD_DAY_CHOICES = [15, 30] as const
export const DEFAULT_LEAD_DAYS = 30

/** An active service gets its cycle's invoice once daysLeft ≤ leadDays. */
export function invoiceDue(
  s: { status: "active" | "cancelled"; daysLeft: number },
  leadDays: number
): boolean {
  return s.status === "active" && s.daysLeft <= leadDays
}

export type InvoiceStatus = "issued" | "sent" | "paid" | "void"
export type InvoiceDisplayStatus = "unpaid" | "sent" | "overdue" | "paid" | "void"

export const isOpenInvoice = (status: InvoiceStatus) => status === "issued" || status === "sent"

/** Overdue is derived: due date passed and not paid (never stored). */
export function displayStatus(
  status: InvoiceStatus,
  dueDate: ISODate,
  today: ISODate
): InvoiceDisplayStatus {
  if (status === "paid" || status === "void") return status
  if (dueDate < today) return "overdue"
  return status === "sent" ? "sent" : "unpaid"
}

export const INVOICE_STATUS_LABEL: Record<InvoiceDisplayStatus, string> = {
  unpaid: "Unpaid",
  sent: "Sent",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
}

/** periodStart = the renewal date; periodEnd = one billing cycle later (1 year). */
export function cyclePeriod(renewalDate: ISODate) {
  return { periodStart: renewalDate, periodEnd: addOneYear(renewalDate), dueDate: renewalDate }
}

/** "30 Sep 2026 → 30 Sep 2027" */
export const periodLabel = (start: ISODate, end: ISODate) =>
  `${formatDatePK(start)} → ${formatDatePK(end)}`

/**
 * "Hosting renewal — noordental.pk" (+ ", Business plan"). A comma, not a
 * "·", so a wrapped line never ends on a dangling separator.
 */
export function itemDescription(domain: string, planLabel?: string | null) {
  return `Hosting renewal — ${domain}${planLabel ? `, ${planLabel} plan` : ""}`
}

/** Invoice-INV-2026-0012-noordental.pk.pdf (safe for Content-Disposition). */
export function invoiceFilename(number: string, domain: string) {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
  return `Invoice-${safe(number)}-${safe(domain)}.pdf`
}

/* Snapshots (docs/13 §2) ---------------------------------------------- */

export interface SellerSnapshot {
  businessName: string
  address: string
  phone: string
  email: string
  ntn: string
  /** data:image/png;base64,… or "" */
  logo: string
  payment: {
    bankName: string
    accountTitle: string
    accountNumber: string
    wallet: string
  }
  footer: string
}

export interface BillToSnapshot {
  name: string
  company: string | null
  email: string | null
  /** Normalised digits. */
  phone: string | null
  address: string | null
}

/** True when the snapshot has any payment instructions worth printing. */
export const hasPaymentInstructions = (s: SellerSnapshot) =>
  Object.values(s.payment).some((v) => v.trim() !== "")
