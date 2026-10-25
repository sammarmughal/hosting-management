// URL filters for the Reminders log, Payments, Invoices, Clients and
// Companies lists (docs/07 §1, docs/14 §8). Untrusted query strings in,
// valid values out.
import { isISODate, type ISODate } from "@/lib/domain/dates"
import { idParam } from "@/lib/subscription-filters"
import type { ReminderRow } from "@/types/view"

type SearchParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""
const date = (v: string) => (isISODate(v) ? v : "")
const page = (v: string) => {
  const n = Number.parseInt(v, 10)
  return Number.isInteger(n) && n > 0 ? n : 1
}

export interface DateRange {
  /** Inclusive 'YYYY-MM-DD' bounds, "" = open. */
  from: ISODate | ""
  to: ISODate | ""
}

/** A to-date before the from-date is ignored rather than returning nothing. */
function range(sp: SearchParams): DateRange {
  const from = date(first(sp.from))
  const to = date(first(sp.to))
  return from && to && to < from ? { from, to: "" } : { from, to }
}

export function inRange(d: ISODate, r: DateRange) {
  return (!r.from || d >= r.from) && (!r.to || d <= r.to)
}

/* Reminder log ------------------------------------------------------- */

export const REMINDER_CHANNELS = ["email", "whatsapp"] as const
export const REMINDER_STATUSES: ReminderRow["status"][] = [
  "pending",
  "sent",
  "opened",
  "failed",
  "skipped",
]

export interface ReminderLogParams extends DateRange {
  q: string
  /** Company id, 0 = any. */
  company: number
  channel: ReminderRow["channel"] | ""
  status: ReminderRow["status"] | ""
  page: number
}

export function parseReminderLogParams(sp: SearchParams): ReminderLogParams {
  const channel = first(sp.channel)
  const status = first(sp.status)
  return {
    q: first(sp.q).trim().slice(0, 100),
    company: idParam(sp.company),
    channel: (REMINDER_CHANNELS as readonly string[]).includes(channel)
      ? (channel as ReminderRow["channel"])
      : "",
    status: (REMINDER_STATUSES as string[]).includes(status)
      ? (status as ReminderRow["status"])
      : "",
    ...range(sp),
    page: page(first(sp.page)),
  }
}

/* Payments ----------------------------------------------------------- */

export interface PaymentParams extends DateRange {
  q: string
  page: number
}

export function parsePaymentParams(sp: SearchParams): PaymentParams {
  return { q: first(sp.q).trim().slice(0, 100), ...range(sp), page: page(first(sp.page)) }
}

/* Invoices (docs/13 §11) --------------------------------------------- */

export const INVOICE_FILTERS = ["all", "unpaid", "overdue", "paid", "void"] as const
export type InvoiceFilter = (typeof INVOICE_FILTERS)[number]

export interface InvoiceParams extends DateRange {
  q: string
  /** Company id, 0 = any. */
  company: number
  status: InvoiceFilter
  /** A currency code, or "" for all. */
  currency: string
  page: number
}

export function parseInvoiceParams(sp: SearchParams): InvoiceParams {
  const status = first(sp.status)
  const currency = first(sp.currency).toUpperCase()
  return {
    q: first(sp.q).trim().slice(0, 100),
    company: idParam(sp.company),
    status: (INVOICE_FILTERS as readonly string[]).includes(status)
      ? (status as InvoiceFilter)
      : "all",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "",
    ...range(sp),
    page: page(first(sp.page)),
  }
}

/* Clients and companies (docs/14 §7) -------------------------------- */

export interface ClientListParams {
  q: string
  page: number
}

export function parseClientListParams(sp: SearchParams): ClientListParams {
  return { q: first(sp.q).trim().slice(0, 100), page: page(first(sp.page)) }
}

export interface CompanyListParams {
  q: string
  /** Client id, 0 = any. */
  client: number
  page: number
}

export function parseCompanyListParams(sp: SearchParams): CompanyListParams {
  return {
    q: first(sp.q).trim().slice(0, 100),
    client: idParam(sp.client),
    page: page(first(sp.page)),
  }
}

/** `${path}?…` with empty values (and page 1) left out. */
export function listHref(path: string, params: Record<string, string | number>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === "" || v === 0 || (k === "page" && v === 1)) continue
    qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}

/** True when anything narrows the list (for "Clear filters"). */
export function isFiltered(
  p:
    | ReminderLogParams
    | PaymentParams
    | InvoiceParams
    | ClientListParams
    | CompanyListParams
) {
  return Object.entries(p).some(
    ([k, v]) => k !== "page" && v !== "" && v !== "all" && v !== 0
  )
}
