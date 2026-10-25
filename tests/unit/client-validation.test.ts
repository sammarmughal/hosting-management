import { describe, expect, it } from "vitest"

import { csvCell, toCsv } from "@/lib/domain/csv"
import {
  isValidDomain,
  looksLikeDomain,
  normaliseDomain,
  normaliseIdentifier,
} from "@/lib/domain/hostname"
import {
  clientSchema,
  companySchema,
  fieldErrorsFrom,
  serviceTypeSchema,
  subscriptionSchema,
  startDateWarning,
  type ClientInput,
  type CompanyInput,
  type SubscriptionInput,
} from "@/lib/domain/validation"

describe("normaliseDomain", () => {
  it.each([
    ["https://www.Example.com/", "example.com"],
    ["http://noordental.pk/about?x=1", "noordental.pk"],
    ["  WWW.BilalTraders.com  ", "bilaltraders.com"],
    ["almadinatextiles.com.pk:8080/", "almadinatextiles.com.pk"],
    ["shop.karachiautoparts.com", "shop.karachiautoparts.com"],
    ["sanajaved.com.", "sanajaved.com"],
  ])("%j → %s", (input, expected) => {
    expect(normaliseDomain(input)).toBe(expected)
  })

  it("validates hostnames", () => {
    expect(isValidDomain("littlestars.edu.pk")).toBe(true)
    expect(isValidDomain("localhost")).toBe(false)
    expect(isValidDomain("-bad.pk")).toBe(false)
    expect(isValidDomain("bad-.pk")).toBe(false)
    expect(isValidDomain("has space.pk")).toBe(false)
  })
})

describe("normaliseIdentifier (docs/14 §1)", () => {
  it("normalises anything that looks like a domain", () => {
    expect(looksLikeDomain("https://Shop.PK/x")).toBe(true)
    expect(looksLikeDomain("noordental.pk")).toBe(true)
    expect(normaliseIdentifier(" https://www.NoorDental.pk/ ")).toBe("noordental.pk")
  })

  it("keeps other identifiers as typed, with spaces collapsed", () => {
    expect(looksLikeDomain("AMC 2026 – Head office")).toBe(false)
    expect(normaliseIdentifier("  AMC   2026 – Head office ")).toBe(
      "AMC 2026 – Head office"
    )
    expect(normaliseIdentifier("Maintenance")).toBe("Maintenance")
  })
})

const client: ClientInput = {
  name: "Noor Dental Clinic",
  email: "Info@NoorDental.pk ",
  phone: "0321 4455667",
  currency: "PKR",
  notes: "",
}

describe("clientSchema", () => {
  it("normalises email and phone, and turns empty strings into null", () => {
    const r = clientSchema.parse(client)
    expect(r).toEqual({
      name: "Noor Dental Clinic",
      email: "info@noordental.pk",
      phone: "923214455667",
      address: null,
      currency: "PKR",
      notes: null,
    })
  })

  it("needs a known ISO currency and upper-cases it", () => {
    expect(clientSchema.parse({ ...client, currency: "aed" }).currency).toBe("AED")
    const r = clientSchema.safeParse({ ...client, currency: "XYZ" })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrorsFrom(r.error).currency).toBe("Choose a currency")
    expect(clientSchema.safeParse({ ...client, currency: "" }).success).toBe(false)
  })

  it("keeps an optional address, trimmed, and caps its length", () => {
    expect(
      clientSchema.parse({ ...client, address: "  Office 4, Blue Area\nIslamabad  " })
        .address
    ).toBe("Office 4, Blue Area\nIslamabad")
    expect(clientSchema.parse({ ...client, address: "" }).address).toBeNull()
    expect(clientSchema.safeParse({ ...client, address: "x".repeat(301) }).success).toBe(
      false
    )
  })

  it("needs a name of at least 2 characters", () => {
    const r = clientSchema.safeParse({ ...client, name: " A " })
    expect(r.success).toBe(false)
  })

  it("no longer has a company field (companies are records, docs/14 §1)", () => {
    expect(clientSchema.safeParse({ ...client, company: "Old text" }).success).toBe(false)
  })

  it("accepts phone only or email only, but not neither", () => {
    expect(clientSchema.safeParse({ ...client, email: "" }).success).toBe(true)
    expect(clientSchema.safeParse({ ...client, phone: "" }).success).toBe(true)
    const r = clientSchema.safeParse({ ...client, email: "", phone: "" })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrorsFrom(r.error)).toHaveProperty("phone")
  })

  it("rejects invalid email and phone", () => {
    const r = clientSchema.safeParse({ ...client, email: "ayesha@", phone: "12345" })
    expect(r.success).toBe(false)
    if (!r.success) {
      const e = fieldErrorsFrom(r.error)
      expect(e.email).toBe("Enter a valid email address")
      expect(e.phone).toBe("Enter a valid number, like 0300 1234567")
    }
  })
})

const company: CompanyInput = {
  clientId: "3",
  name: "  Noor Dental Clinic ",
  email: "",
  phone: "",
  address: "",
}

describe("companySchema (docs/14 §3)", () => {
  it("needs only the client and a name; the rest is optional", () => {
    expect(companySchema.parse(company)).toEqual({
      clientId: 3,
      name: "Noor Dental Clinic",
      email: null,
      phone: null,
      address: null,
    })
  })

  it("normalises email and phone like a client's", () => {
    const r = companySchema.parse({
      ...company,
      email: "Info@Noor.PK",
      phone: "0321 4455667",
    })
    expect(r).toMatchObject({ email: "info@noor.pk", phone: "923214455667" })
  })

  it("rejects a missing client, a short name and a bad email", () => {
    const r = companySchema.safeParse({
      ...company,
      clientId: "",
      name: "N",
      email: "x@",
    })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(fieldErrorsFrom(r.error)).toEqual({
        clientId: "Choose the client",
        name: "Enter the company name",
        email: "Enter a valid email address",
      })
  })
})

describe("serviceTypeSchema (docs/14 §2)", () => {
  it("takes a name, an optional default price and the active flag", () => {
    expect(
      serviceTypeSchema.parse({ name: " AMC ", defaultPrice: "", isActive: true })
    ).toEqual({
      name: "AMC",
      defaultPrice: null,
      isActive: true,
    })
    expect(
      serviceTypeSchema.parse({
        name: "Web Hosting",
        defaultPrice: "6,500",
        isActive: false,
      })
    ).toEqual({ name: "Web Hosting", defaultPrice: "6500", isActive: false })
  })

  it("rejects a short name and a bad price", () => {
    const r = serviceTypeSchema.safeParse({
      name: "A",
      defaultPrice: "six",
      isActive: true,
    })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(Object.keys(fieldErrorsFrom(r.error)).sort()).toEqual([
        "defaultPrice",
        "name",
      ])
  })
})

const subscription: SubscriptionInput = {
  clientId: "3",
  companyId: "",
  serviceTypeId: 2,
  domain: "https://www.NoorDental.pk/",
  planLabel: "Business",
  startDate: "2025-10-16",
  renewalDate: "2026-10-16",
  chargeAmount: "8,750",
  currency: "PKR",
  remindersEnabled: true,
  notes: "",
}

describe("subscriptionSchema", () => {
  it("normalises the domain, amount and ids", () => {
    const r = subscriptionSchema.parse(subscription)
    expect(r).toMatchObject({ clientId: 3, companyId: null, serviceTypeId: 2 })
    expect(r.domain).toBe("noordental.pk")
    expect(r.chargeAmount).toBe("8750")
    expect(r.notes).toBeNull()
    expect(subscriptionSchema.parse({ ...subscription, companyId: "7" }).companyId).toBe(
      7
    )
  })

  it("needs a client and a service", () => {
    const r = subscriptionSchema.safeParse({
      ...subscription,
      clientId: "",
      serviceTypeId: "",
    })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(fieldErrorsFrom(r.error)).toMatchObject({
        clientId: "Choose the client",
        serviceTypeId: "Choose the service",
      })
  })

  it("accepts an identifier that isn't a domain (docs/14 §1)", () => {
    const r = subscriptionSchema.parse({
      ...subscription,
      domain: " AMC 2026  Head office ",
    })
    expect(r.domain).toBe("AMC 2026 Head office")
    const short = subscriptionSchema.safeParse({ ...subscription, domain: "A" })
    expect(short.success).toBe(false)
  })

  it("allows a zero charge", () => {
    expect(
      subscriptionSchema.safeParse({ ...subscription, chargeAmount: "0" }).success
    ).toBe(true)
  })

  it("needs the renewal date after the start date", () => {
    const r = subscriptionSchema.safeParse({ ...subscription, renewalDate: "2025-10-16" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(fieldErrorsFrom(r.error).renewalDate).toBe(
        "Renewal date must be after the start date"
      )
    }
  })

  it("rejects bad domains, amounts and currencies", () => {
    const r = subscriptionSchema.safeParse({
      ...subscription,
      domain: "bad-.pk",
      chargeAmount: "abc",
      currency: "INX",
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(Object.keys(fieldErrorsFrom(r.error)).sort()).toEqual([
        "chargeAmount",
        "currency",
        "domain",
      ])
    }
  })

  it("accepts any ISO currency, not just a fixed list", () => {
    expect(subscriptionSchema.parse({ ...subscription, currency: "inr" }).currency).toBe(
      "INR"
    )
    expect(
      subscriptionSchema.safeParse({ ...subscription, currency: "SAR" }).success
    ).toBe(true)
  })

  it("limits decimals to the currency's minor unit", () => {
    const issue = (chargeAmount: string, currency: string) => {
      const r = subscriptionSchema.safeParse({ ...subscription, chargeAmount, currency })
      return r.success ? null : fieldErrorsFrom(r.error).chargeAmount
    }
    expect(issue("8750.50", "PKR")).toBe("PKR amounts can’t have decimals")
    expect(issue("8750.00", "PKR")).toBeNull()
    expect(issue("49.99", "USD")).toBeNull()
    expect(issue("49.999", "USD")).toBe("USD amounts have at most 2 decimals")
    expect(issue("12.345", "KWD")).toBeNull()
    expect(issue("12.3456", "KWD")).toBe("Enter an amount like 6500 or 6500.50")
    expect(issue("1500", "JPY")).toBeNull()
    expect(issue("1500.5", "JPY")).toBe("JPY amounts can’t have decimals")
  })

  it("warns (only) about start dates more than a day ahead", () => {
    expect(startDateWarning("2026-09-30", "2026-09-29")).toBeNull()
    expect(startDateWarning("2026-10-05", "2026-09-29")).not.toBeNull()
  })
})

describe("csv", () => {
  it("quotes and escapes", () => {
    expect(csvCell('Sheikh & Sons "Builders", Lahore')).toBe(
      '"Sheikh & Sons ""Builders"", Lahore"'
    )
    expect(csvCell(null)).toBe("")
    expect(csvCell(6500)).toBe("6500")
  })

  it("neutralises formulas (docs/05 §6)", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)")
    expect(csvCell("+923001234567")).toBe("'+923001234567")
    expect(csvCell("@cmd")).toBe("'@cmd")
    expect(csvCell("-5")).toBe("'-5")
  })

  it("builds a document with CRLF line endings", () => {
    const csv = toCsv(
      [{ a: "x", b: 1 }],
      [
        { header: "A", value: (r) => r.a },
        { header: "B", value: (r) => r.b },
      ]
    )
    expect(csv).toBe("A,B\r\nx,1\r\n")
  })
})
