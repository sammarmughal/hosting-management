import "server-only"

import { createHash } from "node:crypto"

// Pages read data only through src/lib/data.ts (docs/06 §7.2), which
// re-exports this file. Same exports and signatures as the Phase 1 mock
// queries, implemented with Prisma and returning the view-model types.
import type { Prisma, ReminderChannel } from "@/generated/prisma/client"
import { brandInitials } from "@/lib/domain/brand"
import { companyOptionLabel } from "@/lib/domain/companies"
import { addDays, daysLeft, formatDatePK, todayPK } from "@/lib/domain/dates"
import { adminWhatsappText } from "@/lib/domain/messages"
import {
  formatMoney,
  MONEY_SCALE,
  toUnits,
  totalsByCurrency,
  type CurrencyTotal,
} from "@/lib/domain/money"
import { statusColour } from "@/lib/domain/status"
import { PAYMENT_METHOD_KEYS, paymentMethodLabel } from "@/lib/domain/validation"
import { linkProvider } from "@/lib/domain/whatsapp"
import type {
  ClientListParams,
  CompanyListParams,
  DateRange,
  PaymentParams,
  ReminderLogParams,
} from "@/lib/list-filters"
import type { SubscriptionFilter, SubscriptionSort } from "@/lib/subscription-filters"
import { prisma } from "@/lib/server/db"
import { fromDbDate, toDbDate } from "@/lib/server/db-dates"
import {
  getAppSettings,
  getPreferences as loadPreferences,
  getTemplate,
} from "@/lib/server/settings"
import { currentSession } from "@/lib/server/session"
import {
  subscriptionInclude,
  toReminderRow,
  toSubscriptionRow,
  viewContext,
  type ViewContext,
} from "@/lib/server/view"
import type {
  ActivityItem,
  ClientDetail,
  ClientListRow,
  CompanyRow,
  DashboardStats,
  NextRenewal,
  NotificationItem,
  Option,
  PaymentRow,
  QueueItem,
  ReminderRow,
  ServiceTypeRow,
  ShellSummary,
  SubscriptionRow,
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
    brand: {
      initials: brandInitials(s.businessName),
      logoVersion: s.invoices.logo
        ? createHash("sha256").update(s.invoices.logo).digest("hex").slice(0, 12)
        : null,
    },
    remindersDue: queue.length,
    remindersOverdue: queue.some((q) => q.subscription.daysLeft < 0),
    unreadNotifications: unread,
  }
}

/* Reminder queue ---------------------------------------------------- */

export interface ReminderQueueData {
  /** Subscriptions with at least one client reminder still needing action. */
  queue: QueueItem[]
  adminEmail: string
  /** wa.me link to the admin's own number with the summary text (docs/08 §5.2). */
  adminSummaryWaLink: string | null
}

/**
 * One item per subscription with an open client row: its email and WhatsApp
 * rows for that stage (including a sibling that's already sent). Most urgent
 * first. `companyId` narrows it to one company (docs/14 §7).
 */
async function loadQueue(ctx: ViewContext, companyId = 0): Promise<QueueItem[]> {
  const open = await prisma.reminder.findMany({
    where: {
      recipient: "client",
      status: { in: OPEN },
      ...(companyId ? { subscription: { companyId } } : {}),
    },
    select: { subscriptionId: true, cycleDate: true, stage: true },
  })
  if (open.length === 0) return []
  const keys = new Map(
    open.map((r) => [`${r.subscriptionId}:${fromDbDate(r.cycleDate)}:${r.stage}`, r])
  )
  const rows = await prisma.reminder.findMany({
    where: {
      recipient: "client",
      OR: [...keys.values()].map((k) => ({
        subscriptionId: k.subscriptionId,
        cycleDate: k.cycleDate,
        stage: k.stage,
      })),
    },
    include: { subscription: { include: subscriptionInclude } },
    orderBy: { id: "asc" },
  })
  const items = new Map<string, QueueItem>()
  for (const r of rows) {
    const key = `${r.subscriptionId}:${fromDbDate(r.cycleDate)}:${r.stage}`
    let item = items.get(key)
    if (!item) {
      item = {
        subscription: toSubscriptionRow(r.subscription, ctx),
        stage: r.stage,
        email: null,
        whatsapp: null,
      }
      items.set(key, item)
    }
    item[r.channel] = toReminderRow(r, item.subscription)
  }
  return [...items.values()]
    .filter((q) => [q.email, q.whatsapp].some((r) => r && OPEN.includes(r.status)))
    .sort(
      (a, b) =>
        a.subscription.daysLeft - b.subscription.daysLeft ||
        a.subscription.id - b.subscription.id
    )
}

async function adminSummaryLink(queue: QueueItem[], ctx: ViewContext) {
  const s = await getAppSettings()
  if (!queue.length || !s.adminWhatsapp) return null
  const text = adminWhatsappText(
    await getTemplate("admin_whatsapp"),
    queue.map((q) => q.subscription),
    ctx.business,
    ctx.today
  )
  return linkProvider.prepare({ to: s.adminWhatsapp, text })?.url ?? null
}

export async function getReminderQueue(companyId = 0): Promise<ReminderQueueData> {
  const ctx = await viewContext()
  const [queue, s] = await Promise.all([loadQueue(ctx, companyId), getAppSettings()])
  return {
    queue,
    adminEmail: s.adminEmail,
    adminSummaryWaLink: await adminSummaryLink(queue, ctx),
  }
}

/* Dashboard --------------------------------------------------------- */

export interface DashboardData extends ReminderQueueData {
  stats: DashboardStats
  /** Active subscriptions with ≤ 30 days left or expired, most urgent first (max 10). */
  dueSoon: SubscriptionRow[]
  lastCheckAt: string
}

export async function getDashboard(companyId = 0): Promise<DashboardData> {
  const ctx = await viewContext()
  const s = await getAppSettings()
  const t = ctx.thresholds
  const in30 = { gte: toDbDate(ctx.today), lte: toDbDate(addDays(ctx.today, 30)) }
  const active = { status: "active" } as const
  const [count, expiring, urgent, expired, expected, dueSoon, queue] = await Promise.all([
    prisma.subscription.count({ where: active }),
    prisma.subscription.count({
      where: {
        ...active,
        renewalDate: { gte: in30.gte, lte: toDbDate(addDays(ctx.today, t.orange)) },
      },
    }),
    prisma.subscription.count({
      where: {
        ...active,
        renewalDate: { gte: in30.gte, lte: toDbDate(addDays(ctx.today, t.red)) },
      },
    }),
    prisma.subscription.count({ where: { ...active, renewalDate: { lt: in30.gte } } }),
    prisma.subscription.groupBy({
      by: ["currency"],
      where: { ...active, renewalDate: in30 },
      _sum: { chargeAmount: true },
    }),
    prisma.subscription.findMany({
      where: { ...active, renewalDate: { lte: in30.lte } },
      include: subscriptionInclude,
      orderBy: [{ renewalDate: "asc" }, { id: "asc" }],
      take: 10,
    }),
    loadQueue(ctx, companyId),
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
    dueSoon: dueSoon.map((x) => toSubscriptionRow(x, ctx)),
    lastCheckAt: s.lastCheckAt ?? new Date(0).toISOString(),
  }
}

/* Subscriptions (docs/14 §4) ---------------------------------------- */

const FILTERS: Record<
  Exclude<SubscriptionFilter, "all">,
  (s: SubscriptionRow) => boolean
> = {
  active: (s) => s.status === "active",
  due: (s) => s.status === "active" && s.daysLeft <= 30,
  soon: (s) => s.status === "active" && s.daysLeft >= 0 && s.daysLeft <= 30,
  green: (s) => s.colour === "green",
  orange: (s) => s.colour === "orange",
  red: (s) => s.colour === "red",
  expired: (s) => s.colour === "expired",
  cancelled: (s) => s.colour === "cancelled",
}

export interface SubscriptionFilters {
  q?: string
  filter?: SubscriptionFilter
  /** 'YYYY-MM' */
  month?: string
  /** Company id, 0 = any. */
  company?: number
  /** Service type id, 0 = any. */
  service?: number
  sort?: SubscriptionSort
  page?: number
}

export const PAGE_SIZE = 25

export interface SubscriptionList {
  rows: SubscriptionRow[]
  /** Rows matching the search and filter (before paging). */
  total: number
  /** Every subscription, ignoring search and filters (0 = none yet). */
  totalAll: number
  page: number
  pageSize: number
  counts: Record<SubscriptionFilter, number>
}

/**
 * Search across client, company, service type and subscription fields
 * (docs/03 §5, docs/14 §8). Phone matches digits.
 */
function subscriptionSearch(q: string): Prisma.SubscriptionWhereInput {
  const needle = q.trim()
  if (!needle) return {}
  const digits = needle.replace(/\D/g, "").replace(/^0/, "")
  // Case-insensitive through the columns' utf8mb4_unicode_ci collation.
  const ci = { contains: needle } as const
  return {
    OR: [
      { domain: ci },
      { client: { name: ci } },
      { company: { name: ci } },
      { serviceType: { name: ci } },
      { client: { email: ci } },
      ...(digits.length >= 3 ? [{ client: { phone: { contains: digits } } }] : []),
    ],
  }
}

function monthRange(month?: string): Prisma.SubscriptionWhereInput {
  if (!month) return {}
  const start = `${month}-01`
  const [y = 0, m = 1] = month.split("-").map(Number)
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`
  return { renewalDate: { gte: toDbDate(start), lt: toDbDate(next) } }
}

const SORTS: Record<
  SubscriptionSort,
  (a: SubscriptionRow, b: SubscriptionRow) => number
> = {
  days_asc: (a, b) => cancelledLast(a, b) || a.daysLeft - b.daysLeft || a.id - b.id,
  days_desc: (a, b) => cancelledLast(a, b) || b.daysLeft - a.daysLeft || a.id - b.id,
  name: (a, b) => a.clientName.localeCompare(b.clientName) || a.id - b.id,
  renewal: (a, b) => a.renewalDate.localeCompare(b.renewalDate) || a.id - b.id,
  charge: (a, b) =>
    Math.sign(Number(toUnits(b.chargeAmount) - toUnits(a.chargeAmount))) || a.id - b.id,
}

function cancelledLast(a: SubscriptionRow, b: SubscriptionRow) {
  return Number(a.status === "cancelled") - Number(b.status === "cancelled")
}

export async function listSubscriptions(
  filters: SubscriptionFilters = {}
): Promise<SubscriptionList> {
  const {
    q = "",
    filter = "all",
    month,
    company = 0,
    service = 0,
    sort = "days_asc",
    page = 1,
  } = filters
  const ctx = await viewContext()
  const [found, totalAll] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        AND: [
          subscriptionSearch(q),
          monthRange(month),
          company ? { companyId: company } : {},
          service ? { serviceTypeId: service } : {},
        ],
      },
      include: subscriptionInclude,
    }),
    prisma.subscription.count(),
  ])
  // Colours depend on today and the thresholds, so the chip counts, filter
  // and sort run here; the search and the other filters ran in the database.
  const searched = found.map((s) => toSubscriptionRow(s, ctx))
  const counts = { all: searched.length } as Record<SubscriptionFilter, number>
  for (const [key, test] of Object.entries(FILTERS))
    counts[key as SubscriptionFilter] = searched.filter(test).length

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

export async function getSubscription(id: number): Promise<SubscriptionRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const [s, ctx] = await Promise.all([
    prisma.subscription.findUnique({ where: { id }, include: subscriptionInclude }),
    viewContext(),
  ])
  return s ? toSubscriptionRow(s, ctx) : null
}

/* Shared helpers ------------------------------------------------------ */

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

/** The soonest renewal among active subscriptions, as a timer pill. */
function nextRenewal(
  subs: readonly { status: string; renewalDate: Date }[],
  ctx: ViewContext
): NextRenewal | null {
  const dates = subs
    .filter((s) => s.status === "active")
    .map((s) => fromDbDate(s.renewalDate))
    .sort()
  const first = dates[0]
  if (!first) return null
  const left = daysLeft(first, ctx.today)
  return {
    renewalDate: first,
    daysLeft: left,
    colour: statusColour(left, ctx.thresholds),
  }
}

/* Clients (docs/14 §7) ---------------------------------------------- */

function clientSearch(q: string): Prisma.ClientWhereInput {
  const needle = q.trim()
  if (!needle) return {}
  const digits = needle.replace(/\D/g, "").replace(/^0/, "")
  const ci = { contains: needle } as const
  return {
    OR: [
      { name: ci },
      { email: ci },
      { companies: { some: { name: ci } } },
      { subscriptions: { some: { domain: ci } } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ],
  }
}

/** /clients: one row per client, by name. */
export async function listClients(
  params: ClientListParams
): Promise<Page<ClientListRow>> {
  const where = clientSearch(params.q)
  const [total, totalAll, ctx] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.count(),
    viewContext(),
  ])
  const { page, skip } = pageOf(total, params.page)
  const rows = await prisma.client.findMany({
    where,
    include: {
      _count: { select: { companies: true } },
      subscriptions: { select: { status: true, renewalDate: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip,
    take: PAGE_SIZE,
  })
  return {
    rows: rows.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      currency: c.currency,
      companies: c._count.companies,
      activeSubscriptions: c.subscriptions.filter((s) => s.status === "active").length,
      next: nextRenewal(c.subscriptions, ctx),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalAll,
  }
}

export interface ClientPageData {
  client: ClientDetail
  payments: PaymentRow[]
  reminders: ReminderRow[]
  activity: ActivityItem[]
}

const paymentInclude = {
  subscription: {
    include: {
      client: true,
      company: { select: { name: true } },
      serviceType: { select: { name: true } },
    },
  },
} as const

type PaymentRecord = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>

function toPaymentRow(p: PaymentRecord): PaymentRow {
  return {
    id: p.id,
    subscriptionId: p.subscriptionId,
    domain: p.subscription.domain,
    serviceName: p.subscription.serviceType.name,
    clientName: p.subscription.client.name,
    company: p.subscription.company?.name ?? null,
    amount: p.amount.toFixed(MONEY_SCALE),
    currency: p.currency,
    paidOn: fromDbDate(p.paidOn),
    method: paymentMethodLabel(p.method),
    reference: p.reference,
    periodFrom: fromDbDate(p.periodFrom),
    periodTo: fromDbDate(p.periodTo),
  }
}

const companyInclude = {
  client: { select: { name: true } },
  subscriptions: {
    select: {
      status: true,
      renewalDate: true,
      _count: { select: { invoices: true, payments: true } },
    },
  },
} satisfies Prisma.CompanyInclude

type CompanyRecord = Prisma.CompanyGetPayload<{ include: typeof companyInclude }>

function toCompanyRow(c: CompanyRecord, ctx: ViewContext): CompanyRow {
  return {
    id: c.id,
    clientId: c.clientId,
    clientName: c.client.name,
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: c.address,
    subscriptions: c.subscriptions.length,
    invoices: c.subscriptions.reduce((n, s) => n + s._count.invoices, 0),
    payments: c.subscriptions.reduce((n, s) => n + s._count.payments, 0),
    next: nextRenewal(c.subscriptions, ctx),
  }
}

export async function getClient(id: number): Promise<ClientPageData | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const ctx = await viewContext()
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      companies: { orderBy: [{ name: "asc" }, { id: "asc" }], include: companyInclude },
      subscriptions: {
        orderBy: { id: "asc" },
        include: {
          company: subscriptionInclude.company,
          serviceType: subscriptionInclude.serviceType,
          invoices: subscriptionInclude.invoices,
        },
      },
    },
  })
  if (!client) return null
  const subscriptions = client.subscriptions.map((s) =>
    toSubscriptionRow({ ...s, client }, ctx)
  )
  const ids = subscriptions.map((s) => s.id)
  const byId = new Map(subscriptions.map((s) => [s.id, s]))
  const [payments, reminders] = await Promise.all([
    prisma.payment.findMany({
      where: { subscriptionId: { in: ids } },
      include: paymentInclude,
      orderBy: [{ paidOn: "desc" }, { id: "desc" }],
    }),
    prisma.reminder.findMany({
      where: { subscriptionId: { in: ids }, recipient: "client" },
      orderBy: [{ sentAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    }),
  ])
  const detail: ClientDetail = {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    address: client.address,
    currency: client.currency,
    notes: client.notes,
    companies: client.companies.map((c) => toCompanyRow(c, ctx)),
    subscriptions,
  }
  const paymentRows = payments.map(toPaymentRow)
  const reminderRows = reminders.flatMap((r) => {
    const s = byId.get(r.subscriptionId)
    return s ? [toReminderRow(r, s)] : []
  })
  return {
    client: detail,
    payments: paymentRows,
    reminders: reminderRows,
    activity: buildActivity(detail, paymentRows, reminderRows),
  }
}

// The timeline is derived from subscriptions, payments and reminders, as in
// the approved UI. Dates without a time sit at 09:00 PK.
function buildActivity(
  client: ClientDetail,
  payments: PaymentRow[],
  reminders: ReminderRow[]
): ActivityItem[] {
  const atDate = (d: string) => `${d}T09:00:00+05:00`
  const items: ActivityItem[] = [
    ...client.subscriptions.map((s) => ({
      id: `sub-${s.id}`,
      at: atDate(s.startDate),
      kind: "subscription" as const,
      text: `${s.serviceName} for ${s.domain} started${s.planLabel ? ` on the ${s.planLabel} plan` : ""}`,
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
          sent: [r.channel, `${channel} reminder sent for ${r.subscription.domain}`],
          opened: ["whatsapp", `WhatsApp reminder opened for ${r.subscription.domain}`],
          failed: ["failed", `${channel} reminder for ${r.subscription.domain} failed`],
          skipped: [
            "skipped",
            `${channel} reminder for ${r.subscription.domain} skipped`,
          ],
        }
      const entry = map[r.status]
      return entry
        ? [{ id: `rem-${r.id}`, at: r.sentAt, kind: entry[0], text: entry[1] }]
        : []
    }),
  ]
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

/* Companies (docs/14 §3) -------------------------------------------- */

export async function listCompanies(
  params: CompanyListParams
): Promise<Page<CompanyRow>> {
  const ci = params.q ? ({ contains: params.q } as const) : null
  const where: Prisma.CompanyWhereInput = {
    ...(params.client ? { clientId: params.client } : {}),
    ...(ci ? { OR: [{ name: ci }, { email: ci }, { client: { name: ci } }] } : {}),
  }
  const [total, totalAll, ctx] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.count(),
    viewContext(),
  ])
  const { page, skip } = pageOf(total, params.page)
  const rows = await prisma.company.findMany({
    where,
    include: companyInclude,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip,
    take: PAGE_SIZE,
  })
  return {
    rows: rows.map((c) => toCompanyRow(c, ctx)),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalAll,
  }
}

export async function getCompany(id: number): Promise<CompanyRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const [c, ctx] = await Promise.all([
    prisma.company.findUnique({ where: { id }, include: companyInclude }),
    viewContext(),
  ])
  return c ? toCompanyRow(c, ctx) : null
}

/* Pickers and filters ------------------------------------------------- */

/** Every client, for the company and subscription forms. */
export async function clientOptions(): Promise<(Option & { currency: string })[]> {
  const rows = await prisma.client.findMany({
    select: { id: true, name: true, currency: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  })
  return rows.map((c) => ({ id: c.id, label: c.name, currency: c.currency }))
}

/** Every company with its client: "Company — Client" (docs/14 §8). */
export async function companyOptions(): Promise<
  (Option & { clientId: number; name: string })[]
> {
  const rows = await prisma.company.findMany({
    select: { id: true, name: true, clientId: true, client: { select: { name: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  })
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    clientId: c.clientId,
    label: companyOptionLabel(c.name, c.client.name),
  }))
}

/** The Service Catalog with usage, in list order (docs/14 §2). */
export async function listServiceTypes(): Promise<ServiceTypeRow[]> {
  const rows = await prisma.serviceType.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  })
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    defaultPrice: t.defaultPrice ? t.defaultPrice.toFixed(MONEY_SCALE) : null,
    isActive: t.isActive,
    position: t.position,
    usedBy: t._count.subscriptions,
  }))
}

/**
 * Everything the subscription form picks from (docs/14 §4): clients,
 * companies, active service types (plus `keepTypeId`, an edited
 * subscription's own type) and the enabled currencies.
 */
export async function getSubscriptionFormOptions(keepTypeId?: number) {
  const [clients, companies, types, s] = await Promise.all([
    clientOptions(),
    companyOptions(),
    listServiceTypes(),
    getAppSettings(),
  ])
  return {
    clients,
    companies,
    serviceTypes: types
      .filter((t) => t.isActive || t.id === keepTypeId)
      .map((t) => ({ id: t.id, name: t.name, defaultPrice: t.defaultPrice })),
    enabledCurrencies: s.enabledCurrencies,
    defaultCurrency: s.defaultCurrency,
  }
}

/* Exports (docs/14 §9) ------------------------------------------------ */

export interface ClientExportRow {
  name: string
  email: string | null
  /** Normalised digits. */
  phone: string | null
  address: string | null
  currency: string
  notes: string | null
  companies: number
  subscriptions: number
  /** YYYY-MM-DD (PK). */
  createdOn: string
}

/** Every client, by name (CSV export / weekly backup). */
export async function exportClients(): Promise<ClientExportRow[]> {
  const rows = await prisma.client.findMany({
    include: { _count: { select: { companies: true, subscriptions: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  })
  return rows.map((c) => ({
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: c.address,
    currency: c.currency,
    notes: c.notes,
    companies: c._count.companies,
    subscriptions: c._count.subscriptions,
    createdOn: todayPK(c.createdAt),
  }))
}

export interface CompanyExportRow {
  clientName: string
  clientEmail: string | null
  clientPhone: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
}

/** Every company, by client then name (CSV export). */
export async function exportCompanies(): Promise<CompanyExportRow[]> {
  const rows = await prisma.company.findMany({
    include: { client: { select: { name: true, email: true, phone: true } } },
    orderBy: [{ client: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
  })
  return rows.map((c) => ({
    clientName: c.client.name,
    clientEmail: c.client.email,
    clientPhone: c.client.phone,
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: c.address,
  }))
}

/** Every subscription, by renewal date (CSV export). */
export async function exportSubscriptions(): Promise<SubscriptionRow[]> {
  const ctx = await viewContext()
  const rows = await prisma.subscription.findMany({
    include: subscriptionInclude,
    orderBy: [{ renewalDate: "asc" }, { id: "asc" }],
  })
  return rows.map((s) => toSubscriptionRow(s, ctx))
}

/* Reminders, payments, notifications -------------------------------- */

/** A PK calendar-date range as UTC instants (for DATETIME(3) UTC columns). */
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
  const ci = filters.q ? ({ contains: filters.q } as const) : null
  const where: Prisma.ReminderWhereInput = {
    recipient: "client",
    ...(filters.channel ? { channel: filters.channel as ReminderChannel } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(sent ? { sentAt: sent } : {}),
    subscription: {
      ...(filters.company ? { companyId: filters.company } : {}),
      ...(ci
        ? { OR: [{ domain: ci }, { client: { name: ci } }, { company: { name: ci } }] }
        : {}),
    },
  }
  const [total, totalAll, ctx] = await Promise.all([
    prisma.reminder.count({ where }),
    prisma.reminder.count({ where: { recipient: "client" } }),
    viewContext(),
  ])
  const { page, skip } = pageOf(total, filters.page)
  const rows = await prisma.reminder.findMany({
    where,
    include: { subscription: { include: subscriptionInclude } },
    orderBy: [{ sentAt: { sort: "desc", nulls: "first" } }, { id: "desc" }],
    skip,
    take: PAGE_SIZE,
  })
  return {
    rows: rows.map((r) => toReminderRow(r, toSubscriptionRow(r.subscription, ctx))),
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
  const ci = q ? ({ contains: q } as const) : null
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
            { subscription: { domain: ci } },
            { subscription: { client: { name: ci } } },
            { subscription: { company: { name: ci } } },
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
      sums.map((x) => ({
        currency: x.currency,
        amount: (x._sum.amount ?? 0).toFixed(MONEY_SCALE),
      })),
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

/** A notification opens its subscription on the client page. */
const notificationHref = (n: {
  subscriptionId: number | null
  subscription: { clientId: number } | null
}) =>
  n.subscription
    ? `/clients/${n.subscription.clientId}?tab=subscriptions#sub-${n.subscriptionId}`
    : undefined

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
    include: { subscription: { select: { clientId: true } } },
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
      href: notificationHref(n),
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
      include: { subscription: { select: { clientId: true } } },
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
      href: notificationHref(n),
    })),
  }
}
