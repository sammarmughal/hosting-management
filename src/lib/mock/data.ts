// Phase 1 mock data (docs/06 §7.2). Every date is relative to today in
// Pakistan, so each colour always appears: 3 green, 4 orange, 3 red,
// 2 expired, 1 cancelled. Two clients have two services each.
// Removed in Phase 9 (docs/09).
import {
  addDays,
  daysLeft,
  formatDatePK,
  todayPK,
  type ISODate,
} from "@/lib/domain/dates"
import { DEFAULT_TEMPLATES } from "@/lib/domain/default-templates"
import { formatAmount, formatMoney } from "@/lib/domain/money"
import { DEFAULT_STAGES, dueStage, parseStages } from "@/lib/domain/stages"
import { DEFAULT_THRESHOLDS, serviceColour } from "@/lib/domain/status"
import { daysText, renderForDays, renderTemplate } from "@/lib/domain/templates"
import { buildWaLink, normalisePhone } from "@/lib/domain/whatsapp"
import type {
  ClientDetail,
  NotificationItem,
  PaymentRow,
  ReminderRow,
  ServiceRow,
} from "@/types/view"

export const MOCK_SETTINGS = {
  businessName: "Rehman Web Services",
  businessPhone: "+92 300 1112233",
  adminName: "Rehman",
  adminEmail: "billing@rehmanweb.pk",
  adminWhatsapp: "923001112233",
  defaultCurrency: "PKR",
  thresholds: DEFAULT_THRESHOLDS,
  stages: parseStages(DEFAULT_STAGES),
  checkIntervalMinutes: 60,
}

/* Seeds ------------------------------------------------------------- */

interface ServiceSeed {
  id: number
  domain: string
  plan: string
  /** Days left, relative to today. */
  days: number
  amount: string
  currency?: string
  status?: "active" | "cancelled"
  remindersEnabled?: boolean
}

interface ClientSeed {
  id: number
  name: string
  company: string | null
  email: string | null
  phone: string | null
  notes: string | null
  services: ServiceSeed[]
}

const CLIENTS: ClientSeed[] = [
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

interface ReminderSeed {
  id: string
  serviceId: number
  channel: "email" | "whatsapp"
  status: ReminderRow["status"]
  /** Minutes before now that it was sent or opened. */
  agoMin?: number
  error?: string
}

const REMINDERS: ReminderSeed[] = [
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

interface NotificationSeed {
  id: string
  type: "reminder_due" | "email_failed" | "renewed"
  serviceId: number
  agoMin: number
  isRead: boolean
  /** Built from the service at build time. */
  title: (s: ServiceRow) => string
}

const due = (s: ServiceRow) =>
  s.daysLeft > 0
    ? `${s.domain} expires in ${s.daysLeft} days`
    : s.daysLeft === 0
      ? `${s.domain} expires today`
      : `${s.domain} expired ${-s.daysLeft} days ago`

const NOTIFICATIONS: NotificationSeed[] = [
  {
    id: "n1",
    type: "reminder_due",
    serviceId: 101,
    agoMin: 26 * 60,
    isRead: false,
    title: (s) => `${s.domain} expires in 3 days`,
  },
  {
    id: "n2",
    type: "reminder_due",
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
    type: "reminder_due",
    serviceId: 109,
    agoMin: 4 * 60,
    isRead: false,
    title: due,
  },
  {
    id: "n5",
    type: "reminder_due",
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
    type: "reminder_due",
    serviceId: 112,
    agoMin: 3 * 24 * 60,
    isRead: true,
    title: (s) => `${s.domain} expired 6 days ago`,
  },
  {
    id: "n8",
    type: "reminder_due",
    serviceId: 102,
    agoMin: 13 * 24 * 60,
    isRead: true,
    title: (s) => `${s.domain} expires in 30 days`,
  },
]

interface PaymentSeed {
  id: number
  serviceId: number
  method: string
  reference: string | null
  /** Days before the start of the paid period that it was paid. */
  paidEarly: number
}

const PAYMENTS: PaymentSeed[] = [
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

/* Build ------------------------------------------------------------- */

/** The start of the current yearly cycle. 29 Feb → 28 Feb when needed. */
function minusOneYear(d: ISODate): ISODate {
  const [y = "", m = "", day = ""] = d.split("-")
  const py = Number(y) - 1
  const leap = (py % 4 === 0 && py % 100 !== 0) || py % 400 === 0
  return `${py}-${m}-${m === "02" && day === "29" && !leap ? "28" : day}`
}

export interface MockData {
  today: ISODate
  clients: ClientDetail[]
  services: ServiceRow[]
  reminders: ReminderRow[]
  notifications: NotificationItem[]
  payments: PaymentRow[]
  lastCheckAt: string
}

export function buildMockData(now: Date): MockData {
  const today = todayPK(now)
  const minutesAgo = (min: number) => new Date(now.getTime() - min * 60_000).toISOString()
  const t = MOCK_SETTINGS.thresholds

  const services: ServiceRow[] = []
  const clients: ClientDetail[] = CLIENTS.map((c) => {
    const phone = normalisePhone(c.phone)
    const rows = c.services.map((s): ServiceRow => {
      const renewalDate = addDays(today, s.days)
      const status = s.status ?? "active"
      const left = daysLeft(renewalDate, today)
      const row: ServiceRow = {
        id: s.id,
        clientId: c.id,
        clientName: c.name,
        company: c.company,
        email: c.email,
        phone,
        domain: s.domain,
        planLabel: s.plan,
        startDate: minusOneYear(renewalDate),
        renewalDate,
        chargeAmount: s.amount,
        currency: s.currency ?? MOCK_SETTINGS.defaultCurrency,
        status,
        remindersEnabled: s.remindersEnabled ?? true,
        daysLeft: left,
        colour: serviceColour(left, status, t),
      }
      // Built on the server, like the real view model (docs/07 §2).
      row.waLink = phone ? buildWaLink(phone, clientWhatsappText(row)) : null
      return row
    })
    services.push(...rows)
    return {
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
      phone,
      notes: c.notes,
      services: rows,
    }
  })

  const byId = new Map(services.map((s) => [s.id, s]))
  const service = (id: number) => {
    const s = byId.get(id)
    if (!s) throw new Error(`Mock data: unknown service ${id}`)
    return s
  }

  const reminders: ReminderRow[] = REMINDERS.map((r) => {
    const s = service(r.serviceId)
    const stage = dueStage(s.daysLeft, MOCK_SETTINGS.stages) ?? s.daysLeft
    return {
      id: r.id,
      serviceId: s.id,
      stage,
      channel: r.channel,
      recipient: "client",
      status: r.status,
      lastError: r.error ?? null,
      sentAt: r.agoMin !== undefined ? minutesAgo(r.agoMin) : null,
      waLink: r.channel === "whatsapp" ? (s.waLink ?? null) : null,
      service: s,
    }
  })

  const notifications: NotificationItem[] = NOTIFICATIONS.map((n) => {
    const s = service(n.serviceId)
    return {
      id: n.id,
      type: n.type,
      title: n.title(s),
      createdAt: minutesAgo(n.agoMin),
      isRead: n.isRead,
      href: `/clients/${s.clientId}`,
    }
  })

  const payments: PaymentRow[] = PAYMENTS.map((p) => {
    const s = service(p.serviceId)
    const periodFrom = minusOneYear(s.renewalDate)
    return {
      id: p.id,
      serviceId: s.id,
      domain: s.domain,
      clientName: s.clientName,
      amount: s.chargeAmount,
      currency: s.currency,
      paidOn: addDays(periodFrom, -p.paidEarly),
      method: p.method,
      reference: p.reference,
      periodFrom,
      periodTo: s.renewalDate,
    }
  }).sort((a, b) => b.paidOn.localeCompare(a.paidOn))

  return {
    today,
    clients,
    services,
    reminders,
    notifications,
    payments,
    lastCheckAt: minutesAgo(10),
  }
}

const SUMMARY_DOT: Record<ServiceRow["colour"], string> = {
  red: "🔴",
  orange: "🟠",
  expired: "⚫",
  green: "🟢",
  cancelled: "⚪",
}

/** The admin WhatsApp summary (docs/08 §5.2), most urgent first. */
export function adminSummaryText(services: ServiceRow[], today: ISODate): string {
  const sorted = [...services].sort((a, b) => a.daysLeft - b.daysLeft)
  const list = sorted
    .map((s) => {
      const when =
        s.daysLeft < 0
          ? `expired ${-s.daysLeft} days ago`
          : s.daysLeft === 0
            ? "today"
            : `${s.daysLeft} days`
      return `${SUMMARY_DOT[s.colour]} ${s.domain} – ${s.clientName} – ${when} – ${formatMoney(s.chargeAmount, s.currency)}`
    })
    .join("\n")
  return renderTemplate(
    DEFAULT_TEMPLATES.admin_whatsapp.body,
    { today: formatDatePK(today), count: sorted.length, summary_list: list },
    { mode: "text" }
  )
}

/** The client WhatsApp message for a service, from the default template. */
export function clientWhatsappText(s: ServiceRow): string {
  return renderForDays(
    DEFAULT_TEMPLATES.client_whatsapp.body,
    s.daysLeft,
    {
      client_name: s.clientName,
      company: s.company,
      domain: s.domain,
      renewal_date: formatDatePK(s.renewalDate),
      days_left: Math.abs(s.daysLeft),
      days_text: daysText(s.daysLeft),
      amount: formatAmount(s.chargeAmount),
      currency: s.currency,
      business_name: MOCK_SETTINGS.businessName,
      business_phone: MOCK_SETTINGS.businessPhone,
    },
    { mode: "text" }
  )
}
