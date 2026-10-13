// /api/auth/google and its callback (docs/05 §3a): cookies, state check,
// redirects. Google, the DB and the session are mocked here; the allowlist
// itself is covered by google-auth.test.ts and google-login.int.test.ts.
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const jar = new Map<string, string>()
const cookieWrites: { name: string; value: string; opts?: Record<string, unknown> }[] = []
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string, opts?: Record<string, unknown>) => {
      cookieWrites.push({ name, value, opts })
    },
  }),
}))

const completeGoogleLogin = vi.fn()
vi.mock("@/lib/server/google-login", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/google-login")>()),
  completeGoogleLogin: (...a: unknown[]) => completeGoogleLogin(...a),
}))
const startSession = vi.fn(async () => ({ id: "f".repeat(64) }))
vi.mock("@/lib/server/session", () => ({
  clientIp: async () => "203.0.113.9",
  userAgent: async () => "Mozilla/5.0 (Windows NT 10.0) Chrome/130",
  startSession: (...a: unknown[]) => startSession(...(a as [])),
}))
const audit = vi.fn()
vi.mock("@/lib/server/audit", () => ({ audit: (...a: unknown[]) => audit(...a) }))
vi.mock("@/lib/server/db", () => ({
  prisma: { session: { deleteMany: vi.fn() }, admin: { update: vi.fn() } },
}))

const start = await import("@/app/api/auth/google/route")
const callback = await import("@/app/api/auth/google/callback/route")

const APP = "https://renewals.example.pk"
const cb = (query: string) =>
  callback.GET(new NextRequest(`${APP}/api/auth/google/callback?${query}`))

describe("Sign in with Google routes", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      APP_URL: APP,
      GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "secret",
      ADMIN_EMAILS: "abdulrehmaan060@gmail.com",
    })
    jar.clear()
    cookieWrites.length = 0
    completeGoogleLogin.mockReset()
    startSession.mockClear()
    audit.mockClear()
  })
  afterEach(() => {
    for (const k of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ADMIN_EMAILS"])
      delete process.env[k]
  })

  it("start: redirects to Google with PKCE, our callback and the account chooser, and sets Lax cookies", async () => {
    const res = await start.GET()
    expect(res.status).toBe(303)
    const url = new URL(res.headers.get("location")!)
    expect(url.origin).toBe("https://accounts.google.com")
    expect(url.searchParams.get("redirect_uri")).toBe(`${APP}/api/auth/google/callback`)
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("scope")).toBe("openid email")
    expect(url.searchParams.get("prompt")).toBe("select_account")
    const set = res.headers.getSetCookie().join("\n")
    expect(set).toMatch(new RegExp(`hrm_google_state=${url.searchParams.get("state")}`))
    expect(set).toMatch(/hrm_google_verifier=/)
    expect(set).toMatch(/SameSite=lax/i)
    expect(set).toMatch(/HttpOnly/i)
    expect(set).toMatch(/Path=\/api\/auth\/google/)
  })

  it("start: without the Google settings it goes back to /login", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET
    const res = await start.GET()
    expect(res.headers.get("location")).toBe(`${APP}/login`)
  })

  it("callback: a missing or different state is refused before anything else", async () => {
    jar.set("hrm_google_state", "state-a")
    jar.set("hrm_google_verifier", "verifier")
    for (const q of ["code=c&state=state-b", "code=c", "state=state-a"]) {
      const res = await cb(q)
      expect(res.headers.get("location")).toBe(`${APP}/login?error=expired`)
    }
    jar.clear()
    expect((await cb("code=c&state=state-a")).headers.get("location")).toBe(
      `${APP}/login?error=expired`
    )
    expect(completeGoogleLogin).not.toHaveBeenCalled()
    expect(startSession).not.toHaveBeenCalled()
    // The flow cookies are cleared every time.
    expect(
      cookieWrites.filter((w) => w.value === "" && w.opts?.maxAge === 0).length
    ).toBeGreaterThan(0)
  })

  it("callback: cancelled on Google's side", async () => {
    const res = await cb("error=access_denied&state=x")
    expect(res.headers.get("location")).toBe(`${APP}/login?error=cancelled`)
  })

  it("callback: a rejected account goes back with the neutral error and gets no session", async () => {
    jar.set("hrm_google_state", "s")
    jar.set("hrm_google_verifier", "v")
    completeGoogleLogin.mockResolvedValue({ ok: false, error: "invalid" })
    const res = await cb("code=c&state=s")
    expect(res.headers.get("location")).toBe(`${APP}/login?error=invalid`)
    expect(completeGoogleLogin).toHaveBeenCalledWith(
      expect.objectContaining({ code: "c", codeVerifier: "v", ip: "203.0.113.9" })
    )
    expect(startSession).not.toHaveBeenCalled()
  })

  it("callback: an allowed account gets a full session (no 2FA step) and a same-site hop to the dashboard", async () => {
    jar.set("hrm_google_state", "s")
    jar.set("hrm_google_verifier", "v")
    completeGoogleLogin.mockResolvedValue({
      ok: true,
      adminId: 1,
      email: "abdulrehmaan060@gmail.com",
    })
    const res = await cb("code=c&state=s")
    expect(startSession).toHaveBeenCalledWith(1, "full")
    expect(audit).toHaveBeenCalledWith(
      "login.success",
      expect.objectContaining({
        details: expect.objectContaining({
          method: "google",
          googleEmail: "abdulrehmaan060@gmail.com",
        }),
      })
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("referrer-policy")).toBe("no-referrer")
    expect(await res.text()).toContain('http-equiv="refresh" content="0;url=/dashboard"')
  })
})
