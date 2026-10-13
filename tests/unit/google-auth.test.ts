// Sign in with Google: the allowlist and ID token checks (docs/05 §3a).
import { describe, expect, it } from "vitest"

import {
  authConfig,
  googleLoginDecision,
  loginErrorMessage,
  parseAllowlist,
  type GoogleClaims,
} from "@/lib/domain/google-auth"

const CLIENT_ID = "test-client-id.apps.googleusercontent.com"
const OWNER = "abdulrehmaan060@gmail.com"
const NOW = new Date("2026-10-13T12:00:00Z")
const exp = NOW.getTime() / 1000 + 3600

const claims = (over: GoogleClaims = {}): GoogleClaims => ({
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  exp,
  email: OWNER,
  email_verified: true,
  ...over,
})
const decide = (c: GoogleClaims, allowlist = [OWNER]) =>
  googleLoginDecision(c, { clientId: CLIENT_ID, allowlist, now: NOW })

describe("ADMIN_EMAILS", () => {
  it("is comma-separated, trimmed, lower-cased and de-duplicated", () => {
    expect(parseAllowlist(` ${OWNER} , Second@Example.com,,second@example.com `)).toEqual(
      [OWNER, "second@example.com"]
    )
  })
  it("drops anything that isn't an email address", () => {
    expect(parseAllowlist("not-an-email, @example.com, a b@example.com")).toEqual([])
    expect(parseAllowlist(undefined)).toEqual([])
  })
})

describe("the allowlist decision", () => {
  it("lets an allowlisted, verified account in", () => {
    expect(decide(claims())).toEqual({ ok: true, email: OWNER })
    // Older tokens use the issuer without https://.
    expect(decide(claims({ iss: "accounts.google.com" })).ok).toBe(true)
  })

  it("rejects any other Google account", () => {
    expect(decide(claims({ email: "someone.else@gmail.com" }))).toEqual({
      ok: false,
      reason: "not_allowed",
      email: "someone.else@gmail.com",
    })
    // Gmail dots and +tags are not folded: only the exact address counts.
    expect(decide(claims({ email: "abdul.rehmaan060@gmail.com" })).ok).toBe(false)
    expect(decide(claims({ email: "abdulrehmaan060+x@gmail.com" })).ok).toBe(false)
    // An empty allowlist lets no one in.
    expect(decide(claims(), []).ok).toBe(false)
  })

  it("rejects an email Google doesn't report as verified", () => {
    for (const email_verified of [false, undefined, "true", 1, null])
      expect(decide(claims({ email_verified }))).toEqual({
        ok: false,
        reason: "unverified",
        email: OWNER,
      })
  })

  it("ignores letter case in the token and in ADMIN_EMAILS", () => {
    expect(decide(claims({ email: "AbdulRehmaan060@Gmail.COM" }))).toEqual({
      ok: true,
      email: OWNER,
    })
    expect(decide(claims(), ["ABDULREHMAAN060@GMAIL.COM"]).ok).toBe(true)
    // The same through the env parser.
    expect(
      decide(
        claims({ email: "ABDULREHMAAN060@gmail.com" }),
        parseAllowlist("AbdulRehmaan060@GMAIL.com")
      ).ok
    ).toBe(true)
  })

  it("rejects tokens for another app, from another issuer, expired, or without an email", () => {
    expect(decide(claims({ aud: "someone-elses-client" })).ok).toBe(false)
    expect(decide(claims({ aud: [CLIENT_ID, "other"] })).ok).toBe(true)
    expect(decide(claims({ iss: "https://evil.example" })).ok).toBe(false)
    expect(decide(claims({ exp: NOW.getTime() / 1000 - 1 })).ok).toBe(false)
    expect(decide(claims({ exp: String(exp) })).ok).toBe(false)
    expect(decide(claims({ email: undefined }))).toEqual({
      ok: false,
      reason: "invalid_token",
      email: null,
    })
  })
})

describe("configuration", () => {
  const google = {
    GOOGLE_CLIENT_ID: CLIENT_ID,
    GOOGLE_CLIENT_SECRET: "secret",
    ADMIN_EMAILS: OWNER,
  }

  it("turns Google on only with the client id, secret and at least one email", () => {
    expect(authConfig(google).google).toEqual({
      clientId: CLIENT_ID,
      clientSecret: "secret",
      allowlist: [OWNER],
    })
    expect(authConfig({ ...google, GOOGLE_CLIENT_SECRET: "" }).google).toBeNull()
    expect(authConfig({ ...google, ADMIN_EMAILS: " , " }).google).toBeNull()
    expect(authConfig({}).google).toBeNull()
  })

  it("password login can be turned off, but never without Google", () => {
    expect(authConfig(google).passwordLogin).toBe(true)
    expect(authConfig({ ...google, PASSWORD_LOGIN_ENABLED: "0" }).passwordLogin).toBe(
      false
    )
    expect(authConfig({ ...google, PASSWORD_LOGIN_ENABLED: "off" }).passwordLogin).toBe(
      false
    )
    expect(authConfig({ ...google, PASSWORD_LOGIN_ENABLED: "1" }).passwordLogin).toBe(
      true
    )
    // Google not configured: the flag is ignored, so nobody gets locked out.
    expect(authConfig({ PASSWORD_LOGIN_ENABLED: "0" }).passwordLogin).toBe(true)
  })

  it("every refusal reads the same on /login", () => {
    expect(loginErrorMessage("invalid")).toBe("Invalid credentials.")
    expect(loginErrorMessage("anything-else")).toBe("Invalid credentials.")
    expect(loginErrorMessage(undefined)).toBeNull()
  })
})
