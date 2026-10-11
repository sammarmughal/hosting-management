import "server-only"

// Pages read data only through src/lib/data.ts (docs/06 §7.2), which
// re-exports this file. Same exports and signatures as the Phase 1 mock
// queries, implemented with Prisma and returning the view-model types.
import type { Prisma, ReminderChannel } from "@/generated/prisma/client"
import { addDays, formatDatePK, todayPK } from "@/lib/domain/dates"
import { adminWhatsappText } from "@/lib/domain/messages"
import {
  formatMoney,
  MONEY_SCALE,
  toUnits,
  totalsByCurrency,
  type CurrencyTotal,
} from "@/lib/domain/money"
import { PAYMENT_METHOD_KEYS, paymentMethodLabel } from "@/lib/domain/validation"
import { linkProvider } from "@/lib/domain/whatsapp"
import type { DateRange, PaymentParams, ReminderLogParams } from "@/lib/list-filters"
import type { ServiceFilter, ServiceSort } from "@/lib/service-filters"
import { prisma } from "@/lib/server/db"
import { fromDbDate, toDbDate } from "@/lib/server/db-dates"
import { getAppSettings, getPreferences as loadPreferences, getTemplate } from "@/lib/server/settings"
import { currentSession } from "@/lib/server/session"
import {
  serviceInclude,
  toReminderRow,
  toServiceRow,
  viewContext,
  type ViewContext,
} from "@/lib/server/view"
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

const OPEN: ReminderRow["status"][] = ["pending", "failed", "opened"]

/* Settings and shell ------------------------------------------------ */

export async function getSettings() {
  const s = await getAppSettings()
  return {
    adminName: s.adminName,
    businessName: s.businessName,
    businessPhone: s.businessPhone,
    adminEmail: s.adminEmail,
    adminWhatsapp: s.adminWhatsapp,
    defaultCurrency: s.defaultCurrency,
    enabledCurrencies: s.enabledCurrencies,
    thresholds: s.thresholds,
    stages: s.stages,
    checkIntervalMinutes: s.checkIntervalMinutes,
    lastCheckAt: s.lastCheckAt,
  }
}

export const getPreferences = loadPreferences

/** The last 20 sign-ins (docs/05 §11), from the audit log. */
export async function getRecentLogins() {
  const [rows, session] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: "login.success" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    currentSession(),
  ])
  return rows.map((r) => {
    const d = (r.details ?? {}) as { device?: string; session?: string }
    return {
      at: r.createdAt.toISOString(),
      device: d.device ?? "Unknown device",
      address: r.ip ?? "—",
      current: !!session && d.session === session.id.slice(0, 16),
    }
  })
}

export async function getShellSummary(): Promise<ShellSummary> {
  const [s, queue, unread] = await Promise.all([
    getAppSettings(),
    loadQueue(await viewContext()),
    prisma.notification.count({ where: { isRead: false } }),
  ])
  return {
    adminName: s.adminName,
    remindersDue: queue.length,
    remindersOverdue: queue.some((q) => q.service.daysLeft < 0),
    unreadNotifications: unread,
  }
}

/* Reminder queue ---------------------------------------------------- */

export interface ReminderQueueData {
  /** Services with at least one client reminder still needing action. */
  queue: QueueItem[]
  adminEmail: string
  /** wa.me link to the admin's own number with the summary text (docs/08 §5.2). */
  adminSummaryWaLink: string | null
}

/**
 * One item per service with an open client row: its email and WhatsApp rows
 * for that stage (including a sibling that's already sent). Most urgent first.
 */
async function loadQueue(ctx: ViewContext): Promise<QueueItem[]> {
  const open = await prisma.reminder.findMany({
    where: { recipient: "client", status: { in: OPEN } },
    select: { serviceId: true, cycleDate: true, stage: true },
  })
  if (open.length === 0) return []
  const keys = new Map(
    open.map((r) => [`${r.serviceId}:${fromDbDate(r.cycleDate)}:${r.stage}`, r])
  )
  const rows = await prisma.reminder.findMany({
    where: {
      recipient: "client",
      OR: [...keys.values()].map((k) => ({
        serviceId: k.serviceId,
        cycleDate: k.cycleDate,
        stage: k.stage,
      })),
    },
    include: { service: { include: serviceInclude } },
    orderBy: { id: "asc" },
  })
  const items = new Map<string, QueueItem>()
  for (const r of rows) {
    const key = `${r.serviceId}:${fromDbDate(r.cycleDate)}:${r.stage}`
    let item = items.get(key)
    if (!item) {
      item = { service: toServiceRow(r.service, ctx), stage: r.stage, email: null, whatsapp: null }
      items.set(key, item)
    }
    item[r.channel] = toReminderRow(r, item.service)
  }
  return [...items.values()]
    .filter((q) => [q.email, q.whatsapp].some((r) => r && OPEN.includes(r.status)))
    .sort((a, b) => a.service.daysLeft - b.service.daysLeft || a.service.id - b.service.id)
}

async function adminSummaryLink(queue: QueueItem[], ctx: ViewContext) {
  const s = await getAppSettings()
  if (!queue.length || !s.adminWhatsapp) return null
  const text = adminWhatsappText(
    await getTemplate("admin_whatsapp"),
    queue.map((q) => q.service),
    ctx.business,
    ctx.today
  )
  return linkProvider.prepare({ to: s.adminWhatsapp, text })?.url ?? null
}

export async function getReminderQueue(): Promise<ReminderQueueData> {
  const ctx = await viewContext()
  const [queue, s] = await Promise.all([loadQueue(ctx), getAppSettings()])
  return {
    queue,
    adminEmail: s.adminEmail,
    adminSummaryWaLink: await adminSummaryLink(queue, ctx),
  }
}

/* Dashboard --------------------------------------------------------- */

export interface DashboardData extends ReminderQueueData {
  stats: DashboardStats
  /** Active services with ≤ 30 days left or expired, most urgent first (max 10). */
  dueSoon: ServiceRow[]
  lastCheckAt: string
}

export async function getDashboard(): Promise<DashboardData> {
  const ctx = await viewContext()
  const s = await getAppSettings()
  const t = ctx.thresholds
  const in30 = { gte: toDbDate(ctx.today), lte: toDbDate(addDays(ctx.today, 30)) }
  const active = { status: "active" } as const
  const [count, expiring, urgent, expired, expected, dueSoon, queue] = await Promise.all([
    prisma.service.count({ where: active }),
    prisma.service.count({
      where: {
        ...active,
        renewalDate: { gte: in30.gte, lte: toDbDate(addDays(ctx.today, t.orange)) },
      },
    }),
    prisma.service.count({
      where: {
        ...active,
        renewalDate: { gte: in30.gte, lte: toDbDate(addDays(ctx.today, t.red)) },
      },
    }),
    prisma.service.count({ where: { ...active, renewalDate: { lt: in30.gte } } }),
    prisma.service.groupBy({
      by: ["currency"],
      where: { ...active, renewalDate: in30 },
      _sum: { chargeAmount: true },
    }),
    prisma.service.findMany({
      where: { ...active, renewalDate: { lte: in30.lte } },
      include: serviceInclude,
      orderBy: [{ renewalDate: "asc" }, { id: "asc" }],
      take: 10,
    }),
    loadQueue(ctx),
  ])
  return {
    queue,
    adminEmail: s.adminEmail,
    adminSummaryWaLink: await adminSummaryLink(queue, ctx),
    stats: {
      active: count,
      expiring30: expiring,
      urgent7: urgent,
      expired,
      expected30: totalsByCurrency(
        expected.map((e) => ({
          currency: e.currency,
          amount: (e._sum.chargeAmount ?? 0).toFixed(MONEY_SCALE),
        })),
        s.defaultCurrency
      ),
    },
    dueSoon: dueSoon.map((x) => toServiceRow(x, ctx)),
    lastCheckAt: s.lastCheckAt ?? new Date(0).toISOString(),
  }
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

/** Search across client and service fields (docs/03 §5). Phone matches digits. */
function serviceSearch(q: string): Prisma.ServiceWhereInput {
  const needle = q.trim()
  if (!needle) return {}
  const digits = needle.replace(/\D/g, "").replace(/^0/, "")
  const ci = { contains: needle, mode: "insensitive" } as const
  return {
    OR: [
      { domain: ci },
      { client: { name: ci } },
      { client: { company: ci } },
      { client: { email: ci } },
      ...(digits.length >= 3 ? [{ client: { phone: { contains: digits } } }] : []),
    ],
  }
}

function monthRange(month?: string): Prisma.ServiceWhereInput {
  if (!month) return {}
  const start = `${month}-01`
  const [y = 0, m = 1] = month.split("-").map(Number)
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`
  return { renewalDate: { gte: toDbDate(start), lt: toDbDate(next) } }
}

const SORTS: Record<ServiceSort, (a: ServiceRow, b: ServiceRow) => number> = {
  days_asc: (a, b) => cancelledLast(a, b) || a.daysLeft - b.daysLeft || a.id - b.id,
  days_desc: (a, b) => cancelledLast(a, b) || b.daysLeft - a.daysLeft || a.id - b.id,
  name: (a, b) => a.clientName.localeCompare(b.clientName) || a.id - b.id,
  renewal: (a, b) => a.renewalDate.localeCompare(b.renewalDate) || a.id - b.id,
  charge: (a, b) =>
    Math.sign(Number(toUnits(b.chargeAmount) - toUnits(a.chargeAmount))) || a.id - b.id,
}

function cancelledLast(a: ServiceRow, b: ServiceRow) {
  return Number(a.status === "cancelled") - Number(b.status === "cancelled")
}

export async function listServices(filters: ServiceFilters = {}): Promise<ServiceList> {
  const { q = "", filter = "all", month, sort = "days_asc", page = 1 } = filters
  const ctx = await viewContext()
  const [found, totalAll] = await Promise.all([
    prisma.service.findMany({
      where: { AND: [serviceSearch(q), monthRange(month)] },
      include: serviceInclude,
    }),
    prisma.service.count(),
  ])
  // Colours depend on today and the thresholds, so the chip counts, filter
  // and sort run here; the search and month filter ran in the database.
  const searched = found.map((s) => toServiceRow(s, ctx))
  const counts = { all: searched.length } as Record<ServiceFilter, number>
  for (const [key, test] of Object.entries(FILTERS))
    counts[key as ServiceFilter] = searched.filter(test).length

  const filtered = filter === "all" ? searched : searched.filter(FILTERS[filter])
  const sorted = filtered.sort(SORTS[sort])
  const p = Math.max(1, page)
  const start = (p - 1) * PAGE_SIZE
  return {
    rows: sorted.slice(start, start + PAGE_SIZE),
    total: filtered.length,
    totalAll,
    page: p,
    pageSize: PAGE_SIZE,
    counts,
  }
}

export interface ClientPageData {
  client: ClientDetail
  payments: PaymentRow[]
  reminders: ReminderRow[]
  activity: ActivityItem[]
}

const paymentInclude = { service: { include: { client: true } } } as const

type PaymentRecord = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>

function toPaymentRow(p: PaymentRecord): PaymentRow {
  return {
    id: p.id,
    serviceId: p.serviceId,
    domain: p.service.domain,
    clientName: p.service.client.name,
    amount: p.amount.toFixed(MONEY_SCALE),
    currency: p.currency,
    paidOn: fromDbDate(p.paidOn),
    method: paymentMethodLabel(p.method),
    reference: p.reference,
    periodFrom: fromDbDate(p.periodFrom),
    periodTo: fromDbDate(p.periodTo),
  }
}

export async function getClient(id: number): Promise<ClientPageData | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const ctx = await viewContext()
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      services: { orderBy: { id: "asc" }, include: { invoices: serviceInclude.invoices } },
    },
  })
  if (!client) return null
  const services = client.services.map((s) => toServiceRow({ ...s, client }, ctx))
  const ids = services.map((s) => s.id)
  const byId = new Map(services.map((s) => [s.id, s]))
  const [payments, reminders] = await Promise.all([
    prisma.payment.findMany({
      where: { serviceId: { in: ids } },
      include: paymentInclude,
      orderBy: [{ paidOn: "desc" }, { id: "desc" }],
    }),
    prisma.reminder.findMany({
      where: { serviceId: { in: ids }, recipient: "client" },
      orderBy: [{ sentAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    }),
  ])
  const detail: ClientDetail = {
    id: client.id,
    name: client.name,
    company: client.company,
    email: client.email,
    phone: client.phone,
    address: client.address,
    currency: client.currency,
    notes: client.notes,
    services,
  }
  const paymentRows = payments.map(toPaymentRow)
  const reminderRows = reminders.flatMap((r) => {
    const s = byId.get(r.serviceId)
    return s ? [toReminderRow(r, s)] : []
  })
  return {
    client: detail,
    payments: paymentRows,
    reminders: reminderRows,
    activity: buildActivity(detail, paymentRows, reminderRows),
  }
}

// The timeline is derived from services, payments and reminders, as in the
// approved UI. Dates without a time sit at 09:00 PK.
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
      const map: Partial<Record<ReminderRow["status"], [ActivityItem["kind"], string]>> = {
        sent: [r.channel, `${channel} reminder sent for ${r.service.domain}`],
        opened: ["whatsapp", `WhatsApp reminder opened for ${r.service.domain}`],
        failed: ["failed", `${channel} reminder for ${r.service.domain} failed`],
        skipped: ["skipped", `${channel} reminder for ${r.service.domain} skipped`],
      }
      const entry = map[r.status]
      return entry ? [{ id: `rem-${r.id}`, at: r.sentAt, kind: entry[0], text: entry[1] }] : []
    }),
  ]
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

export interface ClientExportRow {
  name: string
  company: string | null
  email: string | null
  /** Normalised digits. */
  phone: string | null
  address: string | null
  currency: string
  services: number
  notes: string | null
  /** YYYY-MM-DD (PK). */
  createdOn: string
}

/** Every client, by name (CSV export / weekly backup). */
export async function exportClients(): Promise<ClientExportRow[]> {
  const rows = await prisma.client.findMany({
    include: { _count: { select: { services: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  })
  return rows.map((c) => ({
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    address: c.address,
    currency: c.currency,
    services: c._count.services,
    notes: c.notes,
    createdOn: todayPK(c.createdAt),
  }))
}

/** Every service, by renewal date (CSV export). */
export async function exportServices(): Promise<ServiceRow[]> {
  const ctx = await viewContext()
  const rows = await prisma.service.findMany({
    include: serviceInclude,
    orderBy: [{ renewalDate: "asc" }, { id: "asc" }],
  })
  return rows.map((s) => toServiceRow(s, ctx))
}

export async function getService(id: number): Promise<ServiceRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const [s, ctx] = await Promise.all([
    prisma.service.findUnique({ where: { id }, include: serviceInclude }),
    viewContext(),
  ])
  return s ? toServiceRow(s, ctx) : null
}

/* Reminders, payments, notifications -------------------------------- */

export interface Page<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  /** Rows before any filter (0 = nothing yet, not "no matches"). */
  totalAll: number
}

function pageOf(total: number, page: number) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const p = Math.min(Math.max(1, page), pages)
  return { page: p, skip: (p - 1) * PAGE_SIZE }
}

/** A PK calendar-date range as UTC instants (for timestamptz columns). */
function instantRange(r: DateRange): Prisma.DateTimeNullableFilter | undefined {
  if (!r.from && !r.to) return undefined
  return {
    ...(r.from ? { gte: new Date(`${r.from}T00:00:00+05:00`) } : {}),
    ...(r.to ? { lt: new Date(`${addDays(r.to, 1)}T00:00:00+05:00`) } : {}),
  }
}

/** Reminder log (docs/06 §4.9): rows not sent yet at the top, then newest first. */
export async function listReminderLog(
  filters: ReminderLogParams
): Promise<Page<ReminderRow>> {
  const sent = instantRange(filters)
  const ci = filters.q ? ({ contains: filters.q, mode: "insensitive" } as const) : null
  const where: Prisma.ReminderWhereInput = {
    recipient: "client",
    ...(filters.channel ? { channel: filters.channel as ReminderChannel } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(sent ? { sentAt: sent } : {}),
    ...(ci
      ? {
          service: {
            OR: [{ domain: ci }, { client: { name: ci } }, { client: { company: ci } }],
          },
        }
      : {}),
  }
  const [total, totalAll, ctx] = await Promise.all([
    prisma.reminder.count({ where }),
    prisma.reminder.count({ where: { recipient: "client" } }),
    viewContext(),
  ])
  const { page, skip } = pageOf(total, filters.page)
  const rows = await prisma.reminder.findMany({
    where,
    include: { service: { include: serviceInclude } },
    orderBy: [{ sentAt: { sort: "desc", nulls: "first" } }, { id: "desc" }],
    skip,
    take: PAGE_SIZE,
  })
  return {
    rows: rows.map((r) => toReminderRow(r, toServiceRow(r.service, ctx))),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalAll,
  }
}

export interface PaymentList extends Page<PaymentRow> {
  /** Totals per currency for the whole filtered range (not just this page). */
  totals: CurrencyTotal[]
}

function paymentWhere(range: DateRange & { q?: string }): Prisma.PaymentWhereInput {
  const q = range.q?.trim()
  const ci = q ? ({ contains: q, mode: "insensitive" } as const) : null
  const methods = q
    ? Object.entries(PAYMENT_METHOD_KEYS)
        .filter(([label]) => label.toLowerCase().includes(q.toLowerCase()))
        .map(([, key]) => key)
    : []
  return {
    ...(range.from || range.to
      ? {
          paidOn: {
            ...(range.from ? { gte: toDbDate(range.from) } : {}),
            ...(range.to ? { lte: toDbDate(range.to) } : {}),
          },
        }
      : {}),
    ...(ci
      ? {
          OR: [
            { reference: ci },
            { service: { domain: ci } },
            { service: { client: { name: ci } } },
            ...(methods.length ? [{ method: { in: methods } }] : []),
          ],
        }
      : {}),
  }
}

/** Payments (docs/06 §4.10), newest first. */
export async function listPayments(filters: PaymentParams): Promise<PaymentList> {
  const where = paymentWhere(filters)
  const [total, totalAll, sums, s] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.count(),
    prisma.payment.groupBy({ by: ["currency"], where, _sum: { amount: true } }),
    getAppSettings(),
  ])
  const { page, skip } = pageOf(total, filters.page)
  const rows = await prisma.payment.findMany({
    where,
    include: paymentInclude,
    orderBy: [{ paidOn: "desc" }, { id: "desc" }],
    skip,
    take: PAGE_SIZE,
  })
  return {
    rows: rows.map(toPaymentRow),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalAll,
    totals: totalsByCurrency(
      sums.map((x) => ({ currency: x.currency, amount: (x._sum.amount ?? 0).toFixed(MONEY_SCALE) })),
      s.defaultCurrency
    ),
  }
}

/** Every payment in a date range (CSV export). */
export async function exportPayments(
  range: DateRange & { q?: string }
): Promise<PaymentRow[]> {
  const rows = await prisma.payment.findMany({
    where: paymentWhere(range),
    include: paymentInclude,
    orderBy: [{ paidOn: "desc" }, { id: "desc" }],
  })
  return rows.map(toPaymentRow)
}

export const NOTIFICATIONS_PAGE_SIZE = 25

/** The Notifications page (docs/07 §1: paginated list), newest first. */
export async function listNotificationsPage(page: number): Promise<{
  unread: number
  items: NotificationItem[]
  total: number
  page: number
  pageSize: number
}> {
  const [unread, total] = await Promise.all([
    prisma.notification.count({ where: { isRead: false } }),
    prisma.notification.count(),
  ])
  const { page: p, skip } = pageOf(total, page)
  const rows = await prisma.notification.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: NOTIFICATIONS_PAGE_SIZE,
    include: { service: { select: { clientId: true } } },
  })
  return {
    unread,
    total,
    page: p,
    pageSize: NOTIFICATIONS_PAGE_SIZE,
    items: rows.map((n) => ({
      id: n.id.toString(),
      type: n.type,
      title: n.title,
      createdAt: n.createdAt.toISOString(),
      isRead: n.isRead,
      href: n.service ? `/clients/${n.service.clientId}#svc-${n.serviceId}` : undefined,
    })),
  }
}

/** The bell's latest items (no paging). */
export async function listNotifications(limit = 10): Promise<{
  unread: number
  items: NotificationItem[]
}> {
  const [unread, rows] = await Promise.all([
    prisma.notification.count({ where: { isRead: false } }),
    prisma.notification.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      include: { service: { select: { clientId: true } } },
    }),
  ])
  return {
    unread,
    items: rows.map((n) => ({
      id: n.id.toString(),
      type: n.type,
      title: n.title,
      createdAt: n.createdAt.toISOString(),
      isRead: n.isRead,
      href: n.service ? `/clients/${n.service.clientId}#svc-${n.serviceId}` : undefined,
    })),
  }
}
