import { describe, expect, it } from "vitest"

import {
  addDays,
  addOneYear,
  daysLeft,
  diffDays,
  expiresAtIso,
  formatDatePK,
  isISODate,
  todayPK,
} from "@/lib/domain/dates"

describe("addOneYear", () => {
  it.each([
    ["2025-10-10", "2026-10-10"], // normal
    ["2024-02-29", "2025-02-28"], // leap day → non-leap year
    ["2027-02-28", "2028-02-28"], // into a leap year stays on the 28th
    ["2025-01-31", "2026-01-31"], // end of month
    ["2028-02-29", "2029-02-28"],
    ["2099-02-28", "2100-02-28"],
  ])("%s → %s", (input, expected) => {
    expect(addOneYear(input)).toBe(expected)
  })

  it("rejects malformed input", () => {
    expect(() => addOneYear("30/09/2026")).toThrow(RangeError)
  })
})

describe("daysLeft", () => {
  it("counts days in the future", () => {
    expect(daysLeft("2026-10-12", "2026-09-25")).toBe(17)
  })
  it("is 0 on the renewal day", () => {
    expect(daysLeft("2026-09-25", "2026-09-25")).toBe(0)
  })
  it("is negative after expiry", () => {
    expect(daysLeft("2026-09-20", "2026-09-25")).toBe(-5)
  })
  it("crosses a year boundary", () => {
    expect(diffDays("2027-01-01", "2026-12-31")).toBe(1)
  })
})

describe("expiresAtIso", () => {
  it("is the end of the renewal day in Pakistan time", () => {
    expect(expiresAtIso("2026-10-12")).toBe("2026-10-12T23:59:59+05:00")
  })
})

describe("todayPK", () => {
  it("is already the next day in PK at 19:30 UTC", () => {
    expect(todayPK(new Date("2026-09-24T19:30:00Z"))).toBe("2026-09-25")
  })
  it("is still the same day at 18:59 UTC", () => {
    expect(todayPK(new Date("2026-09-24T18:59:00Z"))).toBe("2026-09-24")
  })
  it("flips exactly at PK midnight (19:00 UTC)", () => {
    expect(todayPK(new Date("2026-09-24T19:00:00Z"))).toBe("2026-09-25")
  })
})

describe("addDays", () => {
  it.each([
    ["2026-09-28", 30, "2026-10-28"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2028-02-28", 1, "2028-02-29"],
  ])("%s + %i → %s", (d, n, expected) => {
    expect(addDays(d, n)).toBe(expected)
  })
})

describe("formatDatePK", () => {
  it.each([
    ["2026-09-30", "30 Sep 2026"],
    ["2026-01-05", "05 Jan 2026"],
    ["2027-12-31", "31 Dec 2027"],
  ])("%s → %s", (d, expected) => {
    expect(formatDatePK(d)).toBe(expected)
  })
})

describe("isISODate", () => {
  it("accepts real dates only", () => {
    expect(isISODate("2026-02-28")).toBe(true)
    expect(isISODate("2028-02-29")).toBe(true)
    expect(isISODate("2026-02-30")).toBe(false)
    expect(isISODate("2026-2-3")).toBe(false)
    expect(isISODate("")).toBe(false)
  })
})
