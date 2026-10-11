import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge"
import { formatDatePK } from "@/lib/domain/dates"
import { hasPaymentInstructions } from "@/lib/domain/invoices"
import { formatAmount, formatMoney, toCents } from "@/lib/domain/money"
import { formatPhone } from "@/lib/domain/whatsapp"
import { cn } from "@/lib/utils"
import type { InvoiceDocumentData } from "@/types/view"

/**
 * The invoice as HTML (docs/13 §7 layout, docs/12 visuals): the detail page
 * preview and the public /i/[token] page. The PDF (lib/server/invoice-pdf)
 * follows the same structure. Values come from the invoice's snapshots.
 */
export function InvoiceDocument({
  invoice: inv,
  className,
}: {
  invoice: InvoiceDocumentData
  className?: string
}) {
  const s = inv.seller
  const b = inv.billTo
  const hasDiscount = toCents(inv.discount) > 0n
  const hasTax = toCents(inv.taxAmount) > 0n
  const payment = hasPaymentInstructions(s)

  return (
    <article
      aria-label={`Invoice ${inv.number}`}
      className={cn(
        "min-w-0 rounded-lg border border-border bg-surface p-5 text-base text-ink sm:p-8",
        className
      )}
    >
      {/* 1. Seller | Invoice title, number, dates, status */}
      <header className="flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          {s.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logo} alt="" className="mb-3 h-10 w-auto max-w-40 object-contain" />
          )}
          <p className="font-semibold break-words">{s.businessName}</p>
          <div className="mt-1 space-y-0.5 text-sm text-ink-muted">
            {s.address && <p className="whitespace-pre-line">{s.address}</p>}
            {s.phone && <p>{s.phone}</p>}
            {s.email && <p className="break-all">{s.email}</p>}
            {s.ntn && <p>NTN {s.ntn}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <h2 className="text-xl font-semibold tracking-[-0.01em] text-brand-700">Invoice</h2>
          <p className="mt-1 font-mono text-sm">{inv.number}</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm sm:justify-end">
            <dt className="text-ink-muted">Issue date</dt>
            <dd className="tabular-nums">{formatDatePK(inv.issueDate)}</dd>
            <dt className="text-ink-muted">Due date</dt>
            <dd className="tabular-nums">{formatDatePK(inv.dueDate)}</dd>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
            <InvoiceStatusBadge status={inv.status} />
            {inv.status === "paid" && inv.paidAt && (
              <span className="text-sm font-medium text-green-fg">
                Paid on {formatDatePK(inv.paidAt)}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 2. Bill to */}
      <section aria-label="Bill to" className="mt-8 border-t border-border pt-5">
        <h3 className="text-xs font-medium text-ink-muted">Bill to</h3>
        <p className="mt-1 font-medium break-words">{b.name}</p>
        <div className="mt-0.5 space-y-0.5 text-sm text-ink-muted">
          {b.company && <p className="break-words">{b.company}</p>}
          {b.email && <p className="break-all">{b.email}</p>}
          {b.phone && <p>{formatPhone(b.phone)}</p>}
          {b.address && <p className="whitespace-pre-line">{b.address}</p>}
        </div>
      </section>

      {/* 3. Items */}
      <section aria-label="Items" className="mt-8">
        <div className="hidden grid-cols-[minmax(0,1fr)_auto_3rem_8rem] gap-4 border-b border-border pb-2 text-xs font-medium text-ink-muted sm:grid">
          <span>Description</span>
          <span>Period</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Amount</span>
        </div>
        <ul>
          {inv.items.map((it) => (
            <li
              key={it.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-border py-3 sm:grid-cols-[minmax(0,1fr)_auto_3rem_8rem] sm:items-baseline"
            >
              <span className="break-words">{it.description}</span>
              <span className="order-3 col-span-2 text-sm text-ink-muted sm:order-none sm:col-span-1">
                {it.periodLabel}
              </span>
              <span className="hidden text-right tabular-nums sm:block">{it.quantity}</span>
              <span className="text-right font-mono tabular-nums">
                {formatMoney(it.amount, inv.currency)}
              </span>
            </li>
          ))}
        </ul>

        {/* 4. Totals */}
        <dl className="mt-4 ml-auto flex w-full max-w-72 flex-col gap-1.5 text-sm">
          <TotalRow label="Subtotal">{formatAmount(inv.subtotal)}</TotalRow>
          {hasDiscount && <TotalRow label="Discount">−{formatAmount(inv.discount)}</TotalRow>}
          {hasTax && (
            <TotalRow label={`Tax (${formatAmount(inv.taxRate)}%)`}>{formatAmount(inv.taxAmount)}</TotalRow>
          )}
          {/* One continuous rule above the total. */}
          <TotalRow label="Total" grand>
            {formatMoney(inv.total, inv.currency)}
          </TotalRow>
        </dl>
      </section>

      {/* 5. Payment instructions */}
      {payment && (
        <section
          aria-label="Payment instructions"
          className="mt-8 rounded-md border border-border bg-surface-subtle px-4 py-3 text-sm"
        >
          <h3 className="font-medium">Payment instructions</h3>
          {/* Stacked on phones so account numbers never break mid-word. */}
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-1">
            {(
              [
                ["Bank", s.payment.bankName],
                ["Account title", s.payment.accountTitle],
                ["Account / IBAN", s.payment.accountNumber],
                ["JazzCash / Easypaisa", s.payment.wallet],
              ] as const
            )
              .filter(([, v]) => v.trim() !== "")
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-muted max-sm:mt-1.5 max-sm:text-xs">{label}</dt>
                  <dd className="font-mono wrap-break-word">{value}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      {/* 6. Footer note (below) */}
      {(inv.notes || s.footer) && (
        <footer className="mt-6 space-y-1 text-sm text-ink-muted">
          {inv.notes && <p className="whitespace-pre-line">{inv.notes}</p>}
          {s.footer && <p className="whitespace-pre-line">{s.footer}</p>}
        </footer>
      )}
    </article>
  )
}

function TotalRow({
  label,
  grand = false,
  children,
}: {
  label: string
  grand?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-6",
        grand && "mt-1 border-t border-border pt-2 font-semibold"
      )}
    >
      <dt className={grand ? undefined : "text-ink-muted"}>{label}</dt>
      <dd className="text-right font-mono tabular-nums">{children}</dd>
    </div>
  )
}
