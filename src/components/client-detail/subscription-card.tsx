"use client"

import * as React from "react"
import { attemptAction } from "@/lib/attempt-action"
import {
  BanIcon,
  FilePlusIcon,
  MailIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { RenewDialog } from "@/components/renew-dialog"
import { StatusBadge } from "@/components/status-badge"
import { TimerPill } from "@/components/timer-pill"
import { WithReason } from "@/components/with-reason"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDatePK } from "@/lib/domain/dates"
import { formatMoney } from "@/lib/domain/money"
import {
  deleteSubscriptionAction,
  toggleCancelSubscriptionAction,
} from "@/actions/subscriptions"
import { createInvoiceNowAction } from "@/actions/invoices"
import { sendManualEmailAction } from "@/actions/reminders"
import { InvoiceChip } from "@/components/invoices/invoice-status-badge"
import { useInvoiceDialogs } from "@/components/invoices/use-invoice-dialogs"
import type { SubscriptionRow } from "@/types/view"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** One subscription on the client page (docs/06 §4.7, docs/14 §7). */
export function SubscriptionCard({
  subscription: s,
  paymentCount,
}: {
  subscription: SubscriptionRow
  paymentCount: number
}) {
  const [renewOpen, setRenewOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [toggling, setToggling] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const { openShare, dialogs } = useInvoiceDialogs()
  const cancelled = s.status === "cancelled"

  async function createInvoice() {
    setCreating(true)
    const res = await attemptAction(() => createInvoiceNowAction(s.id))
    setCreating(false)
    if (!res.ok || !res.data)
      return void toast.error(res.ok ? "Couldn’t create the invoice." : res.error)
    toast.success(
      res.data.created
        ? `Invoice ${res.data.number} created for ${s.domain}`
        : `${s.domain} already has invoice ${res.data.number} for this renewal`
    )
  }

  async function sendEmail() {
    setSending(true)
    const res = await attemptAction(() => sendManualEmailAction(s.id))
    setSending(false)
    if (res.ok) toast.success(`Reminder emailed to ${s.email}`)
    else toast.error(`Couldn’t email ${s.clientName}`, { description: res.error })
  }

  async function toggleCancel() {
    setToggling(true)
    const res = await attemptAction(() => toggleCancelSubscriptionAction(s.id))
    setToggling(false)
    if (!res.ok) return void toast.error(res.error)
    toast.success(
      res.data?.status === "cancelled"
        ? `${s.domain} cancelled. Reminders are off.`
        : `${s.domain} is active again`
    )
  }

  return (
    <article
      id={`sub-${s.id}`}
      aria-labelledby={`sub-${s.id}-title`}
      className="scroll-mt-24 overflow-hidden rounded-lg border border-border bg-surface target:ring-3 target:ring-ring/30"
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3
              id={`sub-${s.id}-title`}
              title={s.domain}
              className="truncate text-base font-semibold"
            >
              {s.domain}
            </h3>
            <StatusBadge colour={s.colour} />
            {s.invoice && <InvoiceChip invoice={s.invoice} />}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {s.serviceName}
            {s.planLabel && ` · ${s.planLabel} plan`}
            {!cancelled && !s.remindersEnabled && " · Reminders off"}
          </p>
        </div>
        <SubscriptionMenu
          subscription={s}
          busy={toggling}
          onToggleCancel={() => void toggleCancel()}
          onDelete={() => setDeleteOpen(true)}
        />
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6 sm:px-5">
        {/* A cancelled subscription has no timer (docs/10 §2); the badge says Cancelled. */}
        {!cancelled && (
          <TimerPill
            renewalDate={s.renewalDate}
            size="lg"
            className="self-start sm:self-center"
          />
        )}
        <dl className="grid grid-cols-3 gap-4 text-sm sm:flex sm:flex-wrap sm:gap-6">
          <Fact label="Started">{formatDatePK(s.startDate)}</Fact>
          <Fact label="Renews">{formatDatePK(s.renewalDate)}</Fact>
          <Fact label="Amount">
            <span className="font-mono">{formatMoney(s.chargeAmount, s.currency)}</span>
          </Fact>
        </dl>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border bg-surface-hover px-4 py-3 sm:flex sm:flex-wrap sm:px-5">
        {cancelled ? (
          <Button
            variant="outline"
            size="sm"
            loading={toggling}
            onClick={() => void toggleCancel()}
            className="max-sm:h-11"
          >
            <RotateCcwIcon />
            Reactivate
          </Button>
        ) : (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={() => setRenewOpen(true)}
              className="max-sm:h-11"
            >
              Record renewal
            </Button>
            <WithReason reason={s.email ? null : "No email address for this client"}>
              <Button
                variant="outline"
                size="sm"
                loading={sending}
                disabled={!s.email}
                onClick={() => void sendEmail()}
                className="max-sm:h-11 max-sm:w-full"
              >
                <MailIcon />
                Send reminder
              </Button>
            </WithReason>
            <WithReason reason={s.waLink ? null : "No valid WhatsApp number"}>
              {s.waLink ? (
                <Button
                  asChild
                  variant="whatsapp"
                  size="sm"
                  className="max-sm:h-11 max-sm:w-full"
                >
                  <a href={s.waLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircleIcon />
                    Open WhatsApp
                  </a>
                </Button>
              ) : (
                <Button
                  variant="whatsapp"
                  size="sm"
                  disabled
                  className="max-sm:h-11 max-sm:w-full"
                >
                  <MessageCircleIcon />
                  Open WhatsApp
                </Button>
              )}
            </WithReason>
            {s.invoice && s.invoice.status !== "void" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openShare(s.invoice!)}
                className="max-sm:h-11 max-sm:w-full"
              >
                <SendIcon />
                Share invoice
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                loading={creating}
                onClick={() => void createInvoice()}
                className="max-sm:h-11 max-sm:w-full"
              >
                <FilePlusIcon />
                Create invoice now
              </Button>
            )}
          </>
        )}
        <Button asChild variant="ghost" size="sm" className="text-ink-muted max-sm:h-11">
          <Link href={`/subscriptions/${s.id}/edit`}>
            <PencilIcon />
            Edit
          </Link>
        </Button>
      </div>

      <RenewDialog
        subscription={s}
        invoice={
          s.invoice &&
          (s.invoice.status === "unpaid" ||
            s.invoice.status === "sent" ||
            s.invoice.status === "overdue")
            ? s.invoice
            : null
        }
        open={renewOpen}
        onOpenChange={setRenewOpen}
      />
      {dialogs}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${s.domain}?`}
        description={
          <>
            This deletes the subscription
            {paymentCount ? `, its ${plural(paymentCount, "payment")}` : ""} and all its
            reminders. This can’t be undone. To stop reminders but keep the history,
            cancel the subscription instead.
          </>
        }
        confirmLabel="Delete subscription"
        onConfirm={async () => {
          const res = await attemptAction(() => deleteSubscriptionAction(s.id))
          if (!res.ok) {
            toast.error(res.error)
            return false
          }
          toast.success(`${s.domain} deleted`)
        }}
      />
    </article>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 truncate text-ink">{children}</dd>
    </div>
  )
}

function SubscriptionMenu({
  subscription: service,
  busy,
  onToggleCancel,
  onDelete,
}: {
  subscription: SubscriptionRow
  busy: boolean
  onToggleCancel: () => void
  onDelete: () => void
}) {
  const cancelled = service.status === "cancelled"
  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`More actions for ${service.domain}`}
              className="-mt-1 -mr-2 shrink-0 text-ink-muted max-md:size-11"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={busy} onSelect={onToggleCancel}>
          {cancelled ? <RotateCcwIcon /> : <BanIcon />}
          {cancelled ? "Reactivate subscription" : "Cancel subscription"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2Icon />
          Delete subscription
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
