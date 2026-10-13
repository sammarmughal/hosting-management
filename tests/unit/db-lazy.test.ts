// src/lib/server/db.ts without DATABASE_URL: importing it must not throw
// (`next build` imports every route), but the first query must fail clearly.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const g = globalThis as { prisma?: unknown }

describe("db client without DATABASE_URL", () => {
  let saved: string | undefined
  let savedClient: unknown
  beforeEach(() => {
    saved = process.env.DATABASE_URL
    savedClient = g.prisma
    delete process.env.DATABASE_URL
    delete g.prisma
    vi.resetModules()
  })
  afterEach(() => {
    if (saved === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = saved
    g.prisma = savedClient
  })

  it("can be imported", async () => {
    await expect(import("@/lib/server/db")).resolves.toHaveProperty("prisma")
  })

  it("fails clearly on first use", async () => {
    const { prisma } = await import("@/lib/server/db")
    expect(() => prisma.admin).toThrow("DATABASE_URL is not set")
  })
})
