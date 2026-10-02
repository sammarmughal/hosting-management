"use client"

import * as React from "react"
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react"

import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

/**
 * A list's search box, debounced 300 ms. `value` comes from the URL and
 * `onSearch` writes it back. Marked for the "/" shortcut, which focuses it
 * instead of the topbar search.
 */
export function SearchField({
  value,
  onSearch,
  pending = false,
  label,
  placeholder,
  className,
}: {
  value: string
  onSearch: (term: string) => void
  pending?: boolean
  label: string
  placeholder: string
  className?: string
}) {
  const [q, setQ] = React.useState(value)
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (label === "Search clients" && new URLSearchParams(window.location.search).get("focus") === "search") {
      inputRef.current?.focus()
    }
  }, [label])
  // What we last pushed, and the URL value we last saw. When the URL changes
  // for another reason (e.g. Clear filters), the input follows it.
  const [pushed, setPushed] = React.useState(value)
  const [seen, setSeen] = React.useState(value)
  if (value !== seen) {
    setSeen(value)
    if (value !== pushed) {
      setQ(value)
      setPushed(value)
    }
  }

  React.useEffect(() => {
    const term = q.trim()
    if (term === value) return
    const timer = setTimeout(() => {
      setPushed(term)
      onSearch(term)
    }, 300)
    return () => clearTimeout(timer)
  }, [q, value, onSearch])

  return (
    <div role="search" className={cn("relative", className)}>
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
      />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            if (q) setQ("")
            else e.currentTarget.blur()
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        data-search-shortcut
        autoComplete="off"
        className="h-9 w-full rounded-md border border-input bg-surface pr-12 pl-9 text-md text-ink transition-[border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-ink-subtle hover:border-ink-subtle/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 max-md:h-11 md:pr-9 md:text-base [&::-webkit-search-cancel-button]:hidden"
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
            className="flex size-6 items-center justify-center rounded-sm text-ink-subtle outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/40 max-md:size-11"
          >
            <XIcon className="size-4" />
          </button>
        ) : (
          <Kbd className="mr-0.5 max-md:hidden">/</Kbd>
        )}
      </span>
    </div>
  )
}
