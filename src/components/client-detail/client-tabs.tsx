"use client"

import * as React from "react"
import {
  BanIcon,
  CircleCheckIcon,
  CircleXIcon,
  MailIcon,
  MessageCircleIcon,
  ServerIcon,
  type LucideIcon,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { PaymentsTable } from "@/components/payments-table"
import { ReminderLogTable } from "@/components/reminder-log-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDatePK, todayPK } from "@/lib/domain/dates"
import { formatDateTimePK } from "@/lib/domain/relative-time"
import { cn } from "@/lib/utils"
import type { ActivityItem, PaymentRow, ReminderRow } from "@/types/view"

export type ClientTab = "payments" | "log" | "activity"

/** Payments | Reminder log | Activity (docs/06 §4.7). The tab lives in ?tab=. */
export function ClientTabs({
  initialTab,
  payments,
  reminders,
  activity,
  multipleServices,
}: {
  initialTab: ClientTab
  payments: PaymentRow[]
  reminders: ReminderRow[]
  activity: ActivityItem[]
  multipleServices: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = React.useState<ClientTab>(initialTab)

  function change(value: string) {
    const next = value as ClientTab
    setTab(next)
    router.replace(next === "payments" ? pathname : `${pathname}?tab=${next}`, {
      scroll: false,
    })
  }

  return (
    <Tabs value={tab} onValueChange={change} className="gap-0">
      <div className="scrollbar-none overflow-x-auto border-b border-border">
        <TabsList variant="line" className="h-12">
          <TabsTrigger value="payments" className="px-2">
            Payments <Count n={payments.length} />
          </TabsTrigger>
          <TabsTrigger value="log" className="px-2">
            Reminder log <Count n={reminders.length} />
          </TabsTrigger>
          <TabsTrigger value="activity" className="px-2">
            Activity
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="payments" className="pt-4">
        <Panel
          empty={payments.length === 0}
          emptyText="No payments recorded yet. Use Renew / Mark paid when a client pays."
        >
          <PaymentsTable rows={payments} showDomain={multipleServices} />
        </Panel>
      </TabsContent>
      <TabsContent value="log" className="pt-4">
        <Panel
          empty={reminders.length === 0}
          emptyText="No reminders yet for this client."
        >
          <ReminderLogTable rows={reminders} showDomain={multipleServices} />
        </Panel>
      </TabsContent>
      <TabsContent value="activity" className="pt-4">
        <Panel empty={activity.length === 0} emptyText="No activity yet.">
          <Timeline items={activity} />
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
  service: { icon: ServerIcon, className: "text-ink-muted" },
  payment: { icon: CircleCheckIcon, className: "text-green-fg" },
  email: { icon: MailIcon, className: "text-ink-muted" },
  whatsapp: { icon: MessageCircleIcon, className: "text-ink-muted" },
  failed: { icon: CircleXIcon, className: "text-red-fg" },
  skipped: { icon: BanIcon, className: "text-ink-subtle" },
}

/** Services and payments have a date only; reminders have a time. */
function activityWhen(item: ActivityItem) {
  return item.kind === "service" || item.kind === "payment"
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
