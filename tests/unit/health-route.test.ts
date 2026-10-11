import { beforeEach, describe, expect, it, vi } from "vitest"

const queryRaw = vi.fn()
vi.mock("@/lib/server/db", () => ({
  prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) },
}))

const { GET } = await import("@/app/api/health/route")

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRaw.mockReset()
  })

  it("is ok with the database reachable, and says nothing else", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(await res.json()).toEqual({ status: "ok", db: "ok" })
  })

  it("answers 503 without the error text when the database fails", async () => {
    queryRaw.mockRejectedValue(
      new Error("password authentication failed for user neondb_owner")
    )
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.text()
    expect(JSON.parse(body)).toEqual({ status: "error", db: "unreachable" })
    expect(body).not.toMatch(/password|neondb/)
  })

  it("gives up after a few seconds when the database hangs", async () => {
    vi.useFakeTimers()
    queryRaw.mockReturnValue(new Promise(() => {}))
    const pending = GET()
    await vi.advanceTimersByTimeAsync(3000)
    expect((await pending).status).toBe(503)
    vi.useRealTimers()
  })
})
