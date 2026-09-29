import { describe, expect, it } from "vitest"

import { csvCell, toCsv } from "@/lib/domain/csv"
import { isValidDomain, normaliseDomain } from "@/lib/domain/hostname"
import {
  clientSchema,
  fieldErrorsFrom,
  serviceSchema,
  startDateWarning,
  type ClientInput,
  type ServiceInput,
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

const client: ClientInput = {
  name: "Noor Dental Clinic",
  company: "",
  email: "Info@NoorDental.pk ",
  phone: "0321 4455667",
  notes: "",
}

describe("clientSchema", () => {
  it("normalises email and phone, and turns empty strings into null", () => {
    const r = clientSchema.parse(client)
    expect(r).toEqual({
      name: "Noor Dental Clinic",
      company: null,
      email: "info@noordental.pk",
      phone: "923214455667",
      notes: null,
    })
  })

  it("needs a name of at least 2 characters", () => {
    const r = clientSchema.safeParse({ ...client, name: " A " })
    expect(r.success).toBe(false)
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

const service: ServiceInput = {
  domain: "https://www.NoorDental.pk/",
  planLabel: "Business",
  startDate: "2025-10-16",
  renewalDate: "2026-10-16",
  chargeAmount: "8,750",
  currency: "PKR",
  remindersEnabled: true,
  notes: "",
}

describe("serviceSchema", () => {
  it("normalises the domain and amount", () => {
    const r = serviceSchema.parse(service)
    expect(r.domain).toBe("noordental.pk")
    expect(r.chargeAmount).toBe("8750")
    expect(r.notes).toBeNull()
  })

  it("allows a zero charge", () => {
    expect(serviceSchema.safeParse({ ...service, chargeAmount: "0" }).success).toBe(true)
  })

  it("needs the renewal date after the start date", () => {
    const r = serviceSchema.safeParse({ ...service, renewalDate: "2025-10-16" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(fieldErrorsFrom(r.error).renewalDate).toBe(
        "Renewal date must be after the start date"
      )
    }
  })

  it("rejects bad domains, amounts and currencies", () => {
    const r = serviceSchema.safeParse({
      ...service,
      domain: "not a domain",
      chargeAmount: "abc",
      currency: "INR",
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
