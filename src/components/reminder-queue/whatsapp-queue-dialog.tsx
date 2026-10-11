"use client"

import * as React from "react"
import { CheckIcon, MessageCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDatePK } from "@/lib/domain/dates"
import { formatMoney } from "@/lib/domain/money"
import { formatPhone } from "@/lib/domain/whatsapp"
import type { QueueItem } from "@/types/view"

export interface WhatsAppStep {
  item: QueueItem
  /** wa.me link, built on the server. */
  url: string
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * "WhatsApp queue": steps through the clients one at a time. WhatsApp can't
 * be sent in bulk (click-to-chat only), so each step opens one chat; the
 * admin presses Send there, then marks it sent here and moves on.
 */
export function WhatsAppQueueDialog({
  open,
  onOpenChange,
  steps,
  onOpen,
  onMarkSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  steps: WhatsAppStep[]
  /** Must open the link synchronously; returns false if it was blocked. */
  onOpen: (step: WhatsAppStep) => boolean
  onMarkSent: (step: WhatsAppStep) => Promise<boolean>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <QueueFlow
            steps={steps}
            onOpen={onOpen}
            onMarkSent={onMarkSent}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function QueueFlow({
  steps,
  onOpen,
  onMarkSent,
  onClose,
}: {
  steps: WhatsAppStep[]
  onOpen: (step: WhatsAppStep) => boolean
  onMarkSent: (step: WhatsAppStep) => Promise<boolean>
  onClose: () => void
}) {
  // Snapshot the list when the dialog opens; it doesn't change under the user.
  const [list] = React.useState(steps)
  const [index, setIndex] = React.useState(0)
  const [opened, setOpened] = React.useState(false)
  const [blocked, setBlocked] = React.useState(false)
  const [marking, setMarking] = React.useState(false)
  const [done, setDone] = React.useState({ opened: 0, sent: 0 })

  const step = list[index]
  const finished = index >= list.length

  function next() {
    setIndex((i) => i + 1)
    setOpened(false)
    setBlocked(false)
  }

  if (finished || !step) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>WhatsApp queue done</DialogTitle>
          <DialogDescription>
            {plural(done.opened, "chat")} opened · {done.sent} marked sent
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </>
    )
  }

  const s = step.item.service
  return (
    <>
      <DialogHeader>
        <DialogTitle>WhatsApp queue</DialogTitle>
        <DialogDescription>
          {index + 1} of {list.length} · press Send in WhatsApp, then come back here.
        </DialogDescription>
      </DialogHeader>

      <div
        role="progressbar"
        aria-label="WhatsApp queue progress"
        aria-valuemin={0}
        aria-valuemax={list.length}
        aria-valuenow={index}
        className="h-1.5 overflow-hidden rounded-full bg-surface-subtle"
      >
        <div
          className="h-full rounded-full bg-brand-700 transition-[width] duration-200 ease-out"
          style={{ width: `${(index / list.length) * 100}%` }}
        />
      </div>

      <div className="grid gap-1 rounded-md border border-border px-3 py-3" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-base font-medium">{s.clientName}</span>
          <span className="shrink-0 text-sm text-ink-muted">
            {s.phone ? formatPhone(s.phone) : ""}
          </span>
        </div>
        <div className="truncate text-sm text-ink-muted">
          {s.domain} · renews {formatDatePK(s.renewalDate)} ·{" "}
          {formatMoney(s.chargeAmount, s.currency)}
        </div>
        {blocked && (
          <p className="mt-1 text-xs text-red-fg">
            Your browser blocked the new tab. Allow pop-ups for this site, then try again.
          </p>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={next} className="text-ink-muted">
          {opened ? "Next" : "Skip for now"}
        </Button>
        {opened ? (
          <Button
            loading={marking}
            onClick={async () => {
              setMarking(true)
              const ok = await onMarkSent(step)
              setMarking(false)
              if (ok) setDone((d) => ({ ...d, sent: d.sent + 1 }))
              next()
            }}
          >
            <CheckIcon />
            Mark sent and next
          </Button>
        ) : (
          <Button
            variant="whatsapp"
            onClick={() => {
              // Synchronous: no await before opening (pop-up blockers).
              const ok = onOpen(step)
              setBlocked(!ok)
              if (ok) {
                setOpened(true)
                setDone((d) => ({ ...d, opened: d.opened + 1 }))
              }
            }}
          >
            <MessageCircleIcon />
            Open WhatsApp
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
