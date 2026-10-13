// Sign in with Google against the hrm_test database (docs/05 §3a): the
// allowlist, the log and the throttle, with Google's code exchange faked.
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import type { GoogleClaims } from "@/lib/domain/google-auth"
import { prisma } from "@/lib/server/db"
import { completeGoogleLogin } from "@/lib/server/google-login"

import { resetDb } from "../helpers/reset-db"

const enabled = !!process.env.TEST_DATABASE_URL
const OWNER = "abdulrehmaan060@gmail.com"
const cfg = {
  clientId: "test-client.apps.googleusercontent.com",
  clientSecret: "x",
  allowlist: [OWNER],
}
const IP = "203.0.113.50"

const token = (over: GoogleClaims = {}): GoogleClaims => ({
  iss: "https://accounts.google.com",
  aud: cfg.clientId,
  exp: Date.now() / 1000 + 600,
  email: OWNER,
  email_verified: true,
  ...over,
})
const login = (claims: GoogleClaims | Error, ip = IP) =>
  completeGoogleLogin({
    cfg,
    code: "code",
    codeVerifier: "verifier",
    ip,
    exchange: async () => {
      if (claims instanceof Error) throw claims
      return claims
    },
  })

const attempts = () =>
  prisma.loginAttempt.findMany({
    orderBy: { id: "asc" },
    select: { identifier: true, step: true, success: true },
  })
const rejections = async () =>
  (
    await prisma.auditLog.findMany({
      where: { action: "login.google_rejected" },
      orderBy: { id: "asc" },
    })
  ).map((r) => r.details)

describe.skipIf(!enabled)("Sign in with Google (docs/05 §3a)", () => {
  let adminId = 0
  beforeEach(async () => {
    await resetDb(prisma, ["admins", "login_attempts", "audit_log"])
    adminId = (
      await prisma.admin.create({
        data: { username: "rehman", email: "billing@example.com", passwordHash: "x" },
      })
    ).id
  })
  afterAll(() => prisma.$disconnect())

  it("signs the allowlisted, verified account in as the single admin", async () => {
    expect(await login(token())).toEqual({ ok: true, adminId, email: OWNER })
    expect(await attempts()).toEqual([
      { identifier: OWNER, step: "google", success: true },
    ])
  })

  it("ignores letter case", async () => {
    expect(await login(token({ email: "AbdulRehmaan060@GMAIL.com" }))).toMatchObject({
      ok: true,
      email: OWNER,
    })
  })

  it("rejects any other account with the neutral error, and logs it", async () => {
    expect(await login(token({ email: "stranger@gmail.com" }))).toEqual({
      ok: false,
      error: "invalid",
    })
    expect(await rejections()).toEqual([
      { email: "stranger@gmail.com", reason: "not_allowed" },
    ])
    expect(await attempts()).toEqual([
      { identifier: "stranger@gmail.com", step: "google", success: false },
    ])
  })

  it("rejects an unverified email, even when it's on the allowlist", async () => {
    expect(await login(token({ email_verified: false }))).toEqual({
      ok: false,
      error: "invalid",
    })
    expect(await rejections()).toEqual([{ email: OWNER, reason: "unverified" }])
  })

  it("logs a failed code exchange without an email", async () => {
    expect(await login(new Error("invalid_grant"))).toEqual({
      ok: false,
      error: "invalid",
    })
    expect(await rejections()).toEqual([{ email: null, reason: "exchange_failed" }])
  })

  it("is throttled like the password step: 5 failures from an IP lock it, even for the owner", async () => {
    for (let i = 0; i < 5; i++) await login(token({ email: `stranger${i}@gmail.com` }))
    expect(await login(token())).toEqual({ ok: false, error: "locked" })
    // Another IP is fine.
    expect((await login(token(), "198.51.100.1")).ok).toBe(true)
  })

  it("refuses when there is no admin account yet", async () => {
    await resetDb(prisma, ["admins"])
    expect(await login(token())).toEqual({ ok: false, error: "invalid" })
    expect(await rejections()).toEqual([{ email: OWNER, reason: "no_admin" }])
  })
})
