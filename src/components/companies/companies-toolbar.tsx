"use client"

import * as React from "react"

import { FilterSelect } from "@/components/filters/filter-select"
import { SearchField } from "@/components/filters/search-field"
import { useUrlParams } from "@/components/filters/use-url-params"
import type { CompanyListParams } from "@/lib/list-filters"
import type { Option } from "@/types/view"

/** Search and a client filter for /companies (docs/14 §3); both in the URL. */
export function CompaniesToolbar({
  params,
  clients,
}: {
  params: CompanyListParams
  clients: Option[]
}) {
  const { update, pending } = useUrlParams()
  const onSearch = React.useCallback((q: string) => update({ q }), [update])
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <SearchField
        value={params.q}
        onSearch={onSearch}
        pending={pending}
        label="Search companies"
        placeholder="Search company, client, email…"
        className="flex-1 sm:max-w-sm"
      />
      <FilterSelect
        label="Client"
        value={params.client ? String(params.client) : ""}
        onChange={(client) => update({ client })}
        anyLabel="All"
        options={clients.map((c) => ({ value: String(c.id), label: c.label }))}
        className="sm:ml-auto sm:w-64"
      />
    </div>
  )
}
