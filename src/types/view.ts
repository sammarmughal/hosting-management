// View-model types (docs/06 §7.1). The mock layer builds these in Phase 1
// and the Prisma layer builds them later, so components never change.
import type { ISODate } from "@/lib/domain/dates"
import type {
  BillToSnapshot,
  InvoiceDisplayStatus,
  SellerSnapshot,
} from "@/lib/domain/invoices"

export type { ISODate }

export type Colour = "green" | "orange" | "red" | "expired" | "cancelled"

export interface ServiceRow {
  id: number
  clientId: number
  clientName: string
  company?: string | null
  email?: string | null
  phone?: string | null // phone = normalised digits
  /** Client address (optional). */
  address?: string | null
  /** The client's own currency (new services start in it). */
  clientCurrency?: string
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
  /** docs/13 §11: the invoice for the current cycle, if one exists. */
  invoice?: InvoiceChip | null
}

/* Invoices (docs/13) --------------------------------------------------- */

export type { InvoiceDisplayStatus }

/** "INV-2026-0012 · Unpaid" on service cards and queue rows. */
export interface InvoiceChip {
  id: number
  number: string
  status: InvoiceDisplayStatus
  total: string
  currency: string
}

export interface InvoiceRow {
  id: number
  number: string
  clientId: number
  clientName: string
  company?: string | null
  email?: string | null
  serviceId: number
  domain: string
  issueDate: ISODate
  dueDate: ISODate
  total: string
  currency: string
  status: InvoiceDisplayStatus
  /** The stored status (issued/sent/paid/void). */
  rawStatus: "issued" | "sent" | "paid" | "void"
  publicUrl: string
}

export interface InvoiceLineItem {
  id: number
  description: string
  periodLabel: string
  quantity: number
  unitAmount: string
  amount: string
}

export interface InvoiceEventItem {
  id: string
  type: string
  /** ISO timestamp */
  at: string
  text: string
  detail?: string | null
}

export interface InvoiceDocumentData {
  number: string
  status: InvoiceDisplayStatus
  issueDate: ISODate
  dueDate: ISODate
  periodStart: ISODate
  periodEnd: ISODate
  currency: string
  subtotal: string
  discount: string
  taxRate: string
  taxAmount: string
  total: string
  items: InvoiceLineItem[]
  billTo: BillToSnapshot
  seller: SellerSnapshot
  notes?: string | null
  paidAt?: ISODate | null
}

export interface InvoiceDetail extends InvoiceDocumentData {
  id: number
  rawStatus: InvoiceRow["rawStatus"]
  publicUrl: string
  service: ServiceRow
  firstSentAt?: string | null
  voidedAt?: string | null
  voidReason?: string | null
  events: InvoiceEventItem[]
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
  address?: string | null
  /** ISO 4217; new services, invoices and payments for this client start in it. */
  currency: string
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
  kind: "service" | "payment" | "email" | "whatsapp" | "failed" | "skipped" | "invoice"
  text: string
}

/** The business's mark in the app shell (sidebar, drawer). */
export interface ShellBrand {
  /** "AR" from "Abdul Rehmaan"; "" when the name has no letters. */
  initials: string
  /** Short hash of the uploaded logo (cache key for /api/brand/logo); null = no logo. */
  logoVersion: string | null
}

export interface ShellSummary {
  adminName: string
  brand: ShellBrand
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

/** The Share invoice dialog's data (docs/13 §9). */
export interface ShareData {
  invoiceId: number
  number: string
  rawStatus: "issued" | "sent" | "paid" | "void"
  clientId: number
  clientName: string
  /** From the client record now (not the invoice snapshot). */
  email: string | null
  /** Normalised digits, or null when missing or invalid. */
  phone: string | null
  /** Why each channel can't be used, or null. */
  emailUnavailable: string | null
  whatsappUnavailable: string | null
  emailSubject: string
  /** The email body as plain text, editable for this send only. */
  emailText: string
  whatsappText: string
  publicUrl: string
  service: ServiceRow
}
