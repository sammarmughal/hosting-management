import { describe, expect, it } from "vitest"

import {
  formatAmount,
  formatMoney,
  fromCents,
  sumAmounts,
  toCents,
  totalsByCurrency,
} from "@/lib/domain/money"
import { CURRENCIES } from "@/lib/domain/validation"

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

describe("formatMoney for every supported currency", () => {
  it.each(CURRENCIES)("%s: code, thousands separators, no .00", (currency) => {
    expect(formatMoney("86500.00", currency)).toBe(`${currency} 86,500`)
    expect(formatMoney("1234567.5", currency)).toBe(`${currency} 1,234,567.50`)
    expect(formatMoney("0.05", currency)).toBe(`${currency} 0.05`)
    expect(formatMoney("-120.00", currency)).toBe(`${currency} -120`)
  })
})

describe("totalsByCurrency", () => {
  const rows = [
    { currency: "USD", amount: "120.00" },
    { currency: "PKR", amount: "6500.00" },
    { currency: "AED", amount: "0.10" },
    { currency: "PKR", amount: "4750.50" },
    { currency: "AED", amount: "0.20" },
    { currency: "USD", amount: "80.00" },
  ]

  it("keeps one exact total per currency and never mixes them", () => {
    expect(totalsByCurrency(rows)).toEqual([
      { currency: "AED", total: "0.30" },
      { currency: "PKR", total: "11250.50" },
      { currency: "USD", total: "200.00" },
    ])
  })
  it("puts the default currency first, the rest alphabetically", () => {
    expect(totalsByCurrency(rows, "USD").map((t) => t.currency)).toEqual([
      "USD",
      "AED",
      "PKR",
    ])
  })
  it("ignores a default with no rows and is empty for no rows", () => {
    expect(totalsByCurrency(rows, "GBP").map((t) => t.currency)).toEqual([
      "AED",
      "PKR",
      "USD",
    ])
    expect(totalsByCurrency([], "PKR")).toEqual([])
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
