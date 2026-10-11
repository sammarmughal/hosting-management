"use client"

import * as React from "react"
import {
  BanIcon,
  CircleCheckIcon,
  DownloadIcon,
  EyeIcon,
  LinkIcon,
  MoreHorizontalIcon,
  SendIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge"
import { useInvoiceDialogs, type InvoiceRef } from "@/components/invoices/use-invoice-dialogs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { cn } from "@/lib/utils"
import type { InvoiceRow } from "@/types/view"

export async function copyInvoiceLink(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success("Invoice link copied")
  } catch {
    toast.error("Couldn’t copy the link", { description: url })
  }
}

const ref = (i: InvoiceRow): InvoiceRef => ({
  id: i.id,
  number: i.number,
  total: i.total,
  currency: i.currency,
})

/**
 * Invoices (docs/13 §11): Number, Client, Domain, Issue date, Due date,
 * Amount, Status, ⋯. The row opens the invoice. Cards on narrow screens.
 * `showClient` is off on the client page's Invoices tab.
 */
export function InvoicesTable({
  rows,
  showClient = true,
}: {
  rows: InvoiceRow[]
  showClient?: boolean
}) {
  const router = useRouter()
  const { openShare, openVoid, openPay, dialogs } = useInvoiceDialogs()
  const menu = (i: InvoiceRow, touch = false) => (
    <RowMenu
      invoice={i}
      touch={touch}
      onShare={() => openShare(ref(i))}
      onPay={() => void openPay(ref(i))}
      onVoid={() => openVoid(ref(i))}
    />
  )

  return (
    <div className="@container">
      <div className={cn("hidden", showClient ? "@min-[960px]:block" : "@min-[720px]:block")}>
        <Table className="table-fixed">
          <colgroup>
            <col style={{ width: "15%" }} />
            {showClient && <col style={{ width: "22%" }} />}
            <col style={{ width: showClient ? "16%" : "24%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "3.5rem" }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              {showClient && <TableHead>Client</TableHead>}
              <TableHead>Domain</TableHead>
              <TableHead>Issue date</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((i) => (
              <TableRow
                key={i.id}
                className="group/row cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a,button,[role=menuitem]")) return
                  router.push(`/invoices/${i.id}`)
                }}
              >
                <TableCell>
                  <Link
                    href={`/invoices/${i.id}`}
                    className="rounded-sm font-mono text-sm text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
                  >
                    {i.number}
                  </Link>
                </TableCell>
                {showClient && (
                  <TableCell>
                    <div className="truncate font-medium" title={i.clientName}>
                      {i.clientName}
                    </div>
                    {(i.company || i.email) && (
                      <div className="truncate text-xs text-ink-muted" title={i.company ?? i.email ?? undefined}>
                        {i.company ?? i.email}
                      </div>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <div className="truncate" title={i.domain}>
                    {i.domain}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{formatDatePK(i.issueDate)}</TableCell>
                <TableCell className={cn("tabular-nums", i.status === "overdue" && "text-red-fg")}>
                  {formatDatePK(i.dueDate)}
                </TableCell>
                <TableCell className="text-right font-mono">{formatMoney(i.total, i.currency)}</TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={i.status} />
                </TableCell>
                <TableCell className="text-right">{menu(i)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className={cn("divide-y divide-border", showClient ? "@min-[960px]:hidden" : "@min-[720px]:hidden")}>
        {rows.map((i) => (
          <li key={i.id} className="flex gap-2 p-4 sm:p-5">
            <Link
              href={`/invoices/${i.id}`}
              // data-slot opts out of the mobile inline-link touch rule in globals.css.
              data-slot="invoice-card"
              className="block min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm">{i.number}</span>
                <InvoiceStatusBadge status={i.status} />
              </div>
              {showClient && (
                <div className="mt-1.5 truncate font-medium" title={i.clientName}>
                  {i.clientName}
                </div>
              )}
              <div className="mt-0.5 truncate text-sm text-ink-muted" title={i.domain}>
                {i.domain}
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span className={cn("text-xs text-ink-muted", i.status === "overdue" && "text-red-fg")}>
                  Due {formatDatePK(i.dueDate)}
                </span>
                <span className="font-mono text-sm font-medium">{formatMoney(i.total, i.currency)}</span>
              </div>
            </Link>
            {menu(i, true)}
          </li>
        ))}
      </ul>
      {dialogs}
    </div>
  )
}

function RowMenu({
  invoice: i,
  touch,
  onShare,
  onPay,
  onVoid,
}: {
  invoice: InvoiceRow
  touch: boolean
  onShare: () => void
  onPay: () => void
  onVoid: () => void
}) {
  const open = i.rawStatus === "issued" || i.rawStatus === "sent"
  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={touch ? "icon" : "icon-sm"}
              aria-label={`Actions for invoice ${i.number}`}
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
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem asChild>
          <Link href={`/invoices/${i.id}`}>
            <EyeIcon />
            View
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/api/invoices/${i.id}/pdf`} download>
            <DownloadIcon />
            Download PDF
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={i.rawStatus === "void"} onSelect={onShare}>
          <SendIcon />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copyInvoiceLink(i.publicUrl)}>
          <LinkIcon />
          Copy link
        </DropdownMenuItem>
        {open && (
          <>
            <DropdownMenuItem onSelect={onPay}>
              <CircleCheckIcon />
              Mark as paid
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onVoid}>
              <BanIcon />
              Void
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
