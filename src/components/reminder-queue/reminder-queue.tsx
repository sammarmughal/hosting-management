"use client"

import * as React from "react"
import {
  CalendarCheck2Icon,
  CheckIcon,
  CircleAlertIcon,
  Loader2Icon,
  MessageCircleIcon,
  SendIcon,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { EmptyState } from "@/components/empty-state"
import { AdminSummaryMenu } from "@/components/reminder-queue/admin-summary-menu"
import {
  SendEmailsDialog,
  type EmailRecipient,
} from "@/components/reminder-queue/send-emails-dialog"
import { RenewDialog } from "@/components/renew-dialog"
import { TimerPill } from "@/components/timer-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDatePK } from "@/lib/domain/dates"
import { formatMoney } from "@/lib/domain/money"
import { formatDateTimePK, formatSentAt } from "@/lib/domain/relative-time"
import { stageLabel } from "@/lib/domain/stages"
import {
  markOpenedAction,
  markSentAction,
  sendReminderEmailAction,
  skipReminderAction,
} from "@/lib/mock/actions"
import { cn } from "@/lib/utils"
import type { Colour, QueueItem, ReminderRow } from "@/types/view"

const BAR: Record<Colour, string> = {
  green: "bg-green",
  orange: "bg-orange",
  red: "bg-red",
  expired: "bg-expired",
  cancelled: "bg-cancelled",
}

const OPEN: ReminderRow["status"][] = ["pending", "failed"]
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * The reminder queue (docs/06 §4.4): one row per service with its email and
 * WhatsApp state, Send all emails, admin summary, Skip (with Undo) and Renew.
 * Rows are updated locally as actions complete.
 */
export function ReminderQueue({
  initialItems,
  adminEmail,
  adminSummaryWaLink,
}: {
  initialItems: QueueItem[]
  adminEmail: string
  adminSummaryWaLink: string | null
}) {
  const [items, setItems] = React.useState(initialItems)
  const [sending, setSending] = React.useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = React.useState<ReadonlySet<string>>(new Set())
  const [sendOpen, setSendOpen] = React.useState(false)
  const [renewing, setRenewing] = React.useState<QueueItem | null>(null)
  const [renewOpen, setRenewOpen] = React.useState(false)

  const toggle = (set: ReadonlySet<string>, id: string, on: boolean) => {
    const next = new Set(set)
    if (on) next.add(id)
    else next.delete(id)
    return next
  }

  const patchRow = React.useCallback((id: string, patch: Partial<ReminderRow>) => {
    setItems((prev) =>
      prev.map((q) =>
        q.email?.id === id
          ? { ...q, email: { ...q.email, ...patch } }
          : q.whatsapp?.id === id
            ? { ...q, whatsapp: { ...q.whatsapp, ...patch } }
            : q
      )
    )
  }, [])

  const recipients: EmailRecipient[] = items.flatMap((q) =>
    q.email && q.service.email && OPEN.includes(q.email.status)
      ? [
          {
            id: q.email.id,
            name: q.service.clientName,
            email: q.service.email,
            domain: q.service.domain,
          },
        ]
      : []
  )

  async function retryEmail(item: QueueItem) {
    const row = item.email
    if (!row) return
    setSending((s) => toggle(s, row.id, true))
    const res = await sendReminderEmailAction(row.id)
    setSending((s) => toggle(s, row.id, false))
    if (res.ok && res.data) {
      patchRow(row.id, { status: "sent", sentAt: res.data.sentAt, lastError: null })
      toast.success(`Email sent to ${item.service.clientName}`)
    } else {
      const error = res.ok ? "Email failed" : res.error
      patchRow(row.id, { status: "failed", lastError: error })
      toast.error(`Couldn't email ${item.service.clientName}`, { description: error })
    }
  }

  function openedWhatsApp(row: ReminderRow) {
    // Optimistic: the link opens in a new tab right away.
    patchRow(row.id, { status: "opened", sentAt: new Date().toISOString() })
    void markOpenedAction(row.id).then((res) => {
      if (!res.ok) toast.error(res.error)
    })
  }

  async function markSent(row: ReminderRow) {
    setBusy((s) => toggle(s, row.id, true))
    const res = await markSentAction(row.id)
    setBusy((s) => toggle(s, row.id, false))
    if (res.ok) patchRow(row.id, { status: "sent", sentAt: new Date().toISOString() })
    else toast.error(res.error)
  }

  function skip(item: QueueItem) {
    const ids = [item.email, item.whatsapp]
      .filter((r): r is ReminderRow => !!r && r.status !== "sent")
      .map((r) => r.id)
    setItems((prev) => prev.filter((q) => q.service.id !== item.service.id))

    // Commit only if the toast closes without Undo, so Undo needs no extra action.
    let settled = false
    const commit = () => {
      if (settled) return
      settled = true
      void Promise.all(ids.map((id) => skipReminderAction(id))).then((results) => {
        if (results.some((r) => !r.ok))
          toast.error("Couldn't skip the reminder. Try again.")
      })
    }
    toast(`Reminder skipped for ${item.service.domain}`, {
      action: {
        label: "Undo",
        onClick: () => {
          settled = true
          setItems((prev) =>
            [...prev, item].sort(
              (a, b) =>
                a.service.daysLeft - b.service.daysLeft || a.service.id - b.service.id
            )
          )
        },
      },
      onAutoClose: commit,
      onDismiss: commit,
    })
  }

  const count = items.length

  return (
    <section
      aria-labelledby="queue-title"
      className="overflow-hidden rounded-lg border border-border bg-surface"
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <h2 id="queue-title" className="flex items-center gap-2 text-base font-semibold">
          Reminders due
          <Badge size="sm" aria-label={`${count} services`}>
            {count}
          </Badge>
        </h2>
        <div className="flex gap-2">
          {recipients.length > 0 ? (
            <Button
              className="flex-1 max-sm:h-11 sm:flex-none"
              onClick={() => setSendOpen(true)}
            >
              <SendIcon />
              Send {plural(recipients.length, "email")}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex flex-1 rounded-md sm:flex-none">
                  <Button disabled className="w-full max-sm:h-11">
                    <SendIcon />
                    Send emails
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>No emails waiting to be sent</TooltipContent>
            </Tooltip>
          )}
          <AdminSummaryMenu
            adminEmail={adminEmail}
            waLink={adminSummaryWaLink}
            disabled={count === 0}
            className="flex-1 max-sm:h-11 sm:flex-none"
          />
        </div>
      </div>

      {count === 0 ? (
        <EmptyState
          icon={CalendarCheck2Icon}
          message="All caught up. No reminders due."
        />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <QueueRow
              key={item.service.id}
              item={item}
              emailSending={!!item.email && sending.has(item.email.id)}
              busyIds={busy}
              onRetryEmail={() => void retryEmail(item)}
              onOpenedWhatsApp={openedWhatsApp}
              onMarkSent={(row) => void markSent(row)}
              onSkip={() => skip(item)}
              onRenew={() => {
                setRenewing(item)
                setRenewOpen(true)
              }}
            />
          ))}
        </ul>
      )}

      <SendEmailsDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        recipients={recipients}
        adminEmail={adminEmail}
        onSending={(id, on) => setSending((s) => toggle(s, id, on))}
        onResult={(id, r) =>
          patchRow(
            id,
            r.status === "sent"
              ? { status: "sent", sentAt: r.sentAt, lastError: null }
              : { status: "failed", lastError: r.error }
          )
        }
      />

      <RenewDialog
        service={renewing?.service ?? null}
        open={renewOpen}
        onOpenChange={setRenewOpen}
        onRenewed={(serviceId) =>
          // A renewed service leaves the queue (its reminders are skipped, docs/04 §6).
          setItems((prev) => prev.filter((q) => q.service.id !== serviceId))
        }
      />
    </section>
  )
}

/* Row --------------------------------------------------------------- */

function QueueRow({
  item,
  emailSending,
  busyIds,
  onRetryEmail,
  onOpenedWhatsApp,
  onMarkSent,
  onSkip,
  onRenew,
}: {
  item: QueueItem
  emailSending: boolean
  busyIds: ReadonlySet<string>
  onRetryEmail: () => void
  onOpenedWhatsApp: (row: ReminderRow) => void
  onMarkSent: (row: ReminderRow) => void
  onSkip: () => void
  onRenew: () => void
}) {
  const s = item.service

  return (
    <li className="relative">
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-0.75", BAR[s.colour])}
      />
      <div className="flex flex-col gap-3 py-4 pr-4 pl-4.75 sm:pr-5 sm:pl-5.75">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0">
            <p className="truncate text-base">
              <Link
                href={`/clients/${s.clientId}`}
                className="font-medium text-ink outline-none hover:underline focus-visible:underline"
              >
                {s.domain}
              </Link>
              <span className="text-ink-muted"> · {s.clientName}</span>
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">
              Stage: {stageLabel(item.stage)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:shrink-0 lg:flex-nowrap">
            <TimerPill renewalDate={s.renewalDate} />
            {/* Date and amount stay together so rows wrap the same way on mobile */}
            <span className="flex items-center gap-4">
              <span className="text-sm text-ink-muted lg:w-24 lg:text-right">
                {formatDatePK(s.renewalDate)}
              </span>
              <span className="font-mono text-sm text-ink lg:w-28 lg:text-right">
                {formatMoney(s.chargeAmount, s.currency)}
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-x-8">
          <Channel label="Email">
            <EmailState item={item} sending={emailSending} onRetry={onRetryEmail} />
          </Channel>
          <Channel label="WhatsApp">
            <WhatsAppState
              item={item}
              busy={!!item.whatsapp && busyIds.has(item.whatsapp.id)}
              onOpened={onOpenedWhatsApp}
              onMarkSent={onMarkSent}
            />
          </Channel>
          <div className="flex gap-2 md:ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-ink-muted max-md:h-11 md:flex-none"
              onClick={onSkip}
            >
              Skip
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 max-md:h-11 md:flex-none"
              onClick={onRenew}
            >
              Renew
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}

function Channel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <span className="w-18 shrink-0 text-sm text-ink-muted md:w-auto">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function Chip({
  tone = "neutral",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: "neutral" | "done" | "error" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        tone === "neutral" && "bg-surface-subtle text-ink-muted",
        tone === "done" && "bg-surface-subtle text-ink",
        tone === "error" && "bg-red-bg text-red-fg",
        tone === "muted" && "bg-surface-subtle text-ink-subtle",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

function SentChip({ at }: { at: string | null | undefined }) {
  return (
    <Chip tone="done" title={at ? `Sent ${formatDateTimePK(at)}` : undefined}>
      <CheckIcon aria-hidden className="size-3.5 text-green-fg" />
      Sent{at ? ` ${formatSentAt(at, new Date())}` : ""}
    </Chip>
  )
}

/** A disabled control that explains why (docs/12 §8). */
function Unavailable({
  reason,
  children,
}: {
  reason: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}

function EmailState({
  item,
  sending,
  onRetry,
}: {
  item: QueueItem
  sending: boolean
  onRetry: () => void
}) {
  const row = item.email
  if (!item.service.email) {
    return (
      <Unavailable reason="No email address for this client">
        <Chip tone="muted">No email</Chip>
      </Unavailable>
    )
  }
  if (sending) {
    return (
      <Chip>
        <Loader2Icon aria-hidden className="size-3.5 animate-spin" />
        Sending
      </Chip>
    )
  }
  if (!row) return <Chip tone="muted">Not queued</Chip>

  switch (row.status) {
    case "sent":
      return <SentChip at={row.sentAt} />
    case "failed":
      return (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Chip tone="error" tabIndex={0}>
                <CircleAlertIcon aria-hidden className="size-3.5" />
                Failed
              </Chip>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {row.lastError ?? "Email failed"}
            </TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="xs" onClick={onRetry} className="text-brand-700">
            Retry
          </Button>
        </>
      )
    case "skipped":
      return <Chip tone="muted">Skipped</Chip>
    default:
      return <Chip>Pending</Chip>
  }
}

function WhatsAppState({
  item,
  busy,
  onOpened,
  onMarkSent,
}: {
  item: QueueItem
  busy: boolean
  onOpened: (row: ReminderRow) => void
  onMarkSent: (row: ReminderRow) => void
}) {
  const row = item.whatsapp
  const link = row?.waLink ?? item.service.waLink

  if (!link) {
    return (
      <Unavailable reason="No valid WhatsApp number">
        <Button variant="whatsapp" size="sm" disabled className="max-md:h-10">
          <MessageCircleIcon />
          Open WhatsApp
        </Button>
      </Unavailable>
    )
  }
  if (row?.status === "sent") return <SentChip at={row.sentAt} />
  if (row?.status === "skipped") return <Chip tone="muted">Skipped</Chip>
  if (row?.status === "opened") {
    return (
      <>
        <Chip>Opened</Chip>
        <Button
          variant="outline"
          size="sm"
          loading={busy}
          onClick={() => onMarkSent(row)}
          className="max-md:h-10"
        >
          <CheckIcon />
          Mark as sent
        </Button>
      </>
    )
  }
  return (
    <Button asChild variant="whatsapp" size="sm" className="max-md:h-10">
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => row && onOpened(row)}
      >
        <MessageCircleIcon />
        Open WhatsApp
      </a>
    </Button>
  )
}
