"use client"

import * as React from "react"
import { toast } from "sonner"

import { voidInvoiceAction } from "@/actions/invoices"
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
import { Textarea } from "@/components/ui/textarea"
import { attemptAction } from "@/lib/attempt-action"

/** Void with confirmation and an optional reason (docs/13 §5). The number is kept. */
export function VoidInvoiceDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: { id: number; number: string } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")

  async function confirm() {
    if (!invoice) return
    setBusy(true)
    setError("")
    const res = await attemptAction(() => voidInvoiceAction(invoice.id, reason))
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast.success(`Invoice ${invoice.number} voided`)
    setReason("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Void invoice {invoice?.number}?</DialogTitle>
          <DialogDescription>
            The invoice stays in the list with its number, marked Void. It can’t be paid,
            shared or changed afterwards.
          </DialogDescription>
        </DialogHeader>
        {error && <InlineAlert>{error}</InlineAlert>}
        <FormField id="void-reason" label="Reason" help="Optional. Shown in the invoice’s history.">
          <Textarea
            id="void-reason"
            value={reason}
            maxLength={300}
            rows={2}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby="void-reason-help"
          />
        </FormField>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" loading={busy} onClick={() => void confirm()}>
            Void invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
