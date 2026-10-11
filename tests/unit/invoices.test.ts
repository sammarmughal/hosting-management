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
    expect(t).toMatchObject({ subtotal: "6500.00", taxAmount: "0.00", total: "6500.00" })
  })
  it("applies discount before tax and rounds tax half-up to the cent", () => {
    // (8750 − 250) × 17% = 1445.00
    expect(
      invoiceTotals([{ quantity: 1, unitAmount: "8750" }], { discount: "250", taxRate: "17" })
    ).toMatchObject({ subtotal: "8750.00", discount: "250.00", taxAmount: "1445.00", total: "9945.00" })
    // 49.99 × 5% = 2.4995 → 2.50
    expect(invoiceTotals([{ quantity: 1, unitAmount: "49.99" }], { taxRate: "5" }).taxAmount).toBe(
      "2.50"
    )
    // 10.01 × 16.5% = 1.65165 → 1.65
    expect(
      invoiceTotals([{ quantity: 1, unitAmount: "10.01" }], { taxRate: "16.5" }).taxAmount
    ).toBe("1.65")
  })
  it("multiplies quantity and keeps per-line amounts", () => {
    const t = invoiceTotals([
      { quantity: 2, unitAmount: "0.10" },
      { quantity: 3, unitAmount: "0.20" },
    ])
    expect(t.lines).toEqual(["0.20", "0.60"])
    expect(t.total).toBe("0.80")
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
