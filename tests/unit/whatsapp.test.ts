import { describe, expect, it } from "vitest"

import { buildWaLink, formatPhone, normalisePhone } from "@/lib/domain/whatsapp"

describe("normalisePhone", () => {
  it.each([
    ["+923001234567", "923001234567"],
    ["00923001234567", "923001234567"],
    ["03001234567", "923001234567"],
    ["3001234567", "923001234567"],
    ["+971501234567", "971501234567"],
    ["0300-123 4567", "923001234567"],
    ["+92 (300) 123-4567", "923001234567"],
    ["0300.123.4567", "923001234567"],
    ["923001234567", "923001234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected)
  })

  it.each([
    ["12345"],
    [""],
    ["   "],
    ["0300123456"], // 0 + 9 digits
    ["+92300123456789012"], // too long
    ["0300-CALL-NOW"],
  ])("%j → null", (input) => {
    expect(normalisePhone(input)).toBeNull()
  })

  it("handles null and undefined", () => {
    expect(normalisePhone(null)).toBeNull()
    expect(normalisePhone(undefined)).toBeNull()
  })
})

describe("formatPhone", () => {
  it("formats Pakistani numbers", () => {
    expect(formatPhone("923001234567")).toBe("+92 300 1234567")
  })
  it("prefixes other countries with +", () => {
    expect(formatPhone("971501234567")).toBe("+971501234567")
  })
})

describe("buildWaLink", () => {
  it("builds a plain chat link without text", () => {
    expect(buildWaLink("923001234567")).toBe("https://wa.me/923001234567")
  })

  it("encodes newlines as %0A", () => {
    const url = buildWaLink("923001234567", "Line 1\nLine 2")
    expect(url).toBe("https://wa.me/923001234567?text=Line%201%0ALine%202")
  })

  it("encodes Urdu text and emoji so they round-trip", () => {
    const message = "السلام علیکم 🔴 *clientb.pk* & more?"
    const link = buildWaLink("923001234567", message)
    // Only printable ASCII in the raw link: everything else is %-encoded.
    expect(link).toMatch(/^[\x21-\x7e]+$/)
    const url = new URL(link)
    expect(url.origin + url.pathname).toBe("https://wa.me/923001234567")
    expect(url.searchParams.get("text")).toBe(message)
  })
})
