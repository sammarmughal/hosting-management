import { describe, expect, it } from "vitest"

import {
  buildWaLink,
  formatPhone,
  linkProvider,
  normalisePhone,
} from "@/lib/domain/whatsapp"

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
  it("keeps the Pakistani format exactly", () => {
    expect(formatPhone("923214455667")).toBe("+92 321 4455667")
    expect(formatPhone("923001112233")).toBe("+92 300 1112233")
  })
  it.each([
    ["971501234567", "+971 50 123 4567"],
    ["966501234567", "+966 50 123 4567"],
    ["447700900123", "+44 7700 900123"],
    ["12025550123", "+1 202 555 0123"],
  ])("formats %s internationally as %s", (digits, expected) => {
    expect(formatPhone(digits)).toBe(expected)
  })
  it("falls back to + and digits when the number can't be placed", () => {
    expect(formatPhone("999123456789")).toBe("+999123456789")
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

  it("encodes characters that would break the query string", () => {
    const message = "a&text=evil#frag+100% /?"
    const url = new URL(buildWaLink("923001234567", message))
    expect([...url.searchParams.keys()]).toEqual(["text"])
    expect(url.searchParams.get("text")).toBe(message)
    expect(url.hash).toBe("")
  })
})

describe("linkProvider (WhatsAppProvider 'link')", () => {
  it("normalises the number and prepares a wa.me link with the text", () => {
    const prepared = linkProvider.prepare({ to: "0300 1234567", text: "Hi\nthere" })
    expect(prepared).toEqual({
      kind: "link",
      url: "https://wa.me/923001234567?text=Hi%0Athere",
    })
    expect(linkProvider.kind).toBe("link")
  })

  it("returns null for a missing or invalid number", () => {
    expect(linkProvider.prepare({ to: null, text: "x" })).toBeNull()
    expect(linkProvider.prepare({ to: "12345", text: "x" })).toBeNull()
  })
})
