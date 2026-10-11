import { describe, expect, it } from "vitest"

import { pickClientIp, trustedIpHeader } from "@/lib/domain/client-ip"

const headers = (h: Record<string, string>) => (name: string) => h[name] ?? null

describe("trusted client-IP header (TRUSTED_IP_HEADER)", () => {
  it("defaults to x-forwarded-for, first value", () => {
    expect(pickClientIp(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), undefined)).toBe("203.0.113.7")
  })
  it("uses the configured header and ignores the others", () => {
    const h = headers({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "198.51.100.2" })
    expect(pickClientIp(h, "X-Real-IP")).toBe("198.51.100.2")
    expect(pickClientIp(h, "cf-connecting-ip")).toBe("unknown")
  })
  it("falls back to the default for an empty or malformed setting", () => {
    expect(trustedIpHeader("")).toBe("x-forwarded-for")
    expect(trustedIpHeader("x forwarded")).toBe("x-forwarded-for")
    expect(trustedIpHeader(" X-Vercel-Forwarded-For ")).toBe("x-vercel-forwarded-for")
  })
  it("is 'unknown' without the header, and never longer than the column", () => {
    expect(pickClientIp(headers({}), undefined)).toBe("unknown")
    expect(pickClientIp(headers({ "x-forwarded-for": "x".repeat(80) }), undefined)).toHaveLength(45)
  })
})
