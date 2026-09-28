// Business dates are 'YYYY-MM-DD' strings. "Today" is the calendar date in
// Asia/Karachi. See docs/04 §1. Pure: callers pass `now` / `today` in.

export type ISODate = string

const DAY_MS = 86_400_000
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

const pad2 = (n: number) => String(n).padStart(2, "0")
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

function parts(d: ISODate): [number, number, number] {
  const m = ISO_RE.exec(d)
  if (!m) throw new RangeError(`Invalid ISO date: ${d}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** True for a real calendar date in 'YYYY-MM-DD' form (rejects 2026-02-30). */
export function isISODate(value: string): value is ISODate {
  const m = ISO_RE.exec(value)
  if (!m) return false
  const t = Date.parse(`${value}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === value
}

/** Start + 1 year. 29 Feb → 28 Feb when the target year is not a leap year. */
export function addOneYear(d: ISODate): ISODate {
  const [y, m, day] = parts(d)
  const ny = y + 1
  const nd = m === 2 && day === 29 && !isLeap(ny) ? 28 : day
  return `${ny}-${pad2(m)}-${pad2(nd)}`
}

/** Whole-day difference a − b (UTC arithmetic on date-only values is safe). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS
  )
}

export function addDays(d: ISODate, n: number): ISODate {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Today's date in Asia/Karachi, whatever the server or device timezone. */
export function todayPK(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

/** Days until renewal: 0 = expires today, −1 = expired yesterday. */
export const daysLeft = (renewal: ISODate, today: ISODate): number =>
  diffDays(renewal, today)

/** The timer target: end of the renewal day in Pakistan time. */
export const expiresAtIso = (renewal: ISODate): string => `${renewal}T23:59:59+05:00`

/** '2026-09-30' → '30 Sep 2026' */
export function formatDatePK(d: ISODate): string {
  const [y, m, day] = parts(d)
  return `${pad2(day)} ${MONTHS[m - 1]} ${y}`
}
