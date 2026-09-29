"use client"

import { useThresholds } from "@/components/settings-provider"
import { useNow } from "@/hooks/use-now"
import {
  daysLeft,
  expiresAtIso,
  formatDatePK,
  todayPK,
  type ISODate,
} from "@/lib/domain/dates"
import { statusColour } from "@/lib/domain/status"
import { cn } from "@/lib/utils"

const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, "0")
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`

/** Static, date-only label: used before mount (hydration-safe) and for screen readers. */
function staticLabel(d: number) {
  return d > 0 ? `${days(d)} left` : d === 0 ? "Expires today" : `Expired ${days(-d)} ago`
}

// Live countdown (docs/06 §3.1 and §5). Before mount it shows a label
// computed only from dates, so server and client HTML match; after mount
// it ticks every second from the shared useNow() clock.
export function TimerPill({
  renewalDate,
  status = "active",
  size = "md",
  className,
}: {
  renewalDate: ISODate
  status?: "active" | "cancelled"
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const now = useNow()
  const t = useThresholds()

  if (status === "cancelled") {
    return (
      <span
        className={cn("timer-pill is-cancelled", `timer-pill--${size}`, className)}
        title="Service cancelled"
      >
        <span className="timer-dot" />
        Cancelled
      </span>
    )
  }

  const today = todayPK(now ? new Date(now) : undefined)
  const d = daysLeft(renewalDate, today)
  const colour = statusColour(d, t) // same function as the server
  const exp = Date.parse(expiresAtIso(renewalDate))

  let text: string
  if (now === null) {
    text = staticLabel(d)
  } else if (exp - now < 0) {
    const ago = now - exp
    text =
      ago >= DAY
        ? `Expired ${days(Math.floor(ago / DAY))} ago`
        : `Expired ${Math.max(1, Math.floor(ago / 3_600_000))}h ago`
  } else {
    let ms = exp - now
    const dd = Math.floor(ms / DAY)
    ms -= dd * DAY
    const h = Math.floor(ms / 3_600_000)
    ms -= h * 3_600_000
    const m = Math.floor(ms / 60_000)
    const s = Math.floor((ms - m * 60_000) / 1000)
    text =
      size === "sm"
        ? `${pad(dd)}d ${pad(h)}h`
        : `${pad(dd)}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`
  }

  const label = `Expires on ${formatDatePK(renewalDate)}, ${staticLabel(d).toLowerCase()}`

  return (
    <span
      className={cn("timer-pill", `is-${colour}`, `timer-pill--${size}`, className)}
      title={label}
    >
      <span className="timer-dot" />
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
