"use client"

import * as React from "react"
import {
  CircleCheckIcon,
  CircleIcon,
  CircleXIcon,
  Loader2Icon,
  SendIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { sendAdminSummaryEmailAction, sendReminderEmailAction } from "@/lib/mock/actions"

export interface EmailRecipient {
  /** Reminder row id */
  id: string
  name: string
  email: string
  domain: string
}

type Status = "queued" | "sending" | "sent" | "failed"
type Result = { status: "sent"; sentAt: string } | { status: "failed"; error: string }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * "Send N emails" (docs/06 §4.4, docs/04 §5.1): sends one email per action
 * call, in order, with live per-recipient progress. It can't be closed
 * while sending. Ends with "4 sent · 1 failed" and Retry failed.
 */
export function SendEmailsDialog({
  open,
  onOpenChange,
  recipients,
  adminEmail,
  onSending,
  onResult,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipients: EmailRecipient[]
  adminEmail: string
  onSending: (id: string, sending: boolean) => void
  onResult: (id: string, result: Result) => void
}) {
  const [busy, setBusy] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        showCloseButton={!busy}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        {open && (
          <SendFlow
            recipients={recipients}
            adminEmail={adminEmail}
            onBusyChange={setBusy}
            onSending={onSending}
            onResult={onResult}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SendFlow({
  recipients,
  adminEmail,
  onBusyChange,
  onSending,
  onResult,
  onClose,
}: {
  recipients: EmailRecipient[]
  adminEmail: string
  onBusyChange: (busy: boolean) => void
  onSending: (id: string, sending: boolean) => void
  onResult: (id: string, result: Result) => void
  onClose: () => void
}) {
  // Snapshot the list when the dialog opens; it doesn't change under the user.
  const [list] = React.useState(recipients)
  const [phase, setPhase] = React.useState<"confirm" | "sending" | "done">("confirm")
  const [status, setStatus] = React.useState<Record<string, Status>>(() =>
    Object.fromEntries(list.map((r) => [r.id, "queued" as Status]))
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [withSummary, setWithSummary] = React.useState(true)
  const [summary, setSummary] = React.useState<Status | "off">("off")
  const [summaryError, setSummaryError] = React.useState<string>()

  const counts = React.useMemo(() => {
    const values = Object.values(status)
    return {
      sent: values.filter((s) => s === "sent").length,
      failed: values.filter((s) => s === "failed").length,
    }
  }, [status])

  async function run(ids: string[], sendSummary: boolean) {
    setPhase("sending")
    onBusyChange(true)
    setStatus((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, "queued"])) }))

    // One email per request, in order (keeps every request short on serverless).
    for (const id of ids) {
      setStatus((s) => ({ ...s, [id]: "sending" }))
      onSending(id, true)
      const res = await sendReminderEmailAction(id)
      onSending(id, false)
      if (res.ok && res.data) {
        setStatus((s) => ({ ...s, [id]: "sent" }))
        onResult(id, { status: "sent", sentAt: res.data.sentAt })
      } else {
        const error = res.ok ? "Email failed" : res.error
        setStatus((s) => ({ ...s, [id]: "failed" }))
        setErrors((e) => ({ ...e, [id]: error }))
        onResult(id, { status: "failed", error })
      }
    }

    if (sendSummary) {
      setSummary("sending")
      const res = await sendAdminSummaryEmailAction()
      setSummary(res.ok ? "sent" : "failed")
      if (!res.ok) setSummaryError(res.error)
    }

    onBusyChange(false)
    setPhase("done")
  }

  const total = list.length
  const finished = counts.sent + counts.failed
  const current = Math.min(finished + 1, total)

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {phase !== "done"
            ? `Send ${plural(total, "reminder email")}`
            : counts.failed === 0
              ? "Reminder emails sent"
              : counts.sent === 0
                ? "No emails were sent"
                : "Some emails failed"}
        </DialogTitle>
        <DialogDescription>
          {phase === "confirm"
            ? "Each client gets their own reminder. Emails go out one at a time."
            : phase === "sending"
              ? "Keep this window open until sending finishes."
              : `${counts.sent} sent · ${counts.failed} failed`}
        </DialogDescription>
      </DialogHeader>

      {phase !== "confirm" && (
        <div className="grid gap-1.5">
          <div className="flex justify-between text-sm" aria-live="polite">
            <span className="font-medium">
              {phase === "sending" && finished < total
                ? `Sending ${current} of ${total}`
                : phase === "sending"
                  ? "Sending the summary"
                  : "Done"}
            </span>
            <span className="text-ink-muted tabular-nums">
              {finished}/{total}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Emails sent"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={finished}
            className="h-1.5 overflow-hidden rounded-full bg-surface-subtle"
          >
            <div
              className="h-full rounded-full bg-brand-700 transition-[width] duration-200 ease-out"
              style={{ width: `${total ? (finished / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <ul className="-mx-1 max-h-[45dvh] overflow-y-auto sm:max-h-72">
        {list.map((r) => (
          <RecipientRow
            key={r.id}
            status={status[r.id] ?? "queued"}
            showStatus={phase !== "confirm"}
            title={r.name}
            detail={r.email}
            aside={r.domain}
            error={errors[r.id]}
          />
        ))}
        {phase !== "confirm" && summary !== "off" && (
          <RecipientRow
            status={summary}
            showStatus
            title="Summary to you"
            detail={adminEmail}
            error={summaryError}
          />
        )}
      </ul>

      {phase === "confirm" && (
        <Label className="font-normal">
          <Checkbox
            checked={withSummary}
            onCheckedChange={(v) => setWithSummary(v === true)}
          />
          Also email me the summary
        </Label>
      )}

      <DialogFooter>
        {phase === "confirm" && (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                run(
                  list.map((r) => r.id),
                  withSummary
                )
              }
            >
              <SendIcon />
              Send {plural(total, "email")}
            </Button>
          </>
        )}
        {phase === "sending" && (
          <Button disabled>
            <Loader2Icon className="animate-spin" />
            {finished < total ? `Sending ${current} of ${total}` : "Sending the summary"}
          </Button>
        )}
        {phase === "done" && (
          <>
            {counts.failed > 0 && (
              <Button
                variant="outline"
                onClick={() =>
                  run(
                    list.filter((r) => status[r.id] === "failed").map((r) => r.id),
                    summary === "failed"
                  )
                }
              >
                Retry {plural(counts.failed, "failed email")}
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </>
        )}
      </DialogFooter>
    </>
  )
}

const STATUS_ICON: Record<Status, React.ReactNode> = {
  queued: <CircleIcon aria-hidden className="size-4 text-line-strong" />,
  sending: <Loader2Icon aria-hidden className="size-4 animate-spin text-ink-muted" />,
  sent: <CircleCheckIcon aria-hidden className="size-4 text-green-fg" />,
  failed: <CircleXIcon aria-hidden className="size-4 text-red-fg" />,
}

const STATUS_TEXT: Record<Status, string> = {
  queued: "Waiting",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
}

function RecipientRow({
  status,
  showStatus,
  title,
  detail,
  aside,
  error,
}: {
  status: Status
  showStatus: boolean
  title: string
  detail: string
  aside?: string
  error?: string
}) {
  return (
    <li className="flex items-start gap-3 rounded-md px-1 py-2">
      {showStatus && (
        <span className="mt-0.5 shrink-0">
          {STATUS_ICON[status]}
          <span className="sr-only">{STATUS_TEXT[status]}</span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-base font-medium">{title}</span>
          {aside && (
            <span className="max-w-[45%] shrink-0 truncate text-sm text-ink-muted">
              {aside}
            </span>
          )}
        </div>
        <div className="truncate text-sm text-ink-muted">{detail}</div>
        {status === "failed" && error && (
          <p className="mt-1 text-xs text-red-fg">{error}</p>
        )}
      </div>
    </li>
  )
}
