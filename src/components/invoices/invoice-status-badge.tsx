import { FileTextIcon } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { INVOICE_STATUS_LABEL, type InvoiceDisplayStatus } from "@/lib/domain/invoices"
import { cn } from "@/lib/utils"
import type { InvoiceChip as InvoiceChipData } from "@/types/view"

// docs/12 §3: colour only where the status means something. Unpaid and sent
// stay neutral; overdue is red, paid green, void grey.
const VARIANT = {
  unpaid: "neutral",
  sent: "brand",
  overdue: "red",
  paid: "green",
  void: "cancelled",
} as const satisfies Record<InvoiceDisplayStatus, string>

const DOT: Partial<Record<InvoiceDisplayStatus, string>> = {
  overdue: "bg-red",
  paid: "bg-green",
}

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceDisplayStatus
  className?: string
}) {
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {DOT[status] && <span aria-hidden className={cn("status-dot", DOT[status])} />}
      {INVOICE_STATUS_LABEL[status]}
    </Badge>
  )
}

/** "INV-2026-0012 · Unpaid", linking to the invoice (docs/13 §10–§11). */
export function InvoiceChip({
  invoice,
  className,
}: {
  invoice: InvoiceChipData
  className?: string
}) {
  return (
    <Badge asChild variant="outline" className={cn("gap-1.5 text-ink", className)}>
      <Link
        href={`/invoices/${invoice.id}`}
        title={`Open invoice ${invoice.number}`}
        className="outline-none hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <FileTextIcon aria-hidden className="text-ink-muted" />
        <span className="font-mono">{invoice.number}</span>
        <span aria-hidden className="text-ink-subtle">
          ·
        </span>
        <span
          className={cn(
            invoice.status === "overdue" && "text-red-fg",
            invoice.status === "paid" && "text-green-fg",
            (invoice.status === "unpaid" || invoice.status === "sent" || invoice.status === "void") &&
              "text-ink-muted"
          )}
        >
          {INVOICE_STATUS_LABEL[invoice.status]}
        </span>
      </Link>
    </Badge>
  )
}
