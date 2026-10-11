// Realistic demo data (moved from the Phase 1 mock layer). Used by
// `SEED_DEMO=1 npx prisma db seed` in development only. Dates are relative
// to today, so every colour always appears: 3 green, 4 orange, 3 red,
// 2 expired, 1 cancelled. Two clients have two services each.
import { formatDatePK } from "@/lib/domain/dates"
import type { ReminderRow, ServiceRow } from "@/types/view"

/** What a notification title needs from its service. */
type DemoService = Pick<ServiceRow, "domain" | "clientName" | "daysLeft" | "renewalDate">

/* Seeds ------------------------------------------------------------- */

export interface ServiceSeed {
  id: number
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

export interface ClientSeed {
  id: number
  name: string
  company: string | null
  email: string | null
  phone: string | null
  /** Optional (printed on invoices). */
  address?: string | null
  notes: string | null
  services: ServiceSeed[]
}

export const CLIENTS: ClientSeed[] = [
  {
    id: 1,
    name: "Ayesha Siddiqui",
    company: "Ayesha Couture",
    email: "ayesha@ayeshacouture.pk",
    phone: "0300 1234567",
    notes: "Prefers WhatsApp. Pays by JazzCash.",
    services: [
      {
        id: 101,
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
    company: null,
    email: "info@noordental.pk",
    phone: "0321 4455667",
    notes: null,
    services: [
      { id: 102, domain: "noordental.pk", plan: "Business", days: 17, amount: "8750.00" },
    ],
  },
  {
    id: 3,
    name: "Bilal Traders",
    company: null,
    email: null,
    phone: "0333 7788990",
    notes: "No email. Call before sending reminders.",
    services: [
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
    company: null,
    email: "imran@karachiautoparts.pk",
    phone: "0345 2233445",
    address: "Shop 14, Plaza Market, Shahrah-e-Faisal, Karachi",
    notes: "Moved the shop to the .com domain in 2026.",
    services: [
      {
        id: 104,
        domain: "karachiautoparts.pk",
        plan: "Shared 10 GB",
        days: 140,
        amount: "12000.00",
        status: "cancelled",
        remindersEnabled: false,
      },
      {
        id: 105,
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
    company: null,
    email: "accounts@almadinatextiles.com.pk",
    phone: "0300 8456712",
    address: "Plot 27, Sargodha Road Industrial Estate, Faisalabad",
    notes: "Invoices go to the accounts team.",
    services: [
      {
        id: 106,
        domain: "almadinatextiles.com.pk",
        plan: "Cloud Startup",
        days: 112,
        amount: "24750.00",
      },
      {
        id: 107,
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
    company: null,
    email: "sanajaved.writes@gmail.com",
    phone: null,
    notes: "Personal blog. Email only.",
    services: [
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
    company: null,
    email: "hamza@sheikhbuilders.pk",
    phone: "0312 9988776",
    notes: null,
    services: [
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
    company: null,
    email: null,
    phone: "0301 5566778",
    notes: null,
    services: [
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
    company: "Ghani Pharmacy",
    email: "usman.ghani@ghanipharmacy.pk",
    phone: "0336 1122334",
    notes: null,
    services: [
      {
        id: 111,
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
    company: "Zainab's Kitchen",
    email: "zainabskitchen@gmail.com",
    phone: "0322 6677889",
    notes: null,
    services: [
      {
        id: 112,
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
    company: null,
    email: "faisal@iqballegal.com.pk",
    phone: "0302 3344556",
    notes: null,
    services: [
      {
        id: 113,
        domain: "iqballegal.com.pk",
        plan: "Business",
        days: 64,
        amount: "12000.00",
      },
    ],
  },
]

export interface ReminderSeed {
  id: string
  serviceId: number
  channel: "email" | "whatsapp"
  status: ReminderRow["status"]
  /** Minutes before now that it was sent or opened. */
  agoMin?: number
  error?: string
}

export const REMINDERS: ReminderSeed[] = [
  { id: "r1", serviceId: 101, channel: "email", status: "pending" },
  { id: "r2", serviceId: 101, channel: "whatsapp", status: "pending" },
  { id: "r3", serviceId: 109, channel: "email", status: "sent", agoMin: 38 },
  { id: "r4", serviceId: 109, channel: "whatsapp", status: "opened", agoMin: 35 },
  { id: "r5", serviceId: 110, channel: "whatsapp", status: "pending" },
  { id: "r6", serviceId: 103, channel: "whatsapp", status: "pending" },
  {
    id: "r7",
    serviceId: 112,
    channel: "email",
    status: "failed",
    agoMin: 40,
    error:
      "550 5.1.1 <zainabskitchen@gmail.com>: Recipient address rejected: Mailbox full",
  },
  { id: "r8", serviceId: 112, channel: "whatsapp", status: "pending" },
  // Already handled: sent yesterday, so it is not in the queue.
  { id: "r9", serviceId: 102, channel: "email", status: "sent", agoMin: 26 * 60 },
  { id: "r10", serviceId: 108, channel: "email", status: "pending" },
]

export interface NotificationSeed {
  id: string
  type: "expiring" | "expired" | "email_failed" | "renewed"
  serviceId: number
  agoMin: number
  isRead: boolean
  /** Built from the service at build time. */
  title: (s: DemoService) => string
}

const due = (s: DemoService) =>
  s.daysLeft > 0
    ? `${s.domain} expires in ${s.daysLeft} days`
    : s.daysLeft === 0
      ? `${s.domain} expires today`
      : `${s.domain} expired ${-s.daysLeft} days ago`

export const NOTIFICATIONS: NotificationSeed[] = [
  {
    id: "n1",
    type: "expiring",
    serviceId: 101,
    agoMin: 26 * 60,
    isRead: false,
    title: (s) => `${s.domain} expires in 3 days`,
  },
  {
    id: "n2",
    type: "expiring",
    serviceId: 110,
    agoMin: 3 * 60,
    isRead: false,
    title: due,
  },
  {
    id: "n3",
    type: "email_failed",
    serviceId: 112,
    agoMin: 40,
    isRead: false,
    title: (s) => `Email to ${s.clientName} failed`,
  },
  {
    id: "n4",
    type: "expiring",
    serviceId: 109,
    agoMin: 4 * 60,
    isRead: false,
    title: due,
  },
  {
    id: "n5",
    type: "expired",
    serviceId: 103,
    agoMin: 26 * 60,
    isRead: true,
    title: (s) => `${s.domain} expired 3 days ago`,
  },
  {
    id: "n6",
    type: "renewed",
    serviceId: 105,
    agoMin: 5 * 24 * 60,
    isRead: true,
    title: (s) => `${s.domain} renewed until ${formatDatePK(s.renewalDate)}`,
  },
  {
    id: "n7",
    type: "expired",
    serviceId: 112,
    agoMin: 3 * 24 * 60,
    isRead: true,
    title: (s) => `${s.domain} expired 6 days ago`,
  },
  {
    id: "n8",
    type: "expiring",
    serviceId: 102,
    agoMin: 13 * 24 * 60,
    isRead: true,
    title: (s) => `${s.domain} expires in 30 days`,
  },
]

export interface PaymentSeed {
  id: number
  serviceId: number
  method: string
  reference: string | null
  /** Days before the start of the paid period that it was paid. */
  paidEarly: number
}

export const PAYMENTS: PaymentSeed[] = [
  {
    id: 1,
    serviceId: 105,
    method: "Bank transfer",
    reference: "MZN-2026-0924-7781",
    paidEarly: 0,
  },
  {
    id: 2,
    serviceId: 113,
    method: "Bank transfer",
    reference: "HBL-FT-55120934",
    paidEarly: 3,
  },
  {
    id: 3,
    serviceId: 106,
    method: "Bank transfer",
    reference: "MCB-IBFT-88213",
    paidEarly: 9,
  },
  {
    id: 4,
    serviceId: 107,
    method: "Bank transfer",
    reference: "Wise 4471-2291",
    paidEarly: 6,
  },
  { id: 5, serviceId: 102, method: "JazzCash", reference: "JC 8812345601", paidEarly: 2 },
  { id: 6, serviceId: 101, method: "JazzCash", reference: "JC 7734102290", paidEarly: 1 },
  { id: 7, serviceId: 108, method: "Easypaisa", reference: "EP 30091877", paidEarly: 4 },
  { id: 8, serviceId: 109, method: "Cash", reference: null, paidEarly: 0 },
  { id: 9, serviceId: 111, method: "Easypaisa", reference: "EP 29910452", paidEarly: 5 },
  { id: 10, serviceId: 103, method: "Cash", reference: null, paidEarly: -2 },
]
