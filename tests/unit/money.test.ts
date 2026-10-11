import { describe, expect, it } from "vitest"

import { DEFAULT_ENABLED_CURRENCIES } from "@/lib/domain/currency"
import {
  formatAmount,
  formatMoney,
  fromUnits,
  plainAmount,
  roundUnits,
  sumAmounts,
  toUnits,
  totalsByCurrency,
} from "@/lib/domain/money"

describe("formatMoney", () => {
  it.each([
    ["6500.00", "PKR", "PKR 6,500"],
    ["6500", "PKR", "PKR 6,500"],
    ["86500.000", "PKR", "PKR 86,500"],
    ["0.00", "PKR", "PKR 0"],
    ["120", "USD", "USD 120"],
    ["49.99", "USD", "USD 49.99"],
    ["6500.5", "AED", "AED 6,500.50"],
    ["99999999.99", "USD", "USD 99,999,999.99"],
  ])("(%s, %s) → %s", (amount, currency, expected) => {
    expect(formatMoney(amount, currency)).toBe(expected)
  })
})

describe("decimal places come from the currency (Intl)", () => {
  it("formats 0-decimal currencies without a fraction", () => {
    expect(formatMoney("150000", "JPY")).toBe("JPY 150,000")
    expect(formatMoney("2500000.000", "IDR")).toBe("IDR 2,500,000")
  })
  it("formats 3-decimal currencies with three digits", () => {
    expect(formatMoney("12.5", "KWD")).toBe("KWD 12.500")
    expect(formatMoney("12.345", "BHD")).toBe("BHD 12.345")
    expect(formatMoney("12.000", "OMR")).toBe("OMR 12")
  })
  it("pads 2-decimal currencies to cents", () => {
    expect(formatMoney("1234567.5", "USD")).toBe("USD 1,234,567.50")
    expect(formatMoney("0.05", "EUR")).toBe("EUR 0.05")
    expect(formatMoney("-120.00", "GBP")).toBe("GBP -120")
  })
  it("never hides digits an older value already has (PKR 4,750.50)", () => {
    expect(formatMoney("4750.50", "PKR")).toBe("PKR 4,750.50")
    expect(formatMoney("100.5", "JPY")).toBe("JPY 100.50")
  })
  it.each(DEFAULT_ENABLED_CURRENCIES)("%s: code, thousands separators, no .00", (currency) => {
    expect(formatMoney("86500.00", currency)).toBe(`${currency} 86,500`)
    expect(formatMoney("-120.000", currency)).toBe(`${currency} -120`)
  })
})

describe("formatAmount", () => {
  it("defaults to two decimals without a currency (tax rates)", () => {
    expect(formatAmount("4500.00")).toBe("4,500")
    expect(formatAmount("12750.25")).toBe("12,750.25")
    expect(formatAmount("17.50")).toBe("17.50")
  })
  it("rejects non-decimal strings", () => {
    expect(() => formatAmount("6,500")).toThrow(RangeError)
    expect(() => formatAmount("abc")).toThrow(RangeError)
    expect(() => formatAmount("1e5")).toThrow(RangeError)
  })
})

describe("plainAmount (CSV)", () => {
  it("writes the currency's digits without grouping", () => {
    expect(plainAmount("6500.000", "PKR")).toBe("6500")
    expect(plainAmount("49.990", "USD")).toBe("49.99")
    expect(plainAmount("120.000", "USD")).toBe("120.00")
    expect(plainAmount("12.5", "KWD")).toBe("12.500")
  })
})

describe("units (thousandths)", () => {
  it("round-trips", () => {
    expect(fromUnits(toUnits("6500.50"))).toBe("6500.500")
    expect(fromUnits(toUnits("-12.3"))).toBe("-12.300")
    expect(fromUnits(toUnits("12.345"))).toBe("12.345")
  })
  it("rounds half-up past the third decimal", () => {
    expect(toUnits("1.0005")).toBe(1001n)
    expect(toUnits("1.0004")).toBe(1000n)
  })
  it("rounds to a currency's minor unit", () => {
    expect(roundUnits(1487500n, 0)).toBe(1488000n)
    expect(roundUnits(8498n, 2)).toBe(8500n)
    expect(roundUnits(2099n, 3)).toBe(2099n)
    expect(roundUnits(-1500n, 0)).toBe(-2000n)
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
    { currency: "KWD", amount: "0.005" },
    { currency: "KWD", amount: "0.010" },
  ]

  it("keeps one exact total per currency and never mixes them", () => {
    expect(totalsByCurrency(rows)).toEqual([
      { currency: "AED", total: "0.300" },
      { currency: "KWD", total: "0.015" },
      { currency: "PKR", total: "11250.500" },
      { currency: "USD", total: "200.000" },
    ])
  })
  it("puts the default currency first, the rest alphabetically", () => {
    expect(totalsByCurrency(rows, "USD").map((t) => t.currency)).toEqual([
      "USD",
      "AED",
      "KWD",
      "PKR",
    ])
  })
  it("ignores a default with no rows and is empty for no rows", () => {
    expect(totalsByCurrency(rows, "GBP").map((t) => t.currency)).toEqual([
      "AED",
      "KWD",
      "PKR",
      "USD",
    ])
    expect(totalsByCurrency([], "PKR")).toEqual([])
  })
})

describe("sumAmounts", () => {
  it("adds exactly (no float drift)", () => {
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.300")
    expect(sumAmounts(["6500.00", "8000.00", "4750.50"])).toBe("19250.500")
    expect(sumAmounts(["0.001", "0.002"])).toBe("0.003")
  })
  it("is 0.000 for an empty list", () => {
    expect(sumAmounts([])).toBe("0.000")
  })
})
