"use client"

import * as React from "react"
import {
  BanIcon,
  CircleCheckIcon,
  CircleXIcon,
  FileTextIcon,
  MailIcon,
  MessageCircleIcon,
  ServerIcon,
  type LucideIcon,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { InvoicesTable } from "@/components/invoices/invoices-table"
import { PaymentsTable } from "@/components/payments-table"
import { ReminderLogTable } from "@/components/reminder-log-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDatePK, todayPK } from "@/lib/domain/dates"
import { formatDateTimePK } from "@/lib/domain/relative-time"
import type { ClientTab } from "@/lib/client-tabs"
import { cn } from "@/lib/utils"
import type { ActivityItem, InvoiceRow, PaymentRow, ReminderRow } from "@/types/view"

/**
 * Overview | Companies | Subscriptions | Invoices | Payments (docs/14 §7).
 * The tab lives in ?tab=. The server renders the overview summary and the
 * company and subscription panels; the rest is built here.
 */
export function ClientTabs({
  initialTab,
  overview,
  companies,
  subscriptions,
  companyCount,
  subscriptionCount,
  payments,
  invoices,
  reminders,
  activity,
  multipleSubscriptions,
}: {
  initialTab: ClientTab
  overview: React.ReactNode
  companies: React.ReactNode
  subscriptions: React.ReactNode
  companyCount: number
  subscriptionCount: number
  payments: PaymentRow[]
  invoices: InvoiceRow[]
  reminders: ReminderRow[]
  activity: ActivityItem[]
  multipleSubscriptions: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = React.useState<ClientTab>(initialTab)

  function change(value: string) {
    const next = value as ClientTab
    setTab(next)
    router.replace(next === "overview" ? pathname : `${pathname}?tab=${next}`, {
      scroll: false,
    })
  }

  return (
    <Tabs value={tab} onValueChange={change} className="gap-0">
      <div className="scrollbar-none overflow-x-auto border-b border-border">
        <TabsList variant="line" className="h-12">
          <TabsTrigger value="overview" className="px-2">
            Overview
          </TabsTrigger>
          <TabsTrigger value="companies" className="px-2">
            Companies <Count n={companyCount} />
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="px-2">
            Subscriptions <Count n={subscriptionCount} />
          </TabsTrigger>
          <TabsTrigger value="invoices" className="px-2">
            Invoices <Count n={invoices.length} />
          </TabsTrigger>
          <TabsTrigger value="payments" className="px-2">
            Payments <Count n={payments.length} />
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="flex flex-col gap-6 pt-4">
        {overview}
        <section aria-labelledby="log-title" className="flex flex-col gap-3">
          <h2 id="log-title" className="text-base font-semibold">
            Reminder log <Count n={reminders.length} />
          </h2>
          <Panel
            empty={reminders.length === 0}
            emptyText="No reminders yet for this client."
          >
            <ReminderLogTable rows={reminders} showDomain={multipleSubscriptions} />
          </Panel>
        </section>
        <section aria-labelledby="activity-title" className="flex flex-col gap-3">
          <h2 id="activity-title" className="text-base font-semibold">
            Activity
          </h2>
          <Panel empty={activity.length === 0} emptyText="No activity yet.">
            <Timeline items={activity} />
          </Panel>
        </section>
      </TabsContent>
      <TabsContent value="companies" className="pt-4">
        {companies}
      </TabsContent>
      <TabsContent value="subscriptions" className="pt-4">
        {subscriptions}
      </TabsContent>
      <TabsContent value="invoices" className="pt-4">
        <Panel
          empty={invoices.length === 0}
          emptyText="No invoices yet. They’re created before each renewal, or with Create invoice now on a subscription."
        >
          <InvoicesTable rows={invoices} showClient={false} />
        </Panel>
      </TabsContent>
      <TabsContent value="payments" className="pt-4">
        <Panel
          empty={payments.length === 0}
          emptyText="No payments recorded yet. Use Record renewal when a client pays."
        >
          <PaymentsTable rows={payments} showDomain={multipleSubscriptions} />
        </Panel>
      </TabsContent>
    </Tabs>
  )
}
function Count({ n }: { n: number }) {
  return <span className="text-ink-subtle tabular-nums">{n}</span>
}

function Panel({
  empty,
  emptyText,
  children,
}: {
  empty: boolean
  emptyText: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {empty ? (
        <p className="px-4 py-8 text-sm text-ink-muted sm:px-5">{emptyText}</p>
      ) : (
        children
      )}
    </div>
  )
}

/* Activity ------------------------------------------------------------ */

const ACTIVITY_ICON: Record<
  ActivityItem["kind"],
  { icon: LucideIcon; className: string }
> = {
  subscription: { icon: ServerIcon, className: "text-ink-muted" },
  payment: { icon: CircleCheckIcon, className: "text-green-fg" },
  email: { icon: MailIcon, className: "text-ink-muted" },
  whatsapp: { icon: MessageCircleIcon, className: "text-ink-muted" },
  failed: { icon: CircleXIcon, className: "text-red-fg" },
  skipped: { icon: BanIcon, className: "text-ink-subtle" },
  invoice: { icon: FileTextIcon, className: "text-ink-muted" },
}

/** Subscriptions and payments have a date only; reminders have a time. */
function activityWhen(item: ActivityItem) {
  return item.kind === "subscription" || item.kind === "payment"
    ? formatDatePK(todayPK(new Date(item.at)))
    : formatDateTimePK(item.at)
}

function Timeline({ items }: { items: ActivityItem[] }) {
  return (
    <ol className="px-4 py-2 sm:px-5">
      {items.map((item, i) => {
        const { icon: Icon, className } = ACTIVITY_ICON[item.kind]
        return (
          <li key={item.id} className="relative flex gap-3 py-3">
            {i < items.length - 1 && (
              <span
                aria-hidden
                className="absolute top-8 bottom-0 left-3.5 w-px bg-border"
              />
            )}
            <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
              <Icon aria-hidden className={cn("size-4", className)} />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-base text-ink">{item.text}</p>
              <time dateTime={item.at} className="text-xs text-ink-muted">
                {activityWhen(item)}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
