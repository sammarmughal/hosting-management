import { describe, expect, it } from "vitest"

import {
  formatAmount,
  formatMoney,
  fromCents,
  sumAmounts,
  toCents,
} from "@/lib/domain/money"

describe("formatMoney", () => {
  it.each([
    ["6500.00", "PKR", "PKR 6,500"],
    ["6500", "PKR", "PKR 6,500"],
    ["6500.5", "PKR", "PKR 6,500.50"],
    ["86500.00", "PKR", "PKR 86,500"],
    ["0.00", "PKR", "PKR 0"],
    ["99999999.99", "PKR", "PKR 99,999,999.99"],
    ["120", "USD", "USD 120"],
  ])("(%s, %s) → %s", (amount, currency, expected) => {
    expect(formatMoney(amount, currency)).toBe(expected)
  })
})

describe("formatAmount", () => {
  it("drops .00 and keeps other decimals", () => {
    expect(formatAmount("4500.00")).toBe("4,500")
    expect(formatAmount("12750.25")).toBe("12,750.25")
  })
  it("rounds half-up to cents", () => {
    expect(formatAmount("1.005")).toBe("1.01")
    expect(formatAmount("1.004")).toBe("1")
  })
  it("rejects non-decimal strings", () => {
    expect(() => formatAmount("6,500")).toThrow(RangeError)
    expect(() => formatAmount("abc")).toThrow(RangeError)
    expect(() => formatAmount("1e5")).toThrow(RangeError)
  })
})

describe("cents", () => {
  it("round-trips", () => {
    expect(fromCents(toCents("6500.50"))).toBe("6500.50")
    expect(fromCents(toCents("-12.3"))).toBe("-12.30")
  })
})

describe("sumAmounts", () => {
  it("adds exactly (no float drift)", () => {
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30")
    expect(sumAmounts(["6500.00", "8000.00", "4750.50"])).toBe("19250.50")
  })
  it("is 0.00 for an empty list", () => {
    expect(sumAmounts([])).toBe("0.00")
  })
})
