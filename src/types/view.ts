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

export interface SubscriptionRow {
  id: number
  clientId: number
  clientName: string
  /** The subscription's company (docs/14), if it has one. */
  companyId?: number | null
  company?: string | null
  serviceTypeId: number
  /** The catalog name, e.g. "Web Hosting". */
  serviceName: string
  email?: string | null
  phone?: string | null // phone = normalised digits
  /** Client address (optional). */
  address?: string | null
  /** The client's default currency (new subscriptions start in it). */
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
  /** Added in Phase 1: subscription notes (for the edit form). */
  notes?: string | null
  /** docs/13 §11: the invoice for the current cycle, if one exists. */
  invoice?: InvoiceChip | null
}

/* Invoices (docs/13) --------------------------------------------------- */

export type { InvoiceDisplayStatus }

/** "INV-2026-0012 · Unpaid" on subscription cards and queue rows. */
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
  /** The company on the invoice's bill-to (docs/14 §5). */
  company?: string | null
  email?: string | null
  subscriptionId: number
  domain: string
  serviceName: string
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
  subscription: SubscriptionRow
  firstSentAt?: string | null
  voidedAt?: string | null
  voidReason?: string | null
  events: InvoiceEventItem[]
}

export interface ReminderRow {
  id: string
  subscriptionId: number
  stage: number
  channel: "email" | "whatsapp"
  recipient: "client" | "admin"
  status: "pending" | "sent" | "opened" | "failed" | "skipped"
  lastError?: string | null
  sentAt?: string | null
  waLink?: string | null // prebuilt for whatsapp rows
  subscription: SubscriptionRow
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
  email?: string | null
  phone?: string | null // normalised digits
  /** Billing address. */
  address?: string | null
  /** ISO 4217 default currency; new subscriptions (and their invoices and payments) start in it. */
  currency: string
  notes?: string | null
  companies: CompanyRow[]
  subscriptions: SubscriptionRow[]
}

/** The next renewal of a client or company, as a timer pill. */
export interface NextRenewal {
  renewalDate: ISODate
  daysLeft: number
  colour: Colour
}

/** /clients: one row per client (docs/14 §7). */
export interface ClientListRow {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  currency: string
  companies: number
  activeSubscriptions: number
  next: NextRenewal | null
}

/** A company, on /companies and the client page (docs/14 §3). */
export interface CompanyRow {
  id: number
  clientId: number
  clientName: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  subscriptions: number
  /** For the delete confirmation (docs/14 §3). */
  invoices: number
  payments: number
  next: NextRenewal | null
}

/** A Service Catalog entry with its usage (docs/14 §2). */
export interface ServiceTypeRow {
  id: number
  name: string
  /** Decimal string or null. */
  defaultPrice: string | null
  isActive: boolean
  position: number
  /** Subscriptions using it; > 0 means it can't be deleted. */
  usedBy: number
}

/** A select option for pickers and filters. */
export interface Option {
  id: number
  label: string
}

/** One reminder-queue row per subscription: its client email and WhatsApp rows for the current stage. */
export interface QueueItem {
  subscription: SubscriptionRow
  stage: number
  email: ReminderRow | null
  whatsapp: ReminderRow | null
}

/** A line in the client Activity timeline (the audit log, later). */
export interface ActivityItem {
  id: string
  /** ISO timestamp */
  at: string
  kind:
    "subscription" | "payment" | "email" | "whatsapp" | "failed" | "skipped" | "invoice"
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
  /** True when any of those rows belongs to an expired subscription. */
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
  subscriptionId: number
  domain: string
  serviceName: string
  clientName: string
  company?: string | null
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
  subscription: SubscriptionRow
}
