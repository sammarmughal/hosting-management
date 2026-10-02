// URL filters for the Reminders log and Payments lists (docs/07 §1).
// Untrusted query strings in, valid values out.
import { isISODate, type ISODate } from "@/lib/domain/dates"
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
  channel: ReminderRow["channel"] | ""
  status: ReminderRow["status"] | ""
  page: number
}

export function parseReminderLogParams(sp: SearchParams): ReminderLogParams {
  const channel = first(sp.channel)
  const status = first(sp.status)
  return {
    q: first(sp.q).trim().slice(0, 100),
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

/** True when anything narrows the list (for "Clear filters"). */
export function isFiltered(p: ReminderLogParams | PaymentParams) {
  return Object.entries(p).some(([k, v]) => k !== "page" && v !== "")
}
