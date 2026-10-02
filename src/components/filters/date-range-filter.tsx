"use client"

import { Input } from "@/components/ui/input"
import { isISODate } from "@/lib/domain/dates"
import { cn } from "@/lib/utils"

/** From / To date inputs. Only complete dates are passed on. */
export function DateRangeFilter({
  from,
  to,
  onChange,
  className,
}: {
  from: string
  to: string
  onChange: (range: { from?: string; to?: string }) => void
  className?: string
}) {
  const handle = (key: "from" | "to") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (v === "" || isISODate(v)) onChange({ [key]: v })
  }

  return (
    <fieldset className={cn("flex min-w-0 items-center gap-2", className)}>
      <legend className="sr-only">Date range</legend>
      <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none sm:flex-row sm:items-center sm:gap-1.5">
        <span className="shrink-0 text-xs text-ink-muted sm:text-sm">From</span>
        <Input
          type="date"
          value={from}
          max={to || undefined}
          onChange={handle("from")}
          className="min-w-0 max-md:h-11 sm:w-38"
        />
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none sm:flex-row sm:items-center sm:gap-1.5">
        <span className="shrink-0 text-xs text-ink-muted sm:text-sm">To</span>
        <Input
          type="date"
          value={to}
          min={from || undefined}
          onChange={handle("to")}
          className="min-w-0 max-md:h-11 sm:w-38"
        />
      </label>
    </fieldset>
  )
}
