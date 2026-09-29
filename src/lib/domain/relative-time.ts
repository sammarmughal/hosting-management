// Relative and absolute timestamps for the UI ("2 hours ago", with the full
// date and time in a tooltip). Pure: the caller passes `now` in.
import { formatDatePK, todayPK } from "@/lib/domain/dates"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`

/**
 * "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago",
 * then the date ("12 Sep 2026") after a week. Days are Pakistan calendar days.
 */
export function formatRelative(iso: string, now: Date): string {
  const then = new Date(iso)
  const diff = now.getTime() - then.getTime()
  if (diff < MINUTE) return "just now"
  if (diff < HOUR) return `${plural(Math.floor(diff / MINUTE), "minute")} ago`

  const days = Math.round(
    (Date.parse(`${todayPK(now)}T00:00:00Z`) - Date.parse(`${todayPK(then)}T00:00:00Z`)) /
      DAY
  )
  if (days === 0) return `${plural(Math.floor(diff / HOUR), "hour")} ago`
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  return formatDatePK(todayPK(then))
}

/** "29 Sep 2026, 10:42" in Pakistan time. */
export function formatDateTimePK(iso: string): string {
  const d = new Date(iso)
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d)
  return `${formatDatePK(todayPK(d))}, ${time}`
}
