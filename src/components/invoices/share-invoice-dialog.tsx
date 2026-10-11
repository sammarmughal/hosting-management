"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
  SendIcon,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import {
  getInvoiceShareDataAction,
  invoiceWhatsappOpenedAction,
  invoiceWhatsappSentAction,
  shareInvoiceBothAction,
  shareInvoiceEmailAction,
} from "@/actions/invoices"
import { FormField } from "@/components/form-field"
import { InlineAlert } from "@/components/inline-alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { attemptAction } from "@/lib/attempt-action"
import { buildWaLink, formatPhone } from "@/lib/domain/whatsapp"
import { openWhatsApp } from "@/lib/open-whatsapp"
import { cn } from "@/lib/utils"
import type { ShareData } from "@/types/view"

type Channel = "whatsapp" | "email" | "both"
type EmailState =
  | { s: "idle" }
  | { s: "sending" }
  | { s: "sent"; to: string }
  | { s: "failed"; error: string }
type WaState = "idle" | "opened" | "marking" | "sent" | "blocked"

/**
 * Share invoice (docs/13 §9): WhatsApp, Email or Both, with recipients from
 * the client. Pass `data` when it's already loaded (invoice detail page);
 * otherwise it's fetched when the dialog opens.
 */
export function ShareInvoiceDialog({
  invoiceId,
  data: initial,
  open,
  onOpenChange,
}: {
  invoiceId: number
  data?: ShareData
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [data, setData] = React.useState<ShareData | null>(initial ?? null)
  const [loadError, setLoadError] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open || initial) return
    // The dialog is keyed per invoice, so state starts fresh for each one.
    let cancelled = false
    void attemptAction(() => getInvoiceShareDataAction(invoiceId)).then((res) => {
      if (cancelled) return
      if (res.ok && res.data) setData(res.data)
      else setLoadError(res.ok ? "Couldn’t load the invoice." : res.error)
    })
    return () => {
      cancelled = true
    }
  }, [open, initial, invoiceId])

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        showCloseButton={!busy}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        {data ? (
          <ShareFlow
            key={data.invoiceId}
            data={data}
            onBusyChange={setBusy}
            onClose={() => onOpenChange(false)}
          />
        ) : loadError ? (
          <>
            <DialogHeader>
              <DialogTitle>Share invoice</DialogTitle>
              <DialogDescription>Send it by WhatsApp or email.</DialogDescription>
            </DialogHeader>
            <InlineAlert>{loadError}</InlineAlert>
          </>
        ) : (
          <div aria-busy="true" aria-label="Loading invoice" className="grid gap-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-64" />
            <div className="grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-18 rounded-md" />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ShareFlow({
  data,
  onBusyChange,
  onClose,
}: {
  data: ShareData
  onBusyChange: (busy: boolean) => void
  onClose: () => void
}) {
  const emailOk = !data.emailUnavailable
  const waOk = !data.whatsappUnavailable
  const [channel, setChannel] = React.useState<Channel>(
    emailOk && waOk ? "both" : waOk ? "whatsapp" : "email"
  )
  const [showMessage, setShowMessage] = React.useState(false)
  const [subject, setSubject] = React.useState(data.emailSubject)
  const [emailText, setEmailText] = React.useState(data.emailText)
  const [waText, setWaText] = React.useState(data.whatsappText)
  const [email, setEmail] = React.useState<EmailState>({ s: "idle" })
  const [wa, setWa] = React.useState<WaState>("idle")
  const [error, setError] = React.useState("")

  const usesEmail = channel !== "whatsapp"
  const usesWa = channel !== "email"
  const canSend =
    (channel === "email" && emailOk) ||
    (channel === "whatsapp" && waOk) ||
    (channel === "both" && emailOk && waOk)
  // Built before the click, from the current text (docs/13 §9).
  const waUrl = React.useMemo(
    () => (data.phone ? buildWaLink(data.phone, waText) : null),
    [data.phone, waText]
  )
  const started = email.s !== "idle" || wa !== "idle"
  const reason = (r: string | null) => r && `${r}.`
  const bothReason =
    [data.emailUnavailable, data.whatsappUnavailable].filter(Boolean).join(". ") || null

  async function sendEmailOnly() {
    setError("")
    setEmail({ s: "sending" })
    onBusyChange(true)
    const res = await attemptAction(() =>
      shareInvoiceEmailAction(data.invoiceId, { subject, text: emailText })
    )
    onBusyChange(false)
    if (res.ok && res.data) {
      setEmail({ s: "sent", to: res.data.to })
      toast.success(`Email sent to ${data.clientName}`)
    } else {
      const msg = res.ok ? "Email failed" : res.error
      setEmail({ s: "failed", error: msg })
      toast.error(`Couldn’t email ${data.clientName}`, { description: msg })
    }
  }

  /** WhatsApp and Both: open the chat first, synchronously, then record and send. */
  function openAndSend(alsoEmail: boolean) {
    setError("")
    if (!waUrl) return
    const ok = openWhatsApp(waUrl)
    if (!ok) {
      setWa("blocked")
      setError("Your browser blocked the WhatsApp tab. Allow pop-ups for this site and try again.")
      return
    }
    setWa("opened")
    if (!alsoEmail) {
      void attemptAction(() => invoiceWhatsappOpenedAction(data.invoiceId)).then((res) => {
        if (!res.ok) toast.error(res.error)
        else toast.success(`WhatsApp opened for ${data.clientName}`)
      })
      return
    }
    setEmail({ s: "sending" })
    onBusyChange(true)
    void attemptAction(() =>
      shareInvoiceBothAction(data.invoiceId, { subject, text: emailText })
    ).then((res) => {
      onBusyChange(false)
      const r = res.ok ? res.data?.email : null
      if (r?.ok) {
        setEmail({ s: "sent", to: r.to })
        toast.success(`Email sent to ${data.clientName} · WhatsApp opened`)
      } else {
        const msg = r && !r.ok ? r.error : res.ok ? "Email failed" : res.error
        setEmail({ s: "failed", error: msg })
        toast.error(`WhatsApp opened, but the email to ${data.clientName} failed`, {
          description: msg,
        })
      }
    })
  }

  async function markWaSent() {
    setWa("marking")
    const res = await attemptAction(() => invoiceWhatsappSentAction(data.invoiceId))
    if (res.ok) setWa("sent")
    else {
      setWa("opened")
      toast.error(res.error)
    }
  }

  const primaryLabel =
    channel === "both" ? "Send email + WhatsApp" : channel === "email" ? "Send email" : "Open WhatsApp"

  return (
    <>
      <DialogHeader>
        <DialogTitle>Share invoice {data.number}</DialogTitle>
        <DialogDescription>To {data.clientName}</DialogDescription>
      </DialogHeader>

      <RadioGroup
        value={channel}
        onValueChange={(v) => setChannel(v as Channel)}
        aria-label="How to share"
        className="grid gap-2 sm:grid-cols-3"
        disabled={started}
      >
        <OptionCard
          value="whatsapp"
          icon={MessageCircleIcon}
          title="WhatsApp"
          detail={data.phone ? formatPhone(data.phone) : null}
          unavailable={reason(data.whatsappUnavailable)}
          clientId={data.clientId}
        />
        <OptionCard
          value="email"
          icon={MailIcon}
          title="Email"
          detail={data.email}
          unavailable={reason(data.emailUnavailable)}
          clientId={data.clientId}
        />
        <OptionCard
          value="both"
          icon={SendIcon}
          title="Both"
          detail="One click"
          unavailable={bothReason ? `${bothReason}.` : null}
          clientId={data.clientId}
        />
      </RadioGroup>

      <div className="rounded-md border border-border">
        <button
          type="button"
          aria-expanded={showMessage}
          onClick={() => setShowMessage((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 text-sm font-medium outline-none hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/40 md:min-h-9"
        >
          Message
          <span className="flex items-center gap-2 text-xs font-normal text-ink-muted">
            Edit for this send only
            <ChevronDownIcon
              aria-hidden
              className={cn("size-4 transition-transform duration-150", showMessage && "rotate-180")}
            />
          </span>
        </button>
        {showMessage && (
          <div className="grid max-h-[40dvh] gap-4 overflow-y-auto border-t border-border p-3 sm:max-h-80">
            {usesEmail && (
              <>
                <FormField id="share-subject" label="Email subject">
                  <Input
                    id="share-subject"
                    value={subject}
                    disabled={started}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </FormField>
                <FormField id="share-email" label="Email message" help="The PDF is attached.">
                  <Textarea
                    id="share-email"
                    value={emailText}
                    disabled={started}
                    onChange={(e) => setEmailText(e.target.value)}
                    aria-describedby="share-email-help"
                    className="field-sizing-fixed h-40 resize-y text-sm"
                  />
                </FormField>
              </>
            )}
            {usesWa && (
              <FormField id="share-wa" label="WhatsApp message">
                <Textarea
                  id="share-wa"
                  value={waText}
                  disabled={started}
                  onChange={(e) => setWaText(e.target.value)}
                  className="field-sizing-fixed h-36 resize-y text-sm"
                />
              </FormField>
            )}
          </div>
        )}
      </div>

      {error && <InlineAlert>{error}</InlineAlert>}

      {started && (
        <ul className="grid gap-2 text-sm" aria-live="polite">
          {email.s !== "idle" && (
            <li className="flex items-start gap-2">
              {email.s === "sending" ? (
                <Loader2Icon aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-ink-muted" />
              ) : email.s === "sent" ? (
                <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-green-fg" />
              ) : (
                <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-red-fg" />
              )}
              <div className="min-w-0 flex-1">
                <p>
                  {email.s === "sending"
                    ? `Sending email to ${data.email}`
                    : email.s === "sent"
                      ? `Email sent to ${email.to}`
                      : "Email failed"}
                </p>
                {email.s === "failed" && (
                  <p className="mt-0.5 text-xs break-words text-red-fg">{email.error}</p>
                )}
              </div>
              {email.s === "failed" && (
                <Button size="xs" variant="ghost" className="text-brand-700" onClick={() => void sendEmailOnly()}>
                  Retry
                </Button>
              )}
            </li>
          )}
          {(wa === "opened" || wa === "marking" || wa === "sent") && (
            <li className="flex items-center gap-2">
              <MessageCircleIcon aria-hidden className="size-4 shrink-0 text-ink-muted" />
              <p className="min-w-0 flex-1">
                {wa === "sent" ? "WhatsApp marked as sent" : "WhatsApp opened · press Send there"}
              </p>
              {wa !== "sent" && (
                <Button size="sm" variant="outline" loading={wa === "marking"} onClick={() => void markWaSent()}>
                  <CheckIcon />
                  Mark as sent
                </Button>
              )}
            </li>
          )}
        </ul>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {started ? "Close" : "Cancel"}
        </Button>
        {!started && (
          <Button
            disabled={!canSend}
            onClick={() =>
              channel === "email" ? void sendEmailOnly() : openAndSend(channel === "both")
            }
          >
            {channel === "email" ? <SendIcon /> : <MessageCircleIcon />}
            {primaryLabel}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

function OptionCard({
  value,
  icon: Icon,
  title,
  detail,
  unavailable,
  clientId,
}: {
  value: Channel
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  title: string
  detail: string | null
  unavailable: string | null
  clientId: number
}) {
  const id = `share-${value}`
  return (
    <div
      className={cn(
        "relative flex min-h-18 flex-col gap-1 rounded-md border border-border px-3 py-2.5 transition-colors has-[[data-state=checked]]:border-brand-700 has-[[data-state=checked]]:bg-brand-100/40",
        unavailable && "bg-surface-subtle"
      )}
    >
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
        <RadioGroupItem id={id} value={value} disabled={!!unavailable} />
        <Icon aria-hidden className="size-4 text-ink-muted" />
        {title}
      </label>
      {unavailable ? (
        <p className="text-xs text-ink-muted">
          {unavailable}{" "}
          <Link
            href={`/clients/${clientId}/edit`}
            className="relative z-10 font-medium text-brand-700 hover:underline"
          >
            Edit client
          </Link>
        </p>
      ) : (
        <p className="truncate text-xs text-ink-muted" title={detail ?? undefined}>
          {detail}
        </p>
      )}
    </div>
  )
}
