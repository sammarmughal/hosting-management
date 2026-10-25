import { describe, expect, it } from "vitest"

import { renewSchema, type RenewInput } from "@/lib/domain/validation"

const TODAY = "2026-09-29"
const base: RenewInput = {
  subscriptionId: 101,
  amount: "6500",
  paidOn: TODAY,
  method: "JazzCash",
  extendFrom: "renewal",
}
const parse = (patch: Partial<RenewInput> & Record<string, unknown>) =>
  renewSchema(TODAY).safeParse({ ...base, ...patch })
const errorFor = (
  patch: Partial<RenewInput> & Record<string, unknown>,
  field: string
) => {
  const r = parse(patch)
  return r.success ? undefined : r.error.issues.find((i) => i.path[0] === field)?.message
}

describe("renewSchema", () => {
  it("accepts a normal renewal and strips thousands separators", () => {
    const r = parse({ amount: "6,500.50" })
    expect(r.success && r.data.amount).toBe("6500.50")
  })

  it.each(["0", "0.00", "", "abc", "6500.5055", "-5", "12345678901"])(
    "rejects amount %j",
    (amount) => {
      expect(errorFor({ amount }, "amount")).toBeDefined()
    }
  )

  it("checks decimals against the service's currency", () => {
    const amountError = (amount: string, currency: string) => {
      const r = renewSchema(TODAY, currency).safeParse({ ...base, amount })
      return r.success
        ? undefined
        : r.error.issues.find((i) => i.path[0] === "amount")?.message
    }
    expect(amountError("6,500", "PKR")).toBeUndefined()
    expect(amountError("6500.50", "PKR")).toBe("PKR amounts can’t have decimals")
    expect(amountError("49.99", "USD")).toBeUndefined()
    expect(amountError("49.995", "USD")).toBe("USD amounts have at most 2 decimals")
    expect(amountError("12.345", "KWD")).toBeUndefined()
  })

  it("allows paid on up to tomorrow, not later", () => {
    expect(parse({ paidOn: "2026-09-30" }).success).toBe(true)
    expect(errorFor({ paidOn: "2026-10-01" }, "paidOn")).toBe(
      "Paid on can't be in the future"
    )
    expect(errorFor({ paidOn: "2026-02-30" }, "paidOn")).toBe("Enter a valid date")
  })

  it("requires a known method and rejects unknown keys", () => {
    expect(errorFor({ method: "Cheque" as never }, "method")).toBe(
      "Choose how it was paid"
    )
    expect(parse({ extra: 1 }).success).toBe(false)
  })
})
