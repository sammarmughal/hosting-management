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

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDatePK, todayPK } from "@/lib/domain/dates"
import { formatMoney } from "@/lib/domain/money"
import { formatDateTimePK } from "@/lib/domain/relative-time"
import { stageLabel } from "@/lib/domain/stages"
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
        <TabsList variant="line" className="h-10">
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
          <ReminderLog rows={reminders} showDomain={multipleServices} />
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

/* Payments ------------------------------------------------------------ */

function PaymentsTable({
  rows,
  showDomain,
}: {
  rows: PaymentRow[]
  showDomain: boolean
}) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paid on</TableHead>
              {showDomain && <TableHead>Service</TableHead>}
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-full">Method</TableHead>
              <TableHead>Period</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{formatDatePK(p.paidOn)}</TableCell>
                {showDomain && (
                  <TableCell>
                    <div className="truncate" title={p.domain}>
                      {p.domain}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  {formatMoney(p.amount, p.currency)}
                </TableCell>
                {/* Method with the reference below (two-line cell, docs/12 §5) */}
                <TableCell>
                  <div>{p.method}</div>
                  {p.reference && (
                    <div
                      className="max-w-48 truncate text-xs text-ink-muted"
                      title={p.reference}
                    >
                      {p.reference}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-ink-muted">
                  {formatDatePK(p.periodFrom)} → {formatDatePK(p.periodTo)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {rows.map((p) => (
          <li key={p.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{formatMoney(p.amount, p.currency)}</span>
              <span className="text-sm text-ink-muted">{formatDatePK(p.paidOn)}</span>
            </div>
            <div className="mt-0.5 text-sm text-ink-muted">
              {p.method}
              {p.reference ? ` · ${p.reference}` : ""}
            </div>
            <div className="mt-0.5 truncate text-sm text-ink-muted">
              {showDomain ? `${p.domain} · ` : ""}
              {formatDatePK(p.periodFrom)} → {formatDatePK(p.periodTo)}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/* Reminder log -------------------------------------------------------- */

const REMINDER_BADGE: Record<
  ReminderRow["status"],
  { label: string; variant: "neutral" | "brand" | "green" | "red" }
> = {
  pending: { label: "Pending", variant: "neutral" },
  opened: { label: "Opened", variant: "brand" },
  sent: { label: "Sent", variant: "green" },
  failed: { label: "Failed", variant: "red" },
  skipped: { label: "Skipped", variant: "neutral" },
}

function ReminderStatus({ status }: { status: ReminderRow["status"] }) {
  const b = REMINDER_BADGE[status]
  return <Badge variant={b.variant}>{b.label}</Badge>
}

const when = (r: ReminderRow) => (r.sentAt ? formatDateTimePK(r.sentAt) : "Not sent yet")

function ReminderLog({ rows, showDomain }: { rows: ReminderRow[]; showDomain: boolean }) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {showDomain && <TableHead>Service</TableHead>}
              <TableHead>Stage</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-full">Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className={cn(!r.sentAt && "text-ink-muted")}>
                  {when(r)}
                </TableCell>
                {showDomain && (
                  <TableCell>
                    <div className="truncate" title={r.service.domain}>
                      {r.service.domain}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-ink-muted">{stageLabel(r.stage)}</TableCell>
                <TableCell>{r.channel === "email" ? "Email" : "WhatsApp"}</TableCell>
                <TableCell className="text-ink-muted">
                  {r.recipient === "client" ? "Client" : "You"}
                </TableCell>
                <TableCell>
                  <ReminderStatus status={r.status} />
                </TableCell>
                <TableCell>
                  <div
                    className="max-w-72 truncate text-sm text-red-fg"
                    title={r.lastError ?? undefined}
                  >
                    {r.lastError ?? ""}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">
                {r.channel === "email" ? "Email" : "WhatsApp"} ·{" "}
                <span className="font-normal text-ink-muted">{stageLabel(r.stage)}</span>
              </span>
              <ReminderStatus status={r.status} />
            </div>
            <div className="mt-0.5 text-sm text-ink-muted">
              {showDomain ? `${r.service.domain} · ` : ""}
              {when(r)}
            </div>
            {r.lastError && <p className="mt-1 text-xs text-red-fg">{r.lastError}</p>}
          </li>
        ))}
      </ul>
    </>
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
          <li key={item.id} className="relative flex gap-3 py-2.5">
            {i < items.length - 1 && (
              <span
                aria-hidden
                className="absolute top-8 bottom-0 left-3.5 w-px bg-border"
              />
            )}
            <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
              <Icon aria-hidden className={cn("size-3.5", className)} />
            </span>
            <div className="min-w-0 pt-0.5">
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
