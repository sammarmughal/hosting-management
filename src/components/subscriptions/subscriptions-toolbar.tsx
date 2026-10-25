"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { FilterSelect } from "@/components/filters/filter-select"
import { SearchField } from "@/components/filters/search-field"
import {
  SORT_OPTIONS,
  subscriptionsHref,
  type SubscriptionSort,
  type SubscriptionsParams,
} from "@/lib/subscription-filters"
import { cn } from "@/lib/utils"
import type { Option } from "@/types/view"

const toOptions = (items: Option[]) =>
  items.map((o) => ({ value: String(o.id), label: o.label }))

/**
 * Search, Company, Service, "Renews in" month and Sort (docs/14 §4). Every
 * change is written to the URL (via subscriptionsHref, which omits defaults),
 * so the server renders the result and the view can be shared or refreshed.
 */
export function SubscriptionsToolbar({
  params,
  months,
  companies,
  serviceTypes,
  className,
}: {
  params: SubscriptionsParams
  months: { value: string; label: string }[]
  companies: Option[]
  serviceTypes: Option[]
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  const navigate = React.useCallback(
    (patch: Partial<SubscriptionsParams>) => {
      startTransition(() => {
        router.replace(subscriptionsHref(params, patch), { scroll: false })
      })
    },
    [params, router]
  )
  const onSearch = React.useCallback((q: string) => navigate({ q }), [navigate])

  return (
    <div className={cn("flex flex-col gap-2 lg:flex-row lg:items-center", className)}>
      <SearchField
        value={params.q}
        onSearch={onSearch}
        pending={pending}
        label="Search subscriptions"
        placeholder="Search domain, client, company, email, phone…"
        className="flex-1 lg:max-w-sm"
      />
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:ml-auto lg:flex-nowrap">
        {companies.length > 0 && (
          <FilterSelect
            label="Company"
            value={params.company ? String(params.company) : ""}
            onChange={(v) => navigate({ company: Number(v) || 0 })}
            anyLabel="All"
            options={toOptions(companies)}
            className="sm:w-48"
          />
        )}
        <FilterSelect
          label="Service"
          value={params.service ? String(params.service) : ""}
          onChange={(v) => navigate({ service: Number(v) || 0 })}
          anyLabel="All"
          options={toOptions(serviceTypes)}
          className="sm:w-48"
        />
        <FilterSelect
          label="Renews in"
          value={params.month}
          onChange={(month) => navigate({ month })}
          anyLabel="Any month"
          options={months}
          className="sm:w-44"
        />
        <FilterSelect
          label="Sort"
          value={params.sort}
          onChange={(v) => navigate({ sort: v as SubscriptionSort })}
          options={SORT_OPTIONS}
          className="sm:w-48"
        />
      </div>
    </div>
  )
}
