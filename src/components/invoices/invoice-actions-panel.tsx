"use client"

import * as React from "react"
import {
  BanIcon,
  BuildingIcon,
  CircleCheckIcon,
  DownloadIcon,
  LinkIcon,
  RefreshCwIcon,
  RotateCwIcon,
  SendIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  refreshBusinessDetailsAction,
  regenerateLinkAction,
  updateFromSubscriptionAction,
} from "@/actions/invoices"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { copyInvoiceLink } from "@/components/invoices/invoices-table"
import { ShareInvoiceDialog } from "@/components/invoices/share-invoice-dialog"
import { VoidInvoiceDialog } from "@/components/invoices/void-invoice-dialog"
import { RenewDialog } from "@/components/renew-dialog"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { attemptAction } from "@/lib/attempt-action"
import { formatDatePK } from "@/lib/domain/dates"
import type { InvoiceDetail, ShareData } from "@/types/view"

/** docs/13 §11: Share is the one primary button; the rest are secondary. */
export function InvoiceActionsPanel({
  invoice: inv,
  share,
}: {
  invoice: InvoiceDetail
  share: ShareData
}) {
  const [shareOpen, setShareOpen] = React.useState(false)
  const [payOpen, setPayOpen] = React.useState(false)
  const [voidOpen, setVoidOpen] = React.useState(false)
  const [regenOpen, setRegenOpen] = React.useState(false)
  const [refreshOpen, setRefreshOpen] = React.useState(false)
  const [updating, setUpdating] = React.useState(false)
  const [link, setLink] = React.useState(inv.publicUrl)
  const open = inv.rawStatus === "issued" || inv.rawStatus === "sent"
  const voided = inv.rawStatus === "void"

  async function update() {
    setUpdating(true)
    const res = await attemptAction(() => updateFromSubscriptionAction(inv.id))
    setUpdating(false)
    if (res.ok) toast.success(`${inv.number} updated from the service`)
    else toast.error(res.error)
  }

  const full = "w-full justify-start max-md:h-11"

  return (
    <section
      aria-label="Invoice actions"
      className="rounded-lg border border-border bg-surface p-4 sm:p-5"
    >
      {inv.rawStatus === "paid" && inv.paidAt && (
        <p className="mb-4 flex items-center gap-2 text-sm text-green-fg">
          <CircleCheckIcon aria-hidden className="size-4" />
          Paid on {formatDatePK(inv.paidAt)}
        </p>
      )}
      {voided && (
        <p className="mb-4 text-sm text-ink-muted">
          Voided{inv.voidReason ? `: ${inv.voidReason}` : "."}
        </p>
      )}
      <div className="grid gap-2">
        {voided ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex rounded-md">
                <Button disabled className="w-full max-md:h-11">
                  <SendIcon />
                  Share invoice
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Void invoices can’t be shared</TooltipContent>
          </Tooltip>
        ) : (
          <Button className="w-full max-md:h-11" onClick={() => setShareOpen(true)}>
            <SendIcon />
            Share invoice
          </Button>
        )}
        <Button asChild variant="outline" className={full}>
          <a href={`/api/invoices/${inv.id}/pdf`} download>
            <DownloadIcon />
            Download PDF
          </a>
        </Button>
        <Button
          variant="outline"
          className={full}
          onClick={() => void copyInvoiceLink(link)}
        >
          <LinkIcon />
          Copy link
        </Button>
        {open && (
          <Button variant="outline" className={full} onClick={() => setPayOpen(true)}>
            <CircleCheckIcon />
            Mark as paid
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-1 border-t border-border pt-3">
        {open && (
          <Button
            variant="ghost"
            size="sm"
            className={full}
            loading={updating}
            onClick={() => void update()}
          >
            <RefreshCwIcon />
            Update from service
          </Button>
        )}
        {open && (
          <Button
            variant="ghost"
            size="sm"
            className={full}
            onClick={() => setRefreshOpen(true)}
          >
            <BuildingIcon />
            Refresh business details
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={full}
          onClick={() => setRegenOpen(true)}
        >
          <RotateCwIcon />
          Regenerate link
        </Button>
        {open && (
          <Button
            variant="ghost"
            size="sm"
            className={`${full} text-red-fg hover:text-red-fg`}
            onClick={() => setVoidOpen(true)}
          >
            <BanIcon />
            Void invoice
          </Button>
        )}
      </div>

      <ShareInvoiceDialog
        invoiceId={inv.id}
        data={share}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      <RenewDialog
        subscription={inv.subscription}
        invoice={{ number: inv.number, total: inv.total, currency: inv.currency }}
        open={payOpen}
        onOpenChange={setPayOpen}
      />
      <VoidInvoiceDialog
        invoice={{ id: inv.id, number: inv.number }}
        open={voidOpen}
        onOpenChange={setVoidOpen}
      />
      <ConfirmDialog
        open={refreshOpen}
        onOpenChange={setRefreshOpen}
        title="Refresh business details?"
        description="This invoice will use your current business name, address, NTN, logo, payment instructions and footer from Settings. The number, amounts and client details don’t change."
        confirmLabel="Refresh details"
        destructive={false}
        onConfirm={async () => {
          const res = await attemptAction(() => refreshBusinessDetailsAction(inv.id))
          if (!res.ok) {
            toast.error(res.error)
            return false
          }
          toast.success(`${inv.number} now uses your current business details`)
        }}
      />
      <ConfirmDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerate the invoice link?"
        description="The current link stops working at once. Anyone who should see the invoice will need the new link."
        confirmLabel="Regenerate link"
        destructive={false}
        onConfirm={async () => {
          const res = await attemptAction(() => regenerateLinkAction(inv.id))
          if (!res.ok || !res.data) {
            toast.error(res.ok ? "Couldn’t regenerate the link." : res.error)
            return false
          }
          setLink(res.data.url)
          toast.success("New link created. The old one no longer works.")
        }}
      />
    </section>
  )
}
