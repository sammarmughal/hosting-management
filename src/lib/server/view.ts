import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { daysLeft, type ISODate } from "@/lib/domain/dates"
import { displayStatus } from "@/lib/domain/invoices"
import {
  clientWhatsappText,
  type MessageBusiness,
  type MessageInvoice,
  type Template,
} from "@/lib/domain/messages"
import { publicInvoiceUrl } from "@/lib/server/invoices"
import { MONEY_SCALE } from "@/lib/domain/money"
import { subscriptionColour } from "@/lib/domain/status"
import { linkProvider } from "@/lib/domain/whatsapp"
import { today as clockToday } from "@/lib/server/clock"
import { fromDbDate } from "@/lib/server/db-dates"
import { getAppSettings, getTemplate } from "@/lib/server/settings"
import type { ReminderRow, SubscriptionRow } from "@/types/view"

// Prisma rows → the view models in src/types/view.ts (docs/06 §7.1), so the
// components are the same as in the Phase 1 mock UI.

export const subscriptionInclude = {
  client: true,
  company: { select: { id: true, name: true } },
  serviceType: { select: { name: true } },
  // The current cycle's invoice is picked from these in toSubscriptionRow.
  invoices: {
    where: { status: { not: "void" } },
    orderBy: { periodStart: "desc" },
    take: 2,
    select: {
      id: true,
      number: true,
      status: true,
      periodStart: true,
      dueDate: true,
      total: true,
      currency: true,
      publicToken: true,
    },
  },
} satisfies Prisma.SubscriptionInclude
export type SubscriptionWithClient = Prisma.SubscriptionGetPayload<{
  include: typeof subscriptionInclude
}>

export interface ViewContext {
  today: ISODate
  thresholds: { orange: number; red: number }
  business: MessageBusiness
  whatsappTemplate: Template
}

/** Settings, today and the WhatsApp template, once per request. */
export async function viewContext(): Promise<ViewContext> {
  const [s, whatsappTemplate] = await Promise.all([
    getAppSettings(),
    getTemplate("client_whatsapp"),
  ])
  return {
    today: clockToday(),
    thresholds: s.thresholds,
    business: {
      businessName: s.businessName,
      businessPhone: s.businessPhone,
      businessTagline: s.businessTagline,
    },
    whatsappTemplate,
  }
}

export function toSubscriptionRow(
  s: SubscriptionWithClient,
  ctx: ViewContext
): SubscriptionRow {
  const renewalDate = fromDbDate(s.renewalDate)
  const left = daysLeft(renewalDate, ctx.today)
  const row: SubscriptionRow = {
    id: s.id,
    clientId: s.clientId,
    clientName: s.client.name,
    companyId: s.companyId,
    company: s.company?.name ?? null,
    serviceTypeId: s.serviceTypeId,
    serviceName: s.serviceType.name,
    email: s.client.email,
    phone: s.client.phone,
    address: s.client.address,
    clientCurrency: s.client.currency,
    domain: s.domain,
    planLabel: s.planLabel,
    startDate: fromDbDate(s.startDate),
    renewalDate,
    chargeAmount: s.chargeAmount.toFixed(MONEY_SCALE),
    currency: s.currency,
    status: s.status,
    remindersEnabled: s.remindersEnabled,
    daysLeft: left,
    colour: subscriptionColour(left, s.status, ctx.thresholds),
    notes: s.notes,
  }
  const inv = s.invoices.find((i) => i.periodStart.getTime() === s.renewalDate.getTime())
  const invoice = inv ? messageInvoice(inv) : null
  row.invoice = inv
    ? {
        id: inv.id,
        number: inv.number,
        status: displayStatus(inv.status, fromDbDate(inv.dueDate), ctx.today),
        total: inv.total.toFixed(MONEY_SCALE),
        currency: inv.currency,
      }
    : null
  // Built on the server before any click (docs/07 §2), with the invoice link
  // when the cycle has an invoice (docs/13 §10).
  row.waLink =
    linkProvider.prepare({
      to: s.client.phone,
      text: clientWhatsappText(
        ctx.whatsappTemplate,
        row,
        ctx.business,
        ctx.today,
        invoice
      ),
    })?.url ?? null
  return row
}

type InvoiceLink = SubscriptionWithClient["invoices"][number]

/** The cycle's invoice for message placeholders. */
export function messageInvoice(inv: InvoiceLink): MessageInvoice {
  return {
    number: inv.number,
    link: publicInvoiceUrl(inv.publicToken),
    total: inv.total.toFixed(MONEY_SCALE),
    currency: inv.currency,
    dueDate: fromDbDate(inv.dueDate),
  }
}

type ReminderRecord = Prisma.ReminderGetPayload<object>

export function toReminderRow(
  r: ReminderRecord,
  subscription: SubscriptionRow
): ReminderRow {
  return {
    id: r.id.toString(),
    subscriptionId: r.subscriptionId,
    stage: r.stage,
    channel: r.channel,
    recipient: r.recipient,
    status: r.status,
    lastError: r.lastError,
    sentAt: r.sentAt?.toISOString() ?? null,
    waLink: r.channel === "whatsapp" ? (subscription.waLink ?? null) : null,
    subscription,
  }
}
