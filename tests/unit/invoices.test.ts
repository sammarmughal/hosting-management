import { describe, expect, it } from "vitest"

import {
  cyclePeriod,
  displayStatus,
  formatInvoiceNumber,
  invoiceDue,
  invoiceFilename,
  invoiceTotals,
  periodLabel,
} from "@/lib/domain/invoices"

describe("formatInvoiceNumber (docs/13 §3)", () => {
  it("is {prefix}-{YYYY}-{seq} with seq padded to 4 digits", () => {
    expect(formatInvoiceNumber("INV", 2026, 12)).toBe("INV-2026-0012")
    expect(formatInvoiceNumber("RWS", 2027, 1)).toBe("RWS-2027-0001")
    expect(formatInvoiceNumber("INV", 2026, 12345)).toBe("INV-2026-12345")
  })
  it("rejects bad prefixes, years and sequences", () => {
    expect(() => formatInvoiceNumber("inv", 2026, 1)).toThrow()
    expect(() => formatInvoiceNumber("IN-V", 2026, 1)).toThrow()
    expect(() => formatInvoiceNumber("INV", 26, 1)).toThrow()
    expect(() => formatInvoiceNumber("INV", 2026, 0)).toThrow()
  })
})

describe("invoiceTotals", () => {
  it("adds lines exactly with no tax by default", () => {
    const t = invoiceTotals([{ quantity: 1, unitAmount: "6500.00" }])
    expect(t).toMatchObject({ subtotal: "6500.000", taxAmount: "0.000", total: "6500.000" })
    expect(t.taxRate).toBe("0.00")
  })
  it("applies discount before tax and rounds tax half-up to the cent", () => {
    // (8750 − 250) × 17% = 1445.00
    expect(
      invoiceTotals([{ quantity: 1, unitAmount: "8750" }], { discount: "250", taxRate: "17" })
    ).toMatchObject({
      subtotal: "8750.000",
      discount: "250.000",
      taxRate: "17.00",
      taxAmount: "1445.000",
      total: "9945.000",
    })
    // 49.99 × 5% = 2.4995 → 2.50
    expect(invoiceTotals([{ quantity: 1, unitAmount: "49.99" }], { taxRate: "5" }).taxAmount).toBe(
      "2.500"
    )
    // 10.01 × 16.5% = 1.65165 → 1.65
    expect(
      invoiceTotals([{ quantity: 1, unitAmount: "10.01" }], { taxRate: "16.5" }).taxAmount
    ).toBe("1.650")
  })
  it("rounds tax to the currency's minor unit (0, 2 or 3 decimals)", () => {
    const tax = (unitAmount: string, decimals: number) =>
      invoiceTotals([{ quantity: 1, unitAmount }], { taxRate: "17", decimals })
    // PKR / JPY: 8750 × 17% = 1487.5 → 1488
    expect(tax("8750", 0)).toMatchObject({ taxAmount: "1488.000", total: "10238.000" })
    // USD: 49.99 × 17% = 8.4983 → 8.50
    expect(tax("49.99", 2)).toMatchObject({ taxAmount: "8.500", total: "58.490" })
    // KWD: 12.345 × 17% = 2.09865 → 2.099
    expect(tax("12.345", 3)).toMatchObject({ taxAmount: "2.099", total: "14.444" })
  })
  it("multiplies quantity and keeps per-line amounts", () => {
    const t = invoiceTotals([
      { quantity: 2, unitAmount: "0.10" },
      { quantity: 3, unitAmount: "0.20" },
    ])
    expect(t.lines).toEqual(["0.200", "0.600"])
    expect(t.total).toBe("0.800")
  })
  it("rejects a discount above the subtotal, bad quantities and bad rates", () => {
    expect(() => invoiceTotals([{ quantity: 1, unitAmount: "10" }], { discount: "11" })).toThrow()
    expect(() => invoiceTotals([{ quantity: 0, unitAmount: "10" }])).toThrow()
    expect(() => invoiceTotals([{ quantity: 1, unitAmount: "10" }], { taxRate: "101" })).toThrow()
  })
})

describe("invoice window (docs/13 §4)", () => {
  it("is due once daysLeft ≤ leadDays, for active services only", () => {
    expect(invoiceDue({ status: "active", daysLeft: 30 }, 30)).toBe(true)
    expect(invoiceDue({ status: "active", daysLeft: 31 }, 30)).toBe(false)
    expect(invoiceDue({ status: "active", daysLeft: 15 }, 15)).toBe(true)
    expect(invoiceDue({ status: "active", daysLeft: -4 }, 15)).toBe(true)
    expect(invoiceDue({ status: "cancelled", daysLeft: 3 }, 30)).toBe(false)
  })
  it("covers one yearly cycle from the renewal date", () => {
    expect(cyclePeriod("2026-09-30")).toEqual({
      periodStart: "2026-09-30",
      periodEnd: "2027-09-30",
      dueDate: "2026-09-30",
    })
    expect(periodLabel("2026-09-30", "2027-09-30")).toBe("30 Sep 2026 → 30 Sep 2027")
  })
})

describe("displayStatus: overdue is derived", () => {
  it.each([
    ["issued", "2026-10-11", "unpaid"],
    ["sent", "2026-10-11", "sent"],
    ["issued", "2026-10-09", "overdue"],
    ["sent", "2026-10-09", "overdue"],
    ["paid", "2026-10-01", "paid"],
    ["void", "2026-10-01", "void"],
  ] as const)("%s due %s → %s", (status, due, expected) => {
    expect(displayStatus(status, due, "2026-10-10")).toBe(expected)
  })
})

describe("invoiceFilename (docs/13 §7)", () => {
  it("matches Invoice-INV-2026-0012-noordental.pk.pdf and strips unsafe characters", () => {
    expect(invoiceFilename("INV-2026-0012", "noordental.pk")).toBe(
      "Invoice-INV-2026-0012-noordental.pk.pdf"
    )
    expect(invoiceFilename("INV-2026-0001", 'a"b\r\n/c')).toBe("Invoice-INV-2026-0001-a-b-c.pdf")
  })
})
