// Mock queries (docs/06 §7.2). Same signatures as lib/server/queries.ts will
// have in Phase 4, returning the view-model types.
import { sumAmounts, toCents } from "@/lib/domain/money"
import { buildMockData, MOCK_SETTINGS } from "@/lib/mock/data"
import type {
  ClientDetail,
  Colour,
  DashboardStats,
  NotificationItem,
  PaymentRow,
  ReminderRow,
  ServiceRow,
  ShellSummary,
} from "@/types/view"

const data = () => buildMockData(new Date())

const OPEN_STATUSES: ReminderRow["status"][] = ["pending", "failed", "opened"]

function totalsByCurrency(rows: { currency: string; amount: string }[]) {
  const groups = new Map<string, string[]>()
  for (const r of rows)
    groups.set(r.currency, [...(groups.get(r.currency) ?? []), r.amount])
  return [...groups].map(([currency, amounts]) => ({
    currency,
    total: sumAmounts(amounts),
  }))
}

/* Settings and shell ------------------------------------------------ */

export async function getSettings() {
  return MOCK_SETTINGS
}

export async function getShellSummary(): Promise<ShellSummary> {
  const d = data()
  const open = d.reminders.filter((r) => OPEN_STATUSES.includes(r.status))
  return {
    adminName: MOCK_SETTINGS.adminName,
    remindersDue: open.length,
    remindersOverdue: open.some((r) => r.service.daysLeft < 0),
    unreadNotifications: d.notifications.filter((n) => !n.isRead).length,
  }
}

/* Dashboard --------------------------------------------------------- */

export interface DashboardData {
  stats: DashboardStats
  queue: ReminderRow[]
  dueSoon: ServiceRow[]
  lastCheckAt: string
}

export async function getDashboard(): Promise<DashboardData> {
  const d = data()
  const t = MOCK_SETTINGS.thresholds
  const active = d.services.filter((s) => s.status === "active")
  const in30 = active.filter((s) => s.daysLeft >= 0 && s.daysLeft <= 30)

  return {
    stats: {
      active: active.length,
      expiring30: active.filter((s) => s.daysLeft >= 0 && s.daysLeft <= t.orange).length,
      urgent7: active.filter((s) => s.daysLeft >= 0 && s.daysLeft <= t.red).length,
      expired: active.filter((s) => s.daysLeft < 0).length,
      expected30: totalsByCurrency(
        in30.map((s) => ({ currency: s.currency, amount: s.chargeAmount }))
      ),
    },
    queue: sortQueue(d.reminders.filter((r) => OPEN_STATUSES.includes(r.status))),
    dueSoon: active
      .filter((s) => s.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 15),
    lastCheckAt: d.lastCheckAt,
  }
}

/** Most urgent first: expired, then by days left. */
function sortQueue(rows: ReminderRow[]) {
  return [...rows].sort(
    (a, b) => a.service.daysLeft - b.service.daysLeft || a.id.localeCompare(b.id)
  )
}

/* Clients / services ------------------------------------------------ */

export type ServiceFilter = "all" | Colour
export type ServiceSort = "days_asc" | "days_desc" | "name" | "renewal" | "charge"

export interface ServiceFilters {
  q?: string
  filter?: ServiceFilter
  /** 'YYYY-MM' */
  month?: string
  sort?: ServiceSort
  page?: number
}

export const PAGE_SIZE = 25

export interface ServiceList {
  rows: ServiceRow[]
  total: number
  page: number
  pageSize: number
  counts: Record<ServiceFilter, number>
}

export async function listServices(filters: ServiceFilters = {}): Promise<ServiceList> {
  const { q = "", filter = "all", month, sort = "days_asc", page = 1 } = filters
  const all = data().services
  const needle = q.trim().toLowerCase()
  const digits = needle.replace(/\D/g, "")

  const searched = all.filter((s) => {
    if (month && !s.renewalDate.startsWith(month)) return false
    if (!needle) return true
    return (
      [s.clientName, s.company, s.email, s.domain].some((v) =>
        v?.toLowerCase().includes(needle)
      ) ||
      (digits.length >= 3 && !!s.phone?.includes(digits.replace(/^0/, "")))
    )
  })

  const counts = { all: searched.length } as Record<ServiceFilter, number>
  for (const c of ["green", "orange", "red", "expired", "cancelled"] as const) {
    counts[c] = searched.filter((s) => s.colour === c).length
  }

  const filtered =
    filter === "all" ? searched : searched.filter((s) => s.colour === filter)
  const sorted = [...filtered].sort(SORTS[sort])
  const start = (Math.max(1, page) - 1) * PAGE_SIZE

  return {
    rows: sorted.slice(start, start + PAGE_SIZE),
    total: filtered.length,
    page: Math.max(1, page),
    pageSize: PAGE_SIZE,
    counts,
  }
}

const SORTS: Record<ServiceSort, (a: ServiceRow, b: ServiceRow) => number> = {
  // Cancelled services sink to the bottom of the days sorts.
  days_asc: (a, b) => cancelledLast(a, b) || a.daysLeft - b.daysLeft,
  days_desc: (a, b) => cancelledLast(a, b) || b.daysLeft - a.daysLeft,
  name: (a, b) => a.clientName.localeCompare(b.clientName),
  renewal: (a, b) => a.renewalDate.localeCompare(b.renewalDate),
  charge: (a, b) => Math.sign(Number(toCents(b.chargeAmount) - toCents(a.chargeAmount))),
}

function cancelledLast(a: ServiceRow, b: ServiceRow) {
  return Number(a.status === "cancelled") - Number(b.status === "cancelled")
}

export interface ClientPageData {
  client: ClientDetail
  payments: PaymentRow[]
  reminders: ReminderRow[]
}

export async function getClient(id: number): Promise<ClientPageData | null> {
  const d = data()
  const client = d.clients.find((c) => c.id === id)
  if (!client) return null
  const ids = new Set(client.services.map((s) => s.id))
  return {
    client,
    payments: d.payments.filter((p) => ids.has(p.serviceId)),
    reminders: d.reminders.filter((r) => ids.has(r.serviceId)),
  }
}

export async function getService(id: number): Promise<ServiceRow | null> {
  return data().services.find((s) => s.id === id) ?? null
}

/* Reminders, payments, notifications -------------------------------- */

export async function listReminders(): Promise<{
  queue: ReminderRow[]
  log: ReminderRow[]
}> {
  const rows = data().reminders
  return {
    queue: sortQueue(rows.filter((r) => OPEN_STATUSES.includes(r.status))),
    log: [...rows].sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? "")),
  }
}

export async function listPayments(): Promise<{
  rows: PaymentRow[]
  totals: { currency: string; total: string }[]
}> {
  const rows = data().payments
  return { rows, totals: totalsByCurrency(rows) }
}

export async function listNotifications(): Promise<{
  unread: number
  items: NotificationItem[]
}> {
  const items = [...data().notifications].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )
  return { unread: items.filter((n) => !n.isRead).length, items }
}
