"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** Radix Select can't use "" as a value, so "no filter" uses this. */
export const ANY = "any"

/** "Label  Value ▾" select for list toolbars. `value` "" means `anyLabel`. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  anyLabel,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  /** Adds a first "no filter" option (e.g. "Any month", "All"). */
  anyLabel?: string
  className?: string
}) {
  return (
    <Select
      value={value || (anyLabel ? ANY : "")}
      onValueChange={(v) => onChange(v === ANY ? "" : v)}
    >
      <SelectTrigger aria-label={label} className={cn("min-w-0 max-md:data-[size=default]:h-11", className)}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-ink-muted">{label}</span>
          <span className="truncate">
            <SelectValue />
          </span>
        </span>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {anyLabel && <SelectItem value={ANY}>{anyLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
