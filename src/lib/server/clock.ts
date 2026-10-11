import "server-only"

import { isISODate, todayPK, type ISODate } from "@/lib/domain/dates"

/** FAKE_TODAY (development only, docs/10 §3). Ignored in production. */
export function fakeToday(): ISODate | null {
  if (process.env.NODE_ENV === "production") return null
  const v = process.env.FAKE_TODAY?.trim()
  return v && isISODate(v) ? v : null
}

/** Today in Asia/Karachi, honouring FAKE_TODAY in development. */
export function today(now: Date = new Date()): ISODate {
  return fakeToday() ?? todayPK(now)
}
