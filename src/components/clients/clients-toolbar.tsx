"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { FilterSelect } from "@/components/filters/filter-select"
import { SearchField } from "@/components/filters/search-field"
import {
  clientsHref,
  SORT_OPTIONS,
  type ClientsParams,
  type ServiceSort,
} from "@/lib/service-filters"
import { cn } from "@/lib/utils"

/**
 * Search, "Renews in" month and Sort. Every change is written to the URL
 * (via clientsHref, which omits defaults), so the server renders the result
 * and the view can be shared or refreshed.
 */
export function ClientsToolbar({
  params,
  months,
  className,
}: {
  params: ClientsParams
  months: { value: string; label: string }[]
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  const navigate = React.useCallback(
    (patch: Partial<ClientsParams>) => {
      startTransition(() => {
        router.replace(clientsHref(params, patch), { scroll: false })
      })
    },
    [params, router]
  )
  const onSearch = React.useCallback((q: string) => navigate({ q }), [navigate])

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <SearchField
        value={params.q}
        onSearch={onSearch}
        pending={pending}
        label="Search clients"
        placeholder="Search name, email, phone, domain…"
        className="flex-1 sm:max-w-sm"
      />
      <div className="flex gap-2 sm:ml-auto">
        <FilterSelect
          label="Renews in"
          value={params.month}
          onChange={(month) => navigate({ month })}
          anyLabel="Any month"
          options={months}
          className="flex-1 sm:w-48 sm:flex-none"
        />
        <FilterSelect
          label="Sort"
          value={params.sort}
          onChange={(v) => navigate({ sort: v as ServiceSort })}
          options={SORT_OPTIONS}
          className="flex-1 sm:w-48 sm:flex-none"
        />
      </div>
    </div>
  )
}
