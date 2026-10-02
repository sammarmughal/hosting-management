"use client"

import * as React from "react"
import { MoreHorizontalIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDatePK } from "@/lib/domain/dates"
import { formatMoney } from "@/lib/domain/money"
import { deletePaymentAction } from "@/lib/mock/actions"
import { cn } from "@/lib/utils"
import type { PaymentRow } from "@/types/view"

const period = (p: PaymentRow) =>
  `${formatDatePK(p.periodFrom)} → ${formatDatePK(p.periodTo)}`

/**
 * Payments (docs/06 §4.7 and §4.10), with Delete in a ⋯ menu. The
 * Payments page shows client and domain with a separate Reference column;
 * a client page shows the domain only when there's more than one service.
 */
export function PaymentsTable({
  rows,
  showClient = false,
  showDomain,
  separateReference = false,
}: {
  rows: PaymentRow[]
  showClient?: boolean
  showDomain: boolean
  /** Reference in its own desktop column (else under the method). */
  separateReference?: boolean
}) {
  const [deleting, setDeleting] = React.useState<PaymentRow | null>(null)
  const [open, setOpen] = React.useState(false)
  const askDelete = (p: PaymentRow) => {
    setDeleting(p)
    setOpen(true)
  }

  return (
    <div className="@container">
      <div className={cn("hidden", showClient ? "@min-[1100px]:block" : showDomain ? "@min-[800px]:block" : "@min-[700px]:block")}>
        <Table
          className={cn(showClient && separateReference && "min-w-[1100px] table-fixed")}
        >
          {showClient && showDomain && separateReference && (
            <colgroup>
              {[10, 14, 14, 12, 10, 13, 22, 5].map((width, i) => (
                <col key={i} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
          )}
          <TableHeader>
            <TableRow>
              <TableHead>Paid on</TableHead>
              {showClient && <TableHead>Client</TableHead>}
              {showDomain && <TableHead>Domain</TableHead>}
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className={cn(!separateReference && "w-full")}>Method</TableHead>
              {separateReference && <TableHead>Reference</TableHead>}
              <TableHead>Period</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} className="group/row">
                <TableCell>{formatDatePK(p.paidOn)}</TableCell>
                {showClient && (
                  <TableCell>
                    <div className="max-w-full truncate font-medium" title={p.clientName}>
                      {p.clientName}
                    </div>
                  </TableCell>
                )}
                {showDomain && (
                  <TableCell>
                    <div className="max-w-full truncate" title={p.domain}>
                      {p.domain}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-right font-mono">
                  {formatMoney(p.amount, p.currency)}
                </TableCell>
                <TableCell>
                  <div>{p.method}</div>
                  {p.reference && (
                    <div
                      className={cn(
                        "max-w-48 truncate text-xs text-ink-muted",
                        separateReference && "hidden"
                      )}
                      title={p.reference}
                    >
                      {p.reference}
                    </div>
                  )}
                </TableCell>
                {separateReference && (
                  <TableCell>
                    <div
                      className="max-w-full truncate text-ink-muted"
                      title={p.reference ?? undefined}
                    >
                      {p.reference ?? "—"}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-ink-muted">{period(p)}</TableCell>
                <TableCell className="text-right">
                  <RowMenu payment={p} onDelete={askDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className={cn("divide-y divide-border", showClient ? "@min-[1100px]:hidden" : showDomain ? "@min-[800px]:hidden" : "@min-[700px]:hidden")}>
        {rows.map((p) => (
          <li key={p.id} className="flex gap-2 p-4 sm:p-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium font-mono">{formatMoney(p.amount, p.currency)}</span>
                <span className="shrink-0 text-sm text-ink-muted">
                  {formatDatePK(p.paidOn)}
                </span>
              </div>
              {showClient && (
                <div title={p.clientName} className="mt-1 truncate text-sm">{p.clientName}</div>
              )}
              <div title={`${p.method} ? ${p.reference ?? ""}`} className="mt-1 truncate text-sm text-ink-muted">
                {p.method}
                {p.reference ? ` · ${p.reference}` : ""}
              </div>
              {showDomain && (
                <div className="mt-1 truncate text-sm text-ink-muted" title={p.domain}>
                  {p.domain}
                </div>
              )}
              <div className="mt-1 text-xs text-ink-muted">{period(p)}</div>
            </div>
            <RowMenu payment={p} onDelete={askDelete} touch />
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={
          deleting
            ? `Delete this ${formatMoney(deleting.amount, deleting.currency)} payment?`
            : ""
        }
        description={
          deleting && (
            <>
              This removes the payment record only. It does{" "}
              <b className="font-medium text-ink">not</b> roll back the renewal date of{" "}
              {deleting.domain}.{" "}
              <Link
                href={`/services/${deleting.serviceId}/edit`}
                className="font-medium text-brand-700 underline-offset-3 hover:underline"
              >
                Edit the service
              </Link>{" "}
              if the date should move back.
            </>
          )
        }
        confirmLabel="Delete payment"
        onConfirm={async () => {
          if (!deleting) return
          const res = await deletePaymentAction(deleting.id)
          if (!res.ok) {
            toast.error(res.error)
            return false
          }
          toast.success("Payment deleted")
        }}
      />
    </div>
  )
}

function RowMenu({
  payment,
  onDelete,
  touch = false,
}: {
  payment: PaymentRow
  onDelete: (p: PaymentRow) => void
  touch?: boolean
}) {
  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={touch ? "icon" : "icon-sm"}
              aria-label={`Actions for the ${formatDatePK(payment.paidOn)} payment`}
              className={cn(
                "text-ink-muted",
                touch
                  ? "-mt-1 -mr-2 size-11 shrink-0"
                  : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
              )}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(payment)}>
          <Trash2Icon />
          Delete payment
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
