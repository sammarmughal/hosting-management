import { describe, expect, it } from "vitest"

import {
  formatDateTimePK,
  formatRelative,
  formatSentAt,
} from "@/lib/domain/relative-time"

// 29 Sep 2026, 15:00 in Pakistan (UTC+5)
const NOW = new Date("2026-09-29T10:00:00Z")
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
const MIN = 60_000
const HOUR = 60 * MIN

describe("formatRelative", () => {
  it.each([
    [ago(20_000), "just now"],
    [ago(MIN), "1 minute ago"],
    [ago(12 * MIN), "12 minutes ago"],
    [ago(HOUR), "1 hour ago"],
    [ago(5 * HOUR), "5 hours ago"],
  ])("%s → %s", (iso, expected) => {
    expect(formatRelative(iso, NOW)).toBe(expected)
  })

  it("uses Pakistan calendar days for yesterday", () => {
    // 23:30 PK the previous day is only 15.5 hours earlier
    expect(formatRelative("2026-09-28T18:30:00Z", NOW)).toBe("yesterday")
    // 00:30 PK today is still "hours ago"
    expect(formatRelative("2026-09-28T19:30:00Z", NOW)).toBe("14 hours ago")
  })

  it("counts days, then falls back to the date after a week", () => {
    expect(formatRelative(ago(3 * 24 * HOUR), NOW)).toBe("3 days ago")
    expect(formatRelative(ago(6 * 24 * HOUR), NOW)).toBe("6 days ago")
    expect(formatRelative(ago(9 * 24 * HOUR), NOW)).toBe("20 Sep 2026")
  })
})

describe("formatSentAt", () => {
  it("shows the time for today, the date otherwise", () => {
    expect(formatSentAt("2026-09-29T05:42:00Z", NOW)).toBe("10:42")
    expect(formatSentAt("2026-09-28T05:42:00Z", NOW)).toBe("28 Sep")
    expect(formatSentAt("2025-12-30T05:42:00Z", NOW)).toBe("30 Dec 2025")
  })
})

describe("formatDateTimePK", () => {
  it("shows Pakistan date and 24h time", () => {
    expect(formatDateTimePK("2026-09-29T05:42:00Z")).toBe("29 Sep 2026, 10:42")
    expect(formatDateTimePK("2026-09-28T19:05:00Z")).toBe("29 Sep 2026, 00:05")
  })
})
