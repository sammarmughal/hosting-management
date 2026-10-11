"use client"

import * as React from "react"
import { toast } from "sonner"

import { getInvoiceShareDataAction } from "@/actions/invoices"
import { ShareInvoiceDialog } from "@/components/invoices/share-invoice-dialog"
import { VoidInvoiceDialog } from "@/components/invoices/void-invoice-dialog"
import { RenewDialog } from "@/components/renew-dialog"
import { attemptAction } from "@/lib/attempt-action"
import type { ServiceRow } from "@/types/view"

export interface InvoiceRef {
  id: number
  number: string
  total: string
  currency: string
}

/**
 * Share, Mark as paid and Void for any invoice, from list menus, service
 * cards and queue rows. Mark as paid opens the existing Renew dialog with
 * the invoice total (docs/13 §5); the service is loaded when it opens.
 */
export function useInvoiceDialogs() {
  const [share, setShare] = React.useState<InvoiceRef | null>(null)
  const [shareOpen, setShareOpen] = React.useState(false)
  const [voiding, setVoiding] = React.useState<InvoiceRef | null>(null)
  const [voidOpen, setVoidOpen] = React.useState(false)
  const [paying, setPaying] = React.useState<{ invoice: InvoiceRef; service: ServiceRow } | null>(null)
  const [payOpen, setPayOpen] = React.useState(false)

  const openShare = React.useCallback((inv: InvoiceRef) => {
    setShare(inv)
    setShareOpen(true)
  }, [])
  const openVoid = React.useCallback((inv: InvoiceRef) => {
    setVoiding(inv)
    setVoidOpen(true)
  }, [])
  const openPay = React.useCallback(async (inv: InvoiceRef, service?: ServiceRow) => {
    if (service) {
      setPaying({ invoice: inv, service })
      setPayOpen(true)
      return
    }
    const res = await attemptAction(() => getInvoiceShareDataAction(inv.id))
    if (!res.ok || !res.data) return void toast.error(res.ok ? "Invoice not found." : res.error)
    setPaying({ invoice: inv, service: res.data.service })
    setPayOpen(true)
  }, [])

  const dialogs = (
    <>
      {share && (
        <ShareInvoiceDialog
          key={share.id}
          invoiceId={share.id}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}
      <VoidInvoiceDialog invoice={voiding} open={voidOpen} onOpenChange={setVoidOpen} />
      <RenewDialog
        service={paying?.service ?? null}
        invoice={paying?.invoice ?? null}
        open={payOpen}
        onOpenChange={setPayOpen}
      />
    </>
  )

  return { openShare, openVoid, openPay, dialogs }
}
