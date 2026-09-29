// URL state for the Clients list (docs/07 §1: q, filter, month, sort, page).
// Shared by the server page and the client toolbar so links, parsing and
// defaults always agree. Views are shareable and survive refresh.
import type { Colour } from "@/types/view"

/**
 * Colour filters plus: "active" (not cancelled), "due" (≤ 30 days or
 * expired, the dashboard's "View all") and "soon" (0–30 days).
 */
export type ServiceFilter = "all" | "active" | "due" | "soon" | Colour
export type ServiceSort = "days_asc" | "days_desc" | "name" | "renewal" | "charge"

const FILTERS: readonly ServiceFilter[] = [
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

export const SORT_OPTIONS: { value: ServiceSort; label: string }[] = [
  { value: "days_asc", label: "Soonest first" },
  { value: "days_desc", label: "Latest first" },
  { value: "renewal", label: "Renewal date" },
  { value: "name", label: "Client name" },
  { value: "charge", label: "Highest amount" },
]

/** Chips shown in the toolbar (docs/06 §4.5). */
export const FILTER_CHIPS: { value: ServiceFilter; label: string; dot?: Colour }[] = [
  { value: "all", label: "All" },
  { value: "green", label: "Active", dot: "green" },
  { value: "orange", label: "Expiring", dot: "orange" },
  { value: "red", label: "Urgent", dot: "red" },
  { value: "expired", label: "Expired", dot: "expired" },
  { value: "cancelled", label: "Cancelled", dot: "cancelled" },
]

/** Filters reached from dashboard links; shown as an extra, removable chip. */
export const EXTRA_FILTER_LABEL: Partial<Record<ServiceFilter, string>> = {
  active: "Not cancelled",
  due: "Due in 30 days or expired",
  soon: "Due in the next 30 days",
}

export interface ClientsParams {
  q: string
  filter: ServiceFilter
  /** 'YYYY-MM' or "" */
  month: string
  sort: ServiceSort
  page: number
}

export const DEFAULT_PARAMS: ClientsParams = {
  q: "",
  filter: "all",
  month: "",
  sort: "days_asc",
  page: 1,
}

type SearchParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

/** Untrusted query string → valid params (anything unknown falls back to the default). */
export function parseClientsParams(sp: SearchParams): ClientsParams {
  const filter = first(sp.filter)
  const sort = first(sp.sort)
  const month = first(sp.month)
  const page = Number.parseInt(first(sp.page), 10)
  return {
    q: first(sp.q).trim().slice(0, 100),
    filter: FILTERS.includes(filter as ServiceFilter) ? (filter as ServiceFilter) : "all",
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : "",
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? (sort as ServiceSort) : "days_asc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

/** /clients?… with defaults omitted. Changing anything but the page resets to page 1. */
export function clientsHref(
  current: ClientsParams,
  patch: Partial<ClientsParams>
): string {
  const next = { ...current, page: 1, ...patch }
  const qs = new URLSearchParams()
  if (next.q) qs.set("q", next.q)
  if (next.filter !== "all") qs.set("filter", next.filter)
  if (next.month) qs.set("month", next.month)
  if (next.sort !== "days_asc") qs.set("sort", next.sort)
  if (next.page > 1) qs.set("page", String(next.page))
  const s = qs.toString()
  return s ? `/clients?${s}` : "/clients"
}

export function hasActiveFilters(p: ClientsParams) {
  return p.q !== "" || p.filter !== "all" || p.month !== ""
}
