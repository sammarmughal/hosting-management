import { describe, expect, it } from "vitest"

import { previewImport } from "@/lib/domain/import"
import { businessSchema, INITIAL_PREFERENCES } from "@/lib/domain/preferences"
import { currencyOptions } from "@/lib/domain/validation"

describe("currencies (docs/13 §6)", () => {
  it("offers PKR, USD, AED, SAR, GBP and EUR, all enabled by default", () => {
    expect(INITIAL_PREFERENCES.business.enabledCurrencies).toEqual([
      "PKR",
      "USD",
      "AED",
      "SAR",
      "GBP",
      "EUR",
    ])
  })
})

describe("currencyOptions", () => {
  it("offers the enabled currencies in the fixed order", () => {
    expect(currencyOptions(["USD", "PKR"])).toEqual(["PKR", "USD"])
  })
  it("keeps a service's current currency even after it was turned off", () => {
    expect(currencyOptions(["PKR"], "GBP")).toEqual(["PKR", "GBP"])
    expect(currencyOptions(["PKR"], "PKR")).toEqual(["PKR"])
  })
  it("ignores an unknown current currency", () => {
    expect(currencyOptions(["PKR"], "XYZ")).toEqual(["PKR"])
  })
})

describe("business settings: currencies", () => {
  const base = INITIAL_PREFERENCES.business
  const parse = (patch: Partial<typeof base>) =>
    businessSchema.safeParse({ ...base, ...patch })

  it("accepts the defaults and stores currencies in the fixed order", () => {
    const r = parse({ enabledCurrencies: ["EUR", "PKR"] })
    expect(r.success && r.data.enabledCurrencies).toEqual(["PKR", "EUR"])
  })
  it("requires the default currency to be enabled", () => {
    const r = parse({ defaultCurrency: "AED", enabledCurrencies: ["PKR", "USD"] })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(["defaultCurrency"])
  })
  it("rejects an empty, duplicated or unknown list", () => {
    expect(parse({ enabledCurrencies: [] }).success).toBe(false)
    expect(parse({ enabledCurrencies: ["PKR", "PKR"] }).success).toBe(false)
    expect(parse({ enabledCurrencies: ["PKR", "XYZ" as never] }).success).toBe(false)
  })
})

describe("import: currencies", () => {
  const row = {
    client_name: "Faisal Ahmed",
    email: "faisal@faisalprint.pk",
    domain: "faisalprint.pk",
    start_date: "30/09/2025",
    renewal_date: "30/09/2026",
    charge_amount: "120",
    currency: "",
  }
  const currencies = { default: "USD", enabled: ["PKR", "USD"] } as const

  it("uses the default currency when the column is blank", () => {
    const [r] = previewImport([row], [], "2026-10-02", currencies)
    expect(r?.input.service.currency).toBe("USD")
    expect(r?.status).toBe("valid")
  })
  it("rejects a currency that isn't turned on", () => {
    const [r] = previewImport([{ ...row, currency: "gbp" }], [], "2026-10-02", currencies)
    expect(r?.status).toBe("error")
    expect(r?.message).toBe("GBP isn’t turned on in Settings")
  })
})
