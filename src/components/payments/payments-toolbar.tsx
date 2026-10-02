"use client"

import * as React from "react"

import { DateRangeFilter } from "@/components/filters/date-range-filter"
import { SearchField } from "@/components/filters/search-field"
import { useUrlParams } from "@/components/filters/use-url-params"
import type { PaymentParams } from "@/lib/list-filters"

/** Search and date range for payments; both in the URL. */
export function PaymentsToolbar({ params }: { params: PaymentParams }) {
  const { update, pending } = useUrlParams()
  const onSearch = React.useCallback((q: string) => update({ q }), [update])

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <SearchField
        value={params.q}
        onSearch={onSearch}
        pending={pending}
        label="Search payments"
        placeholder="Search client, domain, reference…"
        className="flex-1 md:max-w-sm"
      />
      <DateRangeFilter
        from={params.from}
        to={params.to}
        onChange={(range) => update(range)}
        className="md:ml-auto"
      />
    </div>
  )
}
