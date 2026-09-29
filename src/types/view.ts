// View-model types (docs/06 §7.1). The mock layer builds these in Phase 1
// and the Prisma layer builds them later, so components never change.
import type { ISODate } from "@/lib/domain/dates"

export type { ISODate }

export type Colour = "green" | "orange" | "red" | "expired" | "cancelled"

export interface ServiceRow {
  id: number
  clientId: number
  clientName: string
  company?: string | null
  email?: string | null
  phone?: string | null // phone = normalised digits
  domain: string
  planLabel?: string | null
  startDate: ISODate
  renewalDate: ISODate
  chargeAmount: string
  currency: string // amount as string (Decimal-safe)
  status: "active" | "cancelled"
  remindersEnabled: boolean
  daysLeft: number
  colour: Colour
  /** Added in Phase 1: prebuilt client WhatsApp link (docs/07 §2), null without a valid phone. */
  waLink?: string | null
  /** Added in Phase 1: service notes (for the edit form). */
  notes?: string | null
}

export interface ReminderRow {
  id: string
  serviceId: number
  stage: number
  channel: "email" | "whatsapp"
  recipient: "client" | "admin"
  status: "pending" | "sent" | "opened" | "failed" | "skipped"
  lastError?: string | null
  sentAt?: string | null
  waLink?: string | null // prebuilt for whatsapp rows
  service: ServiceRow
}

export interface DashboardStats {
  active: number
  expiring30: number
  urgent7: number
  expired: number
  expected30: { currency: string; total: string }[]
}

/* Added in Phase 1 (not in docs/06 §7.1): shapes the shell and the client
   detail page need. Built by the mock layer now, by Prisma later. */

export interface ClientDetail {
  id: number
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null // normalised digits
  notes?: string | null
  services: ServiceRow[]
}

/** One reminder-queue row per service: its client email and WhatsApp rows for the current stage. */
export interface QueueItem {
  service: ServiceRow
  stage: number
  email: ReminderRow | null
  whatsapp: ReminderRow | null
}

/** A line in the client Activity timeline (the audit log, later). */
export interface ActivityItem {
  id: string
  /** ISO timestamp */
  at: string
  kind: "service" | "payment" | "email" | "whatsapp" | "failed" | "skipped"
  text: string
}

export interface ShellSummary {
  adminName: string
  /** Reminder rows still needing action (pending, failed, opened). */
  remindersDue: number
  /** True when any of those rows belongs to an expired service. */
  remindersOverdue: boolean
  unreadNotifications: number
}

export interface NotificationItem {
  id: string
  type: string
  title: string
  createdAt: string
  isRead: boolean
  href?: string
}
export interface PaymentRow {
  id: number
  serviceId: number
  domain: string
  clientName: string
  amount: string
  currency: string
  paidOn: ISODate
  method: string
  reference?: string | null
  periodFrom: ISODate
  periodTo: ISODate
}
