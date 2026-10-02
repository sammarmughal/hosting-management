import Link from "next/link"

import { STATUS_DOT } from "@/components/status-badge"
import { cn } from "@/lib/utils"
import type { Colour } from "@/types/view"

// docs/12 §5: label (13, muted, status dot) → value (28, 600, ink) →
// optional sub-line. The whole card is a link; no icons, no colour on
// the number.
export function StatCard({
  label,
  value,
  sub,
  href,
  dot,
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  href: string
  dot?: Colour
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-0 flex-col rounded-lg border border-border bg-surface p-4 transition-colors duration-150 ease-out outline-none hover:border-line-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 sm:p-5",
        className
      )}
    >
      <span className="flex items-center gap-2 text-sm text-ink-muted">
        {dot && <span aria-hidden className={cn("status-dot", STATUS_DOT[dot])} />}
        <span className="min-h-10 sm:min-h-0" title={label}>
          {label}
        </span>
      </span>
      <span className="mt-2 truncate text-2xl font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </span>
      {sub && <span className="mt-1 truncate text-xs text-ink-muted">{sub}</span>}
    </Link>
  )
}

/** "PKR 86,500" with a quieter currency code, so it fits narrow cards. */
export function MoneyValue({ currency, amount }: { currency: string; amount: string }) {
  return (
    <>
      <span className="mr-1 text-base font-medium text-ink-muted">{currency}</span>
      {amount}
    </>
  )
}
