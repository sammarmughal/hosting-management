"use client"

import * as React from "react"

import { DateRangeFilter } from "@/components/filters/date-range-filter"
import { FilterSelect } from "@/components/filters/filter-select"
import { SearchField } from "@/components/filters/search-field"
import { useUrlParams } from "@/components/filters/use-url-params"
import type { InvoiceFilter, InvoiceParams } from "@/lib/list-filters"
import { cn } from "@/lib/utils"

const STATUSES: { value: InvoiceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
]

/** Status, search, currency and issue-date range, all in the URL (docs/13 §11). */
export function InvoicesToolbar({
  params,
  currencies,
}: {
  params: InvoiceParams
  currencies: string[]
}) {
  const { update, pending } = useUrlParams()
  const onSearch = React.useCallback((q: string) => update({ q }), [update])

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex scrollbar-none overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div
          role="radiogroup"
          aria-label="Filter by status"
          className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-surface-subtle p-0.5"
        >
          {STATUSES.map((s) => {
            const active = params.status === s.value
            return (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => update({ status: s.value === "all" ? null : s.value })}
                className={cn(
                  "inline-flex h-8 items-center rounded-sm px-2.5 text-sm whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 max-md:h-11",
                  active ? "bg-surface font-medium text-ink shadow-xs" : "text-ink-muted hover:text-ink"
                )}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchField
          value={params.q}
          onSearch={onSearch}
          pending={pending}
          label="Search invoices"
          placeholder="Search number, client, domain…"
          className="flex-1 lg:max-w-sm"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto">
          {currencies.length > 1 && (
            <FilterSelect
              label="Currency"
              value={params.currency}
              onChange={(currency) => update({ currency })}
              anyLabel="All"
              options={currencies.map((c) => ({ value: c, label: c }))}
              className="sm:w-40"
            />
          )}
          <DateRangeFilter from={params.from} to={params.to} onChange={(range) => update(range)} />
        </div>
      </div>
    </div>
  )
}
