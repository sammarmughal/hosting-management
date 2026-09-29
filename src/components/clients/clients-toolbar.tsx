"use client"

import * as React from "react"
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  clientsHref,
  SORT_OPTIONS,
  type ClientsParams,
  type ServiceSort,
} from "@/lib/service-filters"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

const ANY_MONTH = "any"

/**
 * Search (debounced 300 ms), "Renews in" month and Sort. Every change is
 * written to the URL (router.replace), so the server renders the result and
 * the view can be shared or refreshed.
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
  const [q, setQ] = React.useState(params.q)
  // What this component last pushed, and the URL value we last saw. When the
  // URL changes for another reason (e.g. Clear filters), the input follows it.
  const [pushed, setPushed] = React.useState(params.q)
  const [seen, setSeen] = React.useState(params.q)
  if (params.q !== seen) {
    setSeen(params.q)
    if (params.q !== pushed) {
      setQ(params.q)
      setPushed(params.q)
    }
  }

  const navigate = React.useCallback(
    (patch: Partial<ClientsParams>) => {
      startTransition(() => {
        router.replace(clientsHref(params, patch), { scroll: false })
      })
    },
    [params, router]
  )

  React.useEffect(() => {
    const term = q.trim()
    if (term === params.q) return
    const timer = setTimeout(() => {
      setPushed(term)
      navigate({ q: term })
    }, 300)
    return () => clearTimeout(timer)
  }, [q, params.q, navigate])

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <div role="search" className="relative flex-1 sm:max-w-sm">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && q) {
              e.preventDefault()
              setQ("")
            }
          }}
          placeholder="Search name, email, phone, domain…"
          aria-label="Search clients"
          data-search-shortcut
          autoComplete="off"
          className="h-9 w-full rounded-md border border-input bg-surface pr-9 pl-9 text-md text-ink transition-[border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-ink-subtle hover:border-ink-subtle/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 md:text-base [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
          {pending ? (
            <Loader2Icon
              aria-label="Loading"
              className="mr-1 size-4 animate-spin text-ink-subtle"
            />
          ) : q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="flex size-6 items-center justify-center rounded-sm text-ink-subtle outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <XIcon className="size-4" />
            </button>
          ) : (
            <Kbd className="mr-0.5 max-md:hidden">/</Kbd>
          )}
        </span>
      </div>

      <div className="flex gap-2 sm:ml-auto">
        <Select
          value={params.month || ANY_MONTH}
          onValueChange={(v) => navigate({ month: v === ANY_MONTH ? "" : v })}
        >
          <SelectTrigger
            aria-label="Renews in"
            className="min-w-0 flex-1 sm:w-48 sm:flex-none"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 text-ink-muted">Renews in</span>
              <span className="truncate">
                <SelectValue />
              </span>
            </span>
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            <SelectItem value={ANY_MONTH}>Any month</SelectItem>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={params.sort}
          onValueChange={(v) => navigate({ sort: v as ServiceSort })}
        >
          <SelectTrigger
            aria-label="Sort"
            className="min-w-0 flex-1 sm:w-48 sm:flex-none"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 text-ink-muted">Sort</span>
              <span className="truncate">
                <SelectValue />
              </span>
            </span>
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
