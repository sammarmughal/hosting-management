import { XIcon } from "lucide-react"
import Link from "next/link"

import { STATUS_DOT } from "@/components/status-badge"
import {
  clientsHref,
  EXTRA_FILTER_LABEL,
  FILTER_CHIPS,
  type ClientsParams,
  type ServiceFilter,
} from "@/lib/service-filters"
import { cn } from "@/lib/utils"

/**
 * Segmented status filter with counts (docs/06 §4.5). Plain links, so each
 * view has its own URL. Scrolls sideways inside itself on narrow screens.
 */
export function FilterChips({
  params,
  counts,
}: {
  params: ClientsParams
  counts: Record<ServiceFilter, number>
}) {
  const extra = EXTRA_FILTER_LABEL[params.filter]

  return (
    <div className="-mx-4 flex scrollbar-none items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <nav
        aria-label="Filter by status"
        className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-surface-subtle p-0.5"
      >
        {FILTER_CHIPS.map((chip) => {
          const active = params.filter === chip.value
          return (
            <Link
              key={chip.value}
              href={clientsHref(params, { filter: chip.value })}
              aria-current={active ? "page" : undefined}
              scroll={false}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-sm whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                active
                  ? "bg-surface font-medium text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              {chip.dot && (
                <span aria-hidden className={cn("status-dot", STATUS_DOT[chip.dot])} />
              )}
              {chip.label}
              <span
                className={cn(
                  "tabular-nums",
                  active ? "text-ink-muted" : "text-ink-subtle"
                )}
              >
                {counts[chip.value]}
              </span>
            </Link>
          )
        })}
      </nav>

      {extra && (
        <Link
          href={clientsHref(params, { filter: "all" })}
          scroll={false}
          aria-label={`Remove filter: ${extra}`}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-sm font-medium whitespace-nowrap text-ink outline-none hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          {extra}
          <span className="text-ink-muted tabular-nums">{counts[params.filter]}</span>
          <XIcon aria-hidden className="size-3.5 text-ink-muted" />
        </Link>
      )}
    </div>
  )
}
