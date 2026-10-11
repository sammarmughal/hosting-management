import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const runCheck = vi.fn(async () => ({ ran: true, queuedNew: 3, invoicesNew: 1 }))
vi.mock("@/lib/server/reminders", () => ({ runCheck }))

const { GET, POST } = await import("@/app/api/cron/check/route")

const SECRET = "s".repeat(40)
const call = (handler: typeof GET, auth?: string) =>
  handler(
    new Request("https://renewals.example.pk/api/cron/check", {
      method: handler === GET ? "GET" : "POST",
      headers: auth === undefined ? {} : { authorization: auth },
    })
  )

describe("/api/cron/check (scheduled daily check)", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET
    runCheck.mockClear()
  })
  afterEach(() => {
    delete process.env.CRON_SECRET
  })

  it.each([
    ["no header", undefined],
    ["empty", ""],
    ["wrong secret", `Bearer ${"x".repeat(40)}`],
    ["secret without Bearer", SECRET],
    ["shorter prefix", `Bearer ${SECRET.slice(0, 10)}`],
    ["different scheme", `Basic ${SECRET}`],
  ])("rejects %s with 401 and doesn't run the check", async (_, auth) => {
    for (const h of [GET, POST]) {
      const res = await call(h, auth)
      expect(res.status).toBe(401)
    }
    expect(runCheck).not.toHaveBeenCalled()
  })

  it("answers 503 and does nothing when CRON_SECRET isn't configured", async () => {
    delete process.env.CRON_SECRET
    expect((await call(GET, `Bearer ${SECRET}`)).status).toBe(503)
    process.env.CRON_SECRET = "too-short"
    expect((await call(POST, "Bearer too-short")).status).toBe(503)
    expect(runCheck).not.toHaveBeenCalled()
  })

  it("runs the same forced, idempotent check for GET (Vercel Cron) and POST", async () => {
    for (const h of [GET, POST]) {
      const res = await call(h, `Bearer ${SECRET}`)
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ ran: true, invoicesNew: 1 })
    }
    expect(runCheck).toHaveBeenCalledTimes(2)
    expect(runCheck).toHaveBeenCalledWith({ force: true })
  })
})
