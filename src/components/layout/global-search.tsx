"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

export const GLOBAL_SEARCH_ID = "global-search"

/** Topbar search. Submits to the clients list; "/" focuses it. */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter()
  const [q, setQ] = React.useState("")

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault()
        const term = q.trim()
        router.push(term ? `/clients?q=${encodeURIComponent(term)}` : "/clients")
      }}
    >
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
      />
      <input
        id={GLOBAL_SEARCH_ID}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.currentTarget.blur()
        }}
        placeholder="Search clients…"
        aria-label="Search clients, domains, emails and phones"
        autoComplete="off"
        className="peer h-9 w-full rounded-md border border-input bg-surface pr-9 pl-9 text-base text-ink transition-[border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-ink-subtle hover:border-ink-subtle/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
      />
      <Kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 peer-focus:hidden peer-[:not(:placeholder-shown)]:hidden">
        /
      </Kbd>
    </form>
  )
}
