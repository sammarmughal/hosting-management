"use client"

import { useId, useMemo, useState } from "react"
import { LockIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react"

import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  currencyUseText,
  type CurrencyOption,
  type CurrencyUse,
} from "@/lib/domain/currency"

const selectClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-base max-md:h-11"

/**
 * Settings → Business: the enabled currencies (any ISO 4217 code, added from a
 * searchable list) and the default for new clients (docs/13 §6). A currency
 * used by a client or service, and the default, can't be removed.
 */
export function CurrencySettings({
  enabled,
  defaultCurrency,
  catalog,
  usage,
  onChange,
}: {
  enabled: string[]
  defaultCurrency: string
  /** Every ISO currency with its name, from the server (same text on both sides). */
  catalog: CurrencyOption[]
  usage: Record<string, CurrencyUse>
  onChange: (patch: { enabledCurrencies?: string[]; defaultCurrency?: string }) => void
}) {
  const names = useMemo(() => new Map(catalog.map((c) => [c.code, c.name])), [catalog])
  const label = (code: string) => {
    const name = names.get(code)
    return name && name !== code ? `${code} · ${name}` : code
  }

  return (
    <>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm leading-none font-medium">Currencies</legend>
        <ul className="divide-y divide-border rounded-md border border-border">
          {enabled.map((code) => {
            const used = currencyUseText(usage[code])
            const locked =
              code === defaultCurrency ? "The default currency can’t be removed" : used
            return (
              <li key={code} className="flex min-h-11 items-center gap-3 px-3 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    <span className="font-mono font-medium">{code}</span>
                    <span className="text-ink-muted"> · {names.get(code) ?? code}</span>
                  </span>
                  {used && <span className="block text-xs text-ink-subtle">{used}</span>}
                </span>
                {locked ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Disabled buttons get no pointer events, so the wrapper carries the tooltip. */}
                      <span tabIndex={0} className="inline-flex rounded-md">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled
                          aria-label={`Can’t remove ${code}: ${locked}`}
                        >
                          <LockIcon />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{locked}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${code}`}
                    onClick={() =>
                      onChange({ enabledCurrencies: enabled.filter((c) => c !== code) })
                    }
                  >
                    <XIcon />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        <div>
          <AddCurrency
            catalog={catalog}
            enabled={enabled}
            onAdd={(code) => onChange({ enabledCurrencies: [...enabled, code].sort() })}
          />
        </div>
        <p id="currencies-help" className="text-xs text-ink-muted">
          Offered on the client and service forms. Amounts are never converted between
          currencies. A currency in use, or the default, can’t be removed.
        </p>
      </fieldset>
      <FormField
        id="default-currency"
        label="Default currency"
        help="New clients start in it. Each client can have their own."
      >
        <select
          id="default-currency"
          className={selectClass}
          value={defaultCurrency}
          aria-describedby="default-currency-help"
          onChange={(e) => onChange({ defaultCurrency: e.target.value })}
        >
          {enabled.map((c) => (
            <option key={c} value={c}>
              {label(c)}
            </option>
          ))}
        </select>
      </FormField>
    </>
  )
}

/** "Add currency" → a popover with a search box over every ISO currency not yet on. */
function AddCurrency({
  catalog,
  enabled,
  onAdd,
}: {
  catalog: CurrencyOption[]
  enabled: string[]
  onAdd: (code: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const listId = useId()
  const q = query.trim().toLowerCase()
  const matches = catalog.filter(
    (c) =>
      !enabled.includes(c.code) &&
      (!q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
  )
  // Exact code matches first ("aed" → AED before currencies whose name contains it).
  matches.sort(
    (a, b) => Number(b.code.toLowerCase() === q) - Number(a.code.toLowerCase() === q)
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="max-md:h-11">
          <PlusIcon />
          Add currency
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] gap-2 p-2">
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle"
          />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              const first = matches[0]
              if (e.key === "Enter" && first) {
                e.preventDefault()
                onAdd(first.code)
                setOpen(false)
                setQuery("")
              }
            }}
            placeholder="Search by code or name"
            aria-label="Search currencies"
            aria-controls={listId}
            className="pl-8"
          />
        </div>
        <ul id={listId} aria-label="Currencies" className="max-h-64 overflow-y-auto">
          {matches.length === 0 ? (
            <li className="px-2 py-3 text-sm text-ink-muted">No currency matches.</li>
          ) : (
            matches.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(c.code)
                    setOpen(false)
                    setQuery("")
                  }}
                  className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                >
                  <span className="w-10 shrink-0 font-mono font-medium">{c.code}</span>
                  <span className="truncate text-ink-muted">{c.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
