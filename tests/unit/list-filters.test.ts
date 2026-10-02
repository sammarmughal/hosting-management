import { describe, expect, it } from "vitest"

import {
  inRange,
  isFiltered,
  parsePaymentParams,
  parseReminderLogParams,
} from "@/lib/list-filters"

describe("parseReminderLogParams", () => {
  it("keeps valid values and drops unknown ones", () => {
    expect(
      parseReminderLogParams({
        channel: "whatsapp",
        status: "failed",
        from: "2026-09-01",
        to: "2026-09-30",
        q: " noor ",
        page: "2",
      })
    ).toEqual({
      channel: "whatsapp",
      status: "failed",
      from: "2026-09-01",
      to: "2026-09-30",
      q: "noor",
      page: 2,
    })
    expect(
      parseReminderLogParams({
        channel: "sms",
        status: "lost",
        from: "2026-02-30",
        page: "x",
      })
    ).toEqual({ channel: "", status: "", from: "", to: "", q: "", page: 1 })
  })

  it("ignores a to-date before the from-date", () => {
    const p = parsePaymentParams({ from: "2026-09-10", to: "2026-09-01" })
    expect([p.from, p.to]).toEqual(["2026-09-10", ""])
  })
})

describe("inRange / isFiltered", () => {
  it("treats bounds as inclusive and empty as open", () => {
    expect(inRange("2026-09-10", { from: "2026-09-10", to: "2026-09-10" })).toBe(true)
    expect(inRange("2026-09-09", { from: "2026-09-10", to: "" })).toBe(false)
    expect(inRange("2030-01-01", { from: "", to: "" })).toBe(true)
  })

  it("ignores the page when deciding if a list is filtered", () => {
    expect(isFiltered(parsePaymentParams({ page: "3" }))).toBe(false)
    expect(isFiltered(parsePaymentParams({ q: "jazz" }))).toBe(true)
  })
})
