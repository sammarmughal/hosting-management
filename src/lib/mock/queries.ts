// Mock queries (docs/06 §7.2). Same signatures as lib/server/queries.ts will
// have in Phase 4, returning the view-model types.
import { formatDatePK } from "@/lib/domain/dates"
import { formatMoney, sumAmounts, toCents } from "@/lib/domain/money"
import { buildWaLink } from "@/lib/domain/whatsapp"
import type { ServiceFilter, ServiceSort } from "@/lib/service-filters"
import {
  adminSummaryText,
  buildMockData,
  MOCK_SETTINGS,
  type MockData,
} from "@/lib/mock/data"
import type {
  ActivityItem,
  ClientDetail,
  DashboardStats,
  NotificationItem,
  PaymentRow,
  QueueItem,
  ReminderRow,
  ServiceRow,
  ShellSummary,
} from "@/types/view"

/**
 * MOCK_EMPTY=1 (development only) returns no data at all, to design the
 * "no clients yet" empty states.
 */
function data(): MockData {
  const d = buildMockData(new Date())
  if (process.env.NODE_ENV !== "production" && process.env.MOCK_EMPTY === "1") {
    return {
      ...d,
      clients: [],
      services: [],
      reminders: [],
      notifications: [],
      payments: [],
    }
  }
  return d
}

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
  const queue = buildQueue(d.reminders)
  return {
    adminName: MOCK_SETTINGS.adminName,
    remindersDue: queue.length,
    remindersOverdue: queue.some((q) => q.service.daysLeft < 0),
    unreadNotifications: d.notifications.filter((n) => !n.isRead).length,
  }
}

/* Dashboard --------------------------------------------------------- */

export interface DashboardData {
  stats: DashboardStats
  /** Services with at least one client reminder still needing action. */
  queue: QueueItem[]
  /** Active services with ≤ 30 days left or expired, most urgent first (max 10). */
  dueSoon: ServiceRow[]
  lastCheckAt: string
  adminEmail: string
  /** wa.me link to the admin's own number with the summary text (docs/08 §5.2). */
  adminSummaryWaLink: string | null
}

export async function getDashboard(): Promise<DashboardData> {
  const d = data()
  const t = MOCK_SETTINGS.thresholds
  const active = d.services.filter((s) => s.status === "active")
  const in30 = active.filter((s) => s.daysLeft >= 0 && s.daysLeft <= 30)
  const queue = buildQueue(d.reminders)

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
    queue,
    dueSoon: active
      .filter((s) => s.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 10),
    lastCheckAt: d.lastCheckAt,
    adminEmail: MOCK_SETTINGS.adminEmail,
    adminSummaryWaLink: queue.length
      ? buildWaLink(
          MOCK_SETTINGS.adminWhatsapp,
          adminSummaryText(
            queue.map((q) => q.service),
            d.today
          )
        )
      : null,
  }
}

/** Groups client reminder rows by service; keeps services with an open row. Most urgent first. */
function buildQueue(reminders: ReminderRow[]): QueueItem[] {
  const byService = new Map<number, QueueItem>()
  for (const r of reminders) {
    if (r.recipient !== "client") continue
    const item = byService.get(r.serviceId) ?? {
      service: r.service,
      stage: r.stage,
      email: null,
      whatsapp: null,
    }
    item[r.channel] = r
    byService.set(r.serviceId, item)
  }
  return [...byService.values()]
    .filter((q) =>
      [q.email, q.whatsapp].some((r) => r && OPEN_STATUSES.includes(r.status))
    )
    .sort(
      (a, b) => a.service.daysLeft - b.service.daysLeft || a.service.id - b.service.id
    )
}

/** Most urgent first: expired, then by days left. */
function sortQueue(rows: ReminderRow[]) {
  return [...rows].sort(
    (a, b) => a.service.daysLeft - b.service.daysLeft || a.id.localeCompare(b.id)
  )
}

/* Clients / services ------------------------------------------------ */

const FILTERS: Record<Exclude<ServiceFilter, "all">, (s: ServiceRow) => boolean> = {
  active: (s) => s.status === "active",
  due: (s) => s.status === "active" && s.daysLeft <= 30,
  soon: (s) => s.status === "active" && s.daysLeft >= 0 && s.daysLeft <= 30,
  green: (s) => s.colour === "green",
  orange: (s) => s.colour === "orange",
  red: (s) => s.colour === "red",
  expired: (s) => s.colour === "expired",
  cancelled: (s) => s.colour === "cancelled",
}

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
  /** Rows matching the search and filter (before paging). */
  total: number
  /** Every service, ignoring search and filters (0 = no clients yet). */
  totalAll: number
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
  for (const [key, test] of Object.entries(FILTERS)) {
    counts[key as ServiceFilter] = searched.filter(test).length
  }

  const filtered = filter === "all" ? searched : searched.filter(FILTERS[filter])
  const sorted = [...filtered].sort(SORTS[sort])
  const start = (Math.max(1, page) - 1) * PAGE_SIZE

  return {
    rows: sorted.slice(start, start + PAGE_SIZE),
    total: filtered.length,
    totalAll: all.length,
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
  activity: ActivityItem[]
}

export async function getClient(id: number): Promise<ClientPageData | null> {
  const d = data()
  const client = d.clients.find((c) => c.id === id)
  if (!client) return null
  const ids = new Set(client.services.map((s) => s.id))
  const payments = d.payments.filter((p) => ids.has(p.serviceId))
  const reminders = d.reminders
    .filter((r) => ids.has(r.serviceId))
    .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""))
  return {
    client,
    payments,
    reminders,
    activity: buildActivity(client, payments, reminders),
  }
}

// Until the audit log exists (Phase 3), the timeline is derived from the
// services, payments and reminders. Dates without a time sit at 09:00 PK.
function buildActivity(
  client: ClientDetail,
  payments: PaymentRow[],
  reminders: ReminderRow[]
): ActivityItem[] {
  const atDate = (d: string) => `${d}T09:00:00+05:00`
  const items: ActivityItem[] = [
    ...client.services.map((s) => ({
      id: `svc-${s.id}`,
      at: atDate(s.startDate),
      kind: "service" as const,
      text: `Hosting for ${s.domain} started${s.planLabel ? ` on the ${s.planLabel} plan` : ""}`,
    })),
    ...payments.map((p) => ({
      id: `pay-${p.id}`,
      at: atDate(p.paidOn),
      kind: "payment" as const,
      text: `Payment of ${formatMoney(p.amount, p.currency)} by ${p.method} · ${p.domain} renewed until ${formatDatePK(p.periodTo)}`,
    })),
    ...reminders.flatMap((r): ActivityItem[] => {
      if (!r.sentAt) return []
      const channel = r.channel === "email" ? "Email" : "WhatsApp"
      const map: Partial<Record<ReminderRow["status"], [ActivityItem["kind"], string]>> =
        {
          sent: [r.channel, `${channel} reminder sent for ${r.service.domain}`],
          opened: ["whatsapp", `WhatsApp reminder opened for ${r.service.domain}`],
          failed: ["failed", `${channel} reminder for ${r.service.domain} failed`],
          skipped: ["skipped", `${channel} reminder for ${r.service.domain} skipped`],
        }
      const entry = map[r.status]
      return entry
        ? [{ id: `rem-${r.id}`, at: r.sentAt, kind: entry[0], text: entry[1] }]
        : []
    }),
  ]
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

/** Every service, by renewal date (CSV export). */
export async function exportServices(): Promise<ServiceRow[]> {
  return [...data().services].sort(
    (a, b) => a.renewalDate.localeCompare(b.renewalDate) || a.id - b.id
  )
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
