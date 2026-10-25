import { describe, expect, it } from "vitest"

import {
  currencyCatalog,
  currencyDecimals,
  currencyInUseError,
  currencyLabel,
  currencyName,
  currencyOptions,
  currencySchema,
  currencyUseText,
  isCurrencyCode,
  ISO_CURRENCIES,
  normaliseCurrencyList,
} from "@/lib/domain/currency"
import {
  emptyImportContext,
  previewClients,
  previewSubscriptions,
  type ImportContext,
} from "@/lib/domain/import"
import { businessSchema, INITIAL_PREFERENCES } from "@/lib/domain/preferences"
import { SETTING_DEFAULTS } from "@/lib/server/settings-keys"

describe("ISO 4217 currencies (docs/13 §6)", () => {
  it("offers any active ISO currency, not a fixed short list", () => {
    expect(ISO_CURRENCIES.length).toBeGreaterThan(150)
    for (const code of ["PKR", "AED", "USD", "SAR", "GBP", "EUR", "JPY", "KWD", "INR"])
      expect(isCurrencyCode(code)).toBe(true)
    expect(new Set(ISO_CURRENCIES).size).toBe(ISO_CURRENCIES.length)
    expect([...ISO_CURRENCIES].sort()).toEqual([...ISO_CURRENCIES])
  })
  it("leaves out withdrawn codes, funds and metals", () => {
    for (const code of ["HRK", "BGN", "ZWL", "SLL", "XAU", "XDR", "XXX", "XTS", "ABC"])
      expect(isCurrencyCode(code)).toBe(false)
  })
  it("enables PKR, USD and AED by default", () => {
    expect(INITIAL_PREFERENCES.business.enabledCurrencies).toEqual(["AED", "PKR", "USD"])
    expect(SETTING_DEFAULTS.enabled_currencies.split(",").sort()).toEqual([
      "AED",
      "PKR",
      "USD",
    ])
    expect(SETTING_DEFAULTS.default_currency).toBe("PKR")
  })
})

describe("names and decimals from Intl", () => {
  it("names currencies in English", () => {
    expect(currencyName("AED")).toMatch(/Dirham/)
    expect(currencyName("PKR")).toBe("Pakistani Rupee")
    expect(currencyLabel("AED")).toMatch(/^AED · .*Dirham$/)
  })
  it("knows each currency's minor unit", () => {
    expect(currencyDecimals("USD")).toBe(2)
    expect(currencyDecimals("AED")).toBe(2)
    expect(currencyDecimals("JPY")).toBe(0)
    expect(currencyDecimals("KWD")).toBe(3)
    expect(currencyDecimals("BHD")).toBe(3)
  })
  it("stays within 0–3 and falls back to 2", () => {
    for (const code of ISO_CURRENCIES) {
      const d = currencyDecimals(code)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(3)
    }
    expect(currencyDecimals("not a code")).toBe(2)
  })
  it("gives the picker every code with a name", () => {
    const catalog = currencyCatalog()
    expect(catalog).toHaveLength(ISO_CURRENCIES.length)
    expect(catalog.find((c) => c.code === "PKR")).toEqual({
      code: "PKR",
      name: "Pakistani Rupee",
    })
  })
})

describe("currencySchema", () => {
  it("upper-cases and trims", () => {
    expect(currencySchema.parse(" aed ")).toBe("AED")
  })
  it("rejects unknown codes", () => {
    expect(currencySchema.safeParse("XYZ").success).toBe(false)
    expect(currencySchema.safeParse("").success).toBe(false)
  })
})

describe("currencyOptions", () => {
  it("offers the enabled currencies", () => {
    expect(currencyOptions(["PKR", "USD"])).toEqual(["PKR", "USD"])
  })
  it("keeps a record's current currency even after it was turned off", () => {
    expect(currencyOptions(["PKR", "USD"], "GBP")).toEqual(["GBP", "PKR", "USD"])
    expect(currencyOptions(["PKR"], "PKR")).toEqual(["PKR"])
  })
  it("ignores an unknown current currency", () => {
    expect(currencyOptions(["PKR"], "XYZ")).toEqual(["PKR"])
  })
  it("normalises stored lists", () => {
    expect(normaliseCurrencyList(["usd", "PKR", "XYZ", "PKR", " aed"])).toEqual([
      "AED",
      "PKR",
      "USD",
    ])
  })
})

describe("a currency in use can't be disabled", () => {
  const usage = {
    AED: { clients: 2, subscriptions: 1 },
    PKR: { clients: 9, subscriptions: 12 },
  }

  it("explains what uses it", () => {
    expect(currencyUseText(usage.AED)).toBe("Used by 2 clients and 1 subscription")
    expect(currencyUseText({ clients: 0, subscriptions: 1 })).toBe(
      "Used by 1 subscription"
    )
    expect(currencyUseText({ clients: 1, subscriptions: 0 })).toBe("Used by 1 client")
    expect(currencyUseText({ clients: 0, subscriptions: 0 })).toBeNull()
    expect(currencyUseText(undefined)).toBeNull()
  })
  it("blocks a save that turns off a used currency", () => {
    expect(currencyInUseError(["PKR"], usage)).toBe(
      "AED is used by 2 clients and 1 subscription, so it can’t be turned off."
    )
  })
  it("allows turning off unused currencies", () => {
    expect(currencyInUseError(["AED", "PKR"], usage)).toBeNull()
    expect(
      currencyInUseError(["AED", "PKR"], {
        ...usage,
        USD: { clients: 0, subscriptions: 0 },
      })
    ).toBeNull()
  })
})

describe("business settings: currencies", () => {
  const base = INITIAL_PREFERENCES.business
  const parse = (patch: Partial<typeof base>) =>
    businessSchema.safeParse({ ...base, ...patch })

  it("accepts any ISO code and stores the list alphabetically", () => {
    const r = parse({ enabledCurrencies: ["usd", "KWD", "PKR"], defaultCurrency: "PKR" })
    expect(r.success && r.data.enabledCurrencies).toEqual(["KWD", "PKR", "USD"])
  })
  it("requires the default currency to be enabled", () => {
    const r = parse({ defaultCurrency: "AED", enabledCurrencies: ["PKR", "USD"] })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(["defaultCurrency"])
  })
  it("rejects an empty, duplicated or unknown list", () => {
    expect(parse({ enabledCurrencies: [] }).success).toBe(false)
    expect(parse({ enabledCurrencies: ["PKR", "PKR"] }).success).toBe(false)
    expect(parse({ enabledCurrencies: ["PKR", "XYZ"] }).success).toBe(false)
  })
})

describe("import: client and subscription currencies", () => {
  const ctx: ImportContext = {
    ...emptyImportContext("2026-10-02"),
    currencies: { default: "PKR", enabled: ["AED", "PKR", "USD"] },
    clients: [
      {
        id: 1,
        name: "Faisal Ahmed",
        email: "faisal@faisalprint.pk",
        phone: null,
        currency: "AED",
      },
    ],
    serviceTypes: [{ id: 2, name: "Web Hosting", isActive: true }],
  }
  const sub = {
    client_name: "Faisal Ahmed",
    client_email: "faisal@faisalprint.pk",
    service_type: "Web Hosting",
    domain: "faisalprint.pk",
    start_date: "30/09/2025",
    renewal_date: "30/09/2026",
    charge_amount: "120",
    currency: "",
  }
  const preview = (patch: Partial<typeof sub>) =>
    previewSubscriptions([{ ...sub, ...patch }], ctx)[0]

  it("uses the app default when a client's currency is blank", () => {
    const r = previewClients(
      [{ name: "Sana Javed", email: "sana@x.pk", currency: "" }],
      ctx
    )[0]
    expect(r?.data?.currency).toBe("PKR")
    expect(r?.status).toBe("valid")
  })
  it("starts a subscription in its client's currency when currency is blank", () => {
    expect(preview({})?.data?.currency).toBe("AED")
  })
  it("lets the subscription override the client's currency", () => {
    expect(preview({ currency: "USD", charge_amount: "49.99" })?.data?.currency).toBe(
      "USD"
    )
  })
  it("rejects a currency that isn't turned on, for a client or a subscription", () => {
    expect(preview({ currency: "gbp" })).toMatchObject({
      status: "error",
      message: "GBP isn’t turned on in Settings",
    })
    expect(
      previewClients([{ name: "Sara", email: "s@x.pk", currency: "SAR" }], ctx)[0]
    ).toMatchObject({
      status: "error",
      message: "SAR isn’t turned on in Settings",
    })
  })
  it("rejects amounts with more decimals than the currency has", () => {
    expect(preview({ currency: "PKR", charge_amount: "6500.50" })).toMatchObject({
      status: "error",
      message: "PKR amounts can’t have decimals",
    })
    expect(preview({ currency: "USD", charge_amount: "49.99" })?.status).toBe("valid")
  })
})
