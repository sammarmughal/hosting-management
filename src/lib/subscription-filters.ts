// URL state for the Subscriptions list (docs/07 §1, docs/14 §4, §8: q, filter,
// month, company, service, sort, page). Shared by the server page and the
// client toolbar so links, parsing and defaults always agree. Views are
// shareable and survive refresh.
import type { Colour } from "@/types/view"

/**
 * Colour filters plus: "active" (not cancelled), "due" (≤ 30 days or
 * expired, the dashboard's "View all") and "soon" (0–30 days).
 */
export type SubscriptionFilter = "all" | "active" | "due" | "soon" | Colour
export type SubscriptionSort = "days_asc" | "days_desc" | "name" | "renewal" | "charge"

const FILTERS: readonly SubscriptionFilter[] = [
  "all",
  "active",
  "due",
  "soon",
  "green",
  "orange",
  "red",
  "expired",
  "cancelled",
]

export const SORT_OPTIONS: { value: SubscriptionSort; label: string }[] = [
  { value: "days_asc", label: "Soonest first" },
  { value: "days_desc", label: "Latest first" },
  { value: "renewal", label: "Renewal date" },
  { value: "name", label: "Client name" },
  { value: "charge", label: "Highest amount" },
]

/** Chips shown in the toolbar (docs/06 §4.5). */
export const FILTER_CHIPS: { value: SubscriptionFilter; label: string; dot?: Colour }[] =
  [
    { value: "all", label: "All" },
    { value: "green", label: "Active", dot: "green" },
    { value: "orange", label: "Expiring", dot: "orange" },
    { value: "red", label: "Urgent", dot: "red" },
    { value: "expired", label: "Expired", dot: "expired" },
    { value: "cancelled", label: "Cancelled", dot: "cancelled" },
  ]

/** Filters reached from dashboard links; shown as an extra, removable chip. */
export const EXTRA_FILTER_LABEL: Partial<Record<SubscriptionFilter, string>> = {
  active: "Not cancelled",
  due: "Due in 30 days or expired",
  soon: "Due in the next 30 days",
}

export interface SubscriptionsParams {
  q: string
  filter: SubscriptionFilter
  /** 'YYYY-MM' or "" */
  month: string
  /** Company id, 0 = any. */
  company: number
  /** Service type id, 0 = any. */
  service: number
  sort: SubscriptionSort
  page: number
}

export const DEFAULT_PARAMS: SubscriptionsParams = {
  q: "",
  filter: "all",
  month: "",
  company: 0,
  service: 0,
  sort: "days_asc",
  page: 1,
}

type SearchParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

/** A positive integer id from the query string, else 0. */
export function idParam(v: string | string[] | undefined): number {
  const s = first(v)
  const n = /^\d{1,9}$/.test(s) ? Number(s) : 0
  return n > 0 ? n : 0
}

/** Untrusted query string → valid params (anything unknown falls back to the default). */
export function parseSubscriptionsParams(sp: SearchParams): SubscriptionsParams {
  const filter = first(sp.filter)
  const sort = first(sp.sort)
  const month = first(sp.month)
  const page = Number.parseInt(first(sp.page), 10)
  return {
    q: first(sp.q).trim().slice(0, 100),
    filter: FILTERS.includes(filter as SubscriptionFilter)
      ? (filter as SubscriptionFilter)
      : "all",
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : "",
    company: idParam(sp.company),
    service: idParam(sp.service),
    sort: SORT_OPTIONS.some((o) => o.value === sort)
      ? (sort as SubscriptionSort)
      : "days_asc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

/** /subscriptions?… with defaults omitted. Changing anything but the page resets to page 1. */
export function subscriptionsHref(
  current: SubscriptionsParams,
  patch: Partial<SubscriptionsParams>
): string {
  const next = { ...current, page: 1, ...patch }
  const qs = new URLSearchParams()
  if (next.q) qs.set("q", next.q)
  if (next.filter !== "all") qs.set("filter", next.filter)
  if (next.month) qs.set("month", next.month)
  if (next.company) qs.set("company", String(next.company))
  if (next.service) qs.set("service", String(next.service))
  if (next.sort !== "days_asc") qs.set("sort", next.sort)
  if (next.page > 1) qs.set("page", String(next.page))
  const s = qs.toString()
  return s ? `/subscriptions?${s}` : "/subscriptions"
}

export function hasActiveFilters(p: SubscriptionsParams) {
  return (
    p.q !== "" ||
    p.filter !== "all" ||
    p.month !== "" ||
    p.company !== 0 ||
    p.service !== 0
  )
}
