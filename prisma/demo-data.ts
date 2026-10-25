// Realistic demo data (moved from the Phase 1 mock layer). Used by
// `SEED_DEMO=1 npx prisma db seed` in development only. Dates are relative
// to today, so every colour always appears: 3 green, 4 orange, 3 red,
// 2 expired, 1 cancelled. Two clients have two subscriptions each; Karachi
// Auto Parts has two companies, a few clients have one, the rest none (docs/14).
import { formatDatePK } from "@/lib/domain/dates"
import type { ReminderRow, SubscriptionRow } from "@/types/view"

/** What a notification title needs from its subscription. */
type DemoSubscription = Pick<
  SubscriptionRow,
  "domain" | "clientName" | "daysLeft" | "renewalDate"
>

/* Seeds ------------------------------------------------------------- */

export interface SubscriptionSeed {
  id: number
  /** A Service Catalog name; "Web Hosting" when left out. */
  service?: string
  /** The name of one of the client's companies; none when left out. */
  company?: string
  domain: string
  plan: string | null
  /** Days left, relative to today (seed data). */
  days?: number
  amount: string
  currency?: string
  status?: "active" | "cancelled"
  remindersEnabled?: boolean
  notes?: string | null
}

export interface CompanySeed {
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
}

export interface ClientSeed {
  id: number
  name: string
  companies?: CompanySeed[]
  email: string | null
  phone: string | null
  /** Optional (printed on invoices). */
  address?: string | null
  notes: string | null
  subscriptions: SubscriptionSeed[]
}

export const CLIENTS: ClientSeed[] = [
  {
    id: 1,
    name: "Ayesha Siddiqui",
    companies: [{ name: "Ayesha Couture", email: "orders@ayeshacouture.pk" }],
    email: "ayesha@ayeshacouture.pk",
    phone: "0300 1234567",
    notes: "Prefers WhatsApp. Pays by JazzCash.",
    subscriptions: [
      {
        id: 101,
        company: "Ayesha Couture",
        domain: "ayeshacouture.pk",
        plan: "Business",
        days: 2,
        amount: "6500.00",
      },
    ],
  },
  {
    id: 2,
    name: "Noor Dental Clinic",
    email: "info@noordental.pk",
    phone: "0321 4455667",
    notes: null,
    subscriptions: [
      { id: 102, domain: "noordental.pk", plan: "Business", days: 17, amount: "8750.00" },
    ],
  },
  {
    id: 3,
    name: "Bilal Traders",
    email: null,
    phone: "0333 7788990",
    notes: "No email. Call before sending reminders.",
    subscriptions: [
      {
        id: 103,
        domain: "bilaltraders.com",
        plan: "Shared 10 GB",
        days: -4,
        amount: "4500.00",
      },
    ],
  },
  {
    id: 4,
    name: "Karachi Auto Parts",
    email: "imran@karachiautoparts.pk",
    phone: "0345 2233445",
    address: "Shop 14, Plaza Market, Shahrah-e-Faisal, Karachi",
    companies: [
      {
        name: "Karachi Auto Parts",
        email: "shop@karachiautoparts.pk",
        address: "Shop 14, Plaza Market, Shahrah-e-Faisal, Karachi",
      },
      { name: "KAP Online Store", email: "orders@karachiautoparts.com" },
    ],
    notes: "Moved the shop to the .com domain in 2026.",
    subscriptions: [
      {
        id: 104,
        company: "Karachi Auto Parts",
        domain: "karachiautoparts.pk",
        plan: "Shared 10 GB",
        days: 140,
        amount: "12000.00",
        status: "cancelled",
        remindersEnabled: false,
      },
      {
        id: 105,
        service: "Domain and Hosting",
        company: "KAP Online Store",
        domain: "karachiautoparts.com",
        plan: "Business",
        days: 360,
        amount: "9500.00",
      },
    ],
  },
  {
    id: 5,
    name: "Al-Madina Textiles (Pvt) Ltd, Faisalabad Head Office & Export Division",
    email: "accounts@almadinatextiles.com.pk",
    phone: "0300 8456712",
    address: "Plot 27, Sargodha Road Industrial Estate, Faisalabad",
    notes: "Invoices go to the accounts team.",
    subscriptions: [
      {
        id: 106,
        domain: "almadinatextiles.com.pk",
        plan: "Cloud Startup",
        days: 112,
        amount: "24750.00",
      },
      {
        id: 107,
        service: "Domain Registration",
        domain: "almadinaexports.com",
        plan: "Business",
        days: 30,
        amount: "65.00",
        currency: "USD",
      },
    ],
  },
  {
    id: 6,
    name: "Sana Javed",
    email: "sanajaved.writes@gmail.com",
    phone: null,
    notes: "Personal blog. Email only.",
    subscriptions: [
      {
        id: 108,
        domain: "sanajaved.com",
        plan: "Shared 10 GB",
        days: 22,
        amount: "4500.00",
      },
    ],
  },
  {
    id: 7,
    name: "Sheikh & Sons Builders",
    email: "hamza@sheikhbuilders.pk",
    phone: "0312 9988776",
    notes: null,
    subscriptions: [
      {
        id: 109,
        domain: "sheikhbuilders.pk",
        plan: "Business",
        days: 7,
        amount: "15000.00",
      },
    ],
  },
  {
    id: 8,
    name: "Little Stars Montessori",
    email: null,
    phone: "0301 5566778",
    notes: null,
    subscriptions: [
      {
        id: 110,
        domain: "littlestars.edu.pk",
        plan: "Shared 10 GB",
        days: 0,
        amount: "7200.00",
      },
    ],
  },
  {
    id: 9,
    name: "Usman Ghani",
    companies: [
      {
        name: "Ghani Pharmacy",
        phone: "042 35761234",
        address: "12-B Main Boulevard, Gulberg III, Lahore",
      },
    ],
    email: "usman.ghani@ghanipharmacy.pk",
    phone: "0336 1122334",
    notes: null,
    subscriptions: [
      {
        id: 111,
        company: "Ghani Pharmacy",
        domain: "ghanipharmacy.pk",
        plan: "Business",
        days: 12,
        amount: "8000.00",
      },
    ],
  },
  {
    id: 10,
    name: "Zainab Hussain",
    companies: [{ name: "Zainab's Kitchen" }],
    email: "zainabskitchen@gmail.com",
    phone: "0322 6677889",
    notes: null,
    subscriptions: [
      {
        id: 112,
        company: "Zainab's Kitchen",
        domain: "zainabskitchen.pk",
        plan: "Shared 10 GB",
        days: -9,
        amount: "5500.00",
      },
    ],
  },
  {
    id: 11,
    name: "Iqbal Legal Associates",
    email: "faisal@iqballegal.com.pk",
    phone: "0302 3344556",
    notes: null,
    subscriptions: [
      {
        id: 113,
        service: "Website Maintenance",
        domain: "iqballegal.com.pk",
        plan: null,
        days: 64,
        amount: "12000.00",
      },
    ],
  },
]

export interface ReminderSeed {
  id: string
  subscriptionId: number
  channel: "email" | "whatsapp"
  status: ReminderRow["status"]
  /** Minutes before now that it was sent or opened. */
  agoMin?: number
  error?: string
}

export const REMINDERS: ReminderSeed[] = [
  { id: "r1", subscriptionId: 101, channel: "email", status: "pending" },
  { id: "r2", subscriptionId: 101, channel: "whatsapp", status: "pending" },
  { id: "r3", subscriptionId: 109, channel: "email", status: "sent", agoMin: 38 },
  { id: "r4", subscriptionId: 109, channel: "whatsapp", status: "opened", agoMin: 35 },
  { id: "r5", subscriptionId: 110, channel: "whatsapp", status: "pending" },
  { id: "r6", subscriptionId: 103, channel: "whatsapp", status: "pending" },
  {
    id: "r7",
    subscriptionId: 112,
    channel: "email",
    status: "failed",
    agoMin: 40,
    error:
      "550 5.1.1 <zainabskitchen@gmail.com>: Recipient address rejected: Mailbox full",
  },
  { id: "r8", subscriptionId: 112, channel: "whatsapp", status: "pending" },
  // Already handled: sent yesterday, so it is not in the queue.
  { id: "r9", subscriptionId: 102, channel: "email", status: "sent", agoMin: 26 * 60 },
  { id: "r10", subscriptionId: 108, channel: "email", status: "pending" },
]

export interface NotificationSeed {
  id: string
  type: "expiring" | "expired" | "email_failed" | "renewed"
  subscriptionId: number
  agoMin: number
  isRead: boolean
  /** Built from the subscription at build time. */
  title: (s: DemoSubscription) => string
}

const due = (s: DemoSubscription) =>
  s.daysLeft > 0
    ? `${s.domain} expires in ${s.daysLeft} days`
    : s.daysLeft === 0
      ? `${s.domain} expires today`
      : `${s.domain} expired ${-s.daysLeft} days ago`

export const NOTIFICATIONS: NotificationSeed[] = [
  {
    id: "n1",
    type: "expiring",
    subscriptionId: 101,
    agoMin: 26 * 60,
    isRead: false,
    title: (s) => `${s.domain} expires in 3 days`,
  },
  {
    id: "n2",
    type: "expiring",
    subscriptionId: 110,
    agoMin: 3 * 60,
    isRead: false,
    title: due,
  },
  {
    id: "n3",
    type: "email_failed",
    subscriptionId: 112,
    agoMin: 40,
    isRead: false,
    title: (s) => `Email to ${s.clientName} failed`,
  },
  {
    id: "n4",
    type: "expiring",
    subscriptionId: 109,
    agoMin: 4 * 60,
    isRead: false,
    title: due,
  },
  {
    id: "n5",
    type: "expired",
    subscriptionId: 103,
    agoMin: 26 * 60,
    isRead: true,
    title: (s) => `${s.domain} expired 3 days ago`,
  },
  {
    id: "n6",
    type: "renewed",
    subscriptionId: 105,
    agoMin: 5 * 24 * 60,
    isRead: true,
    title: (s) => `${s.domain} renewed until ${formatDatePK(s.renewalDate)}`,
  },
  {
    id: "n7",
    type: "expired",
    subscriptionId: 112,
    agoMin: 3 * 24 * 60,
    isRead: true,
    title: (s) => `${s.domain} expired 6 days ago`,
  },
  {
    id: "n8",
    type: "expiring",
    subscriptionId: 102,
    agoMin: 13 * 24 * 60,
    isRead: true,
    title: (s) => `${s.domain} expires in 30 days`,
  },
]

export interface PaymentSeed {
  id: number
  subscriptionId: number
  method: string
  reference: string | null
  /** Days before the start of the paid period that it was paid. */
  paidEarly: number
}

export const PAYMENTS: PaymentSeed[] = [
  {
    id: 1,
    subscriptionId: 105,
    method: "Bank transfer",
    reference: "MZN-2026-0924-7781",
    paidEarly: 0,
  },
  {
    id: 2,
    subscriptionId: 113,
    method: "Bank transfer",
    reference: "HBL-FT-55120934",
    paidEarly: 3,
  },
  {
    id: 3,
    subscriptionId: 106,
    method: "Bank transfer",
    reference: "MCB-IBFT-88213",
    paidEarly: 9,
  },
  {
    id: 4,
    subscriptionId: 107,
    method: "Bank transfer",
    reference: "Wise 4471-2291",
    paidEarly: 6,
  },
  {
    id: 5,
    subscriptionId: 102,
    method: "JazzCash",
    reference: "JC 8812345601",
    paidEarly: 2,
  },
  {
    id: 6,
    subscriptionId: 101,
    method: "JazzCash",
    reference: "JC 7734102290",
    paidEarly: 1,
  },
  {
    id: 7,
    subscriptionId: 108,
    method: "Easypaisa",
    reference: "EP 30091877",
    paidEarly: 4,
  },
  { id: 8, subscriptionId: 109, method: "Cash", reference: null, paidEarly: 0 },
  {
    id: 9,
    subscriptionId: 111,
    method: "Easypaisa",
    reference: "EP 29910452",
    paidEarly: 5,
  },
  { id: 10, subscriptionId: 103, method: "Cash", reference: null, paidEarly: -2 },
]
