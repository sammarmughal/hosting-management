"use client"

import * as React from "react"

import { SearchField } from "@/components/filters/search-field"
import { useUrlParams } from "@/components/filters/use-url-params"
import type { ClientListParams } from "@/lib/list-filters"

/** Search for the client list; in the URL. */
export function ClientsToolbar({ params }: { params: ClientListParams }) {
  const { update, pending } = useUrlParams()
  const onSearch = React.useCallback((q: string) => update({ q }), [update])
  return (
    <SearchField
      value={params.q}
      onSearch={onSearch}
      pending={pending}
      label="Search clients"
      placeholder="Search name, email, phone, company, domain…"
      className="sm:max-w-sm"
    />
  )
}
