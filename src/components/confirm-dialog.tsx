"use client"

import * as React from "react"
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

/**
 * Confirmation for destructive actions (docs/06 §3.6). Says exactly what
 * happens; the confirm button names the action. Can't be dismissed while
 * the action runs.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  /** Return false to keep the dialog open (e.g. on error). */
  onConfirm: () => Promise<boolean | void>
  destructive?: boolean
}) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")

  async function confirm() {
    setBusy(true)
    setError("")
    try {
      const result = await onConfirm()
      if (result !== false) onOpenChange(false)
    } catch {
      setError("Couldn’t complete this action. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        showCloseButton={!busy}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            loading={busy}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
