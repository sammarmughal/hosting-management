import { describe, expect, it } from "vitest"

import { decrypt, encrypt } from "@/lib/server/crypto"

describe("AES-256-GCM with APP_KEY (docs/05 §10)", () => {
  it("round-trips and never stores the plain text", () => {
    const stored = encrypt("smtp-pässword")
    expect(stored).not.toContain("smtp")
    expect(stored.startsWith("v1.")).toBe(true)
    expect(decrypt(stored)).toBe("smtp-pässword")
  })

  it("uses a fresh IV each time", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"))
  })

  it("rejects tampered values and a changed APP_KEY", () => {
    const stored = encrypt("secret")
    const parts = stored.split(".")
    parts[3] = Buffer.from("other").toString("base64url")
    expect(() => decrypt(parts.join("."))).toThrow()

    const key = process.env.APP_KEY
    process.env.APP_KEY = `base64:${Buffer.alloc(32, 9).toString("base64")}`
    try {
      expect(() => decrypt(stored)).toThrow()
    } finally {
      process.env.APP_KEY = key
    }
  })
})
