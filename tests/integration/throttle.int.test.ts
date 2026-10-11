// docs/10 §1 throttle.int.test.ts (docs/05 §4), against the hrm_test database.
import { beforeEach, describe, expect, it } from "vitest"

import { prisma } from "@/lib/server/db"
import { isLocked, recordAttempt } from "@/lib/server/throttle"

const enabled = !!process.env.TEST_DATABASE_URL
const MIN = 60_000

async function fail(ip: string, identifier: string, at: Date) {
  await recordAttempt(ip, identifier, "password", false)
  // Backdate so a fake clock can be used for the window checks.
  const last = await prisma.loginAttempt.findFirstOrThrow({ orderBy: { id: "desc" } })
  await prisma.loginAttempt.update({ where: { id: last.id }, data: { attemptedAt: at } })
}

describe.skipIf(!enabled)("login throttling (docs/05 §4)", () => {
  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE login_attempts RESTART IDENTITY`
  })

  it("blocks the 6th attempt after 5 failures in 15 minutes, and lifts after 15 minutes", async () => {
    const now = new Date("2026-10-10T10:00:00Z")
    for (let i = 0; i < 5; i++) await fail("203.0.113.5", "rehman", new Date(now.getTime() - i * MIN))
    expect(await isLocked("203.0.113.5", "rehman", now)).toBe(true)
    expect(await isLocked("203.0.113.5", "rehman", new Date(now.getTime() + 15 * MIN))).toBe(false)
  })

  it("locks per identifier across IPs, and per IP across identifiers", async () => {
    const now = new Date("2026-10-10T10:00:00Z")
    for (let i = 0; i < 5; i++) await fail(`198.51.100.${i}`, "rehman", now)
    expect(await isLocked("198.51.100.99", "rehman", now)).toBe(true)
    expect(await isLocked("198.51.100.99", "someone-else", now)).toBe(false)

    await prisma.$executeRaw`TRUNCATE login_attempts RESTART IDENTITY`
    for (let i = 0; i < 5; i++) await fail("192.0.2.7", `guess${i}`, now)
    expect(await isLocked("192.0.2.7", "rehman", now)).toBe(true)
  })

  it("a success doesn't reset the IP counter for other usernames", async () => {
    const now = new Date()
    for (let i = 0; i < 4; i++) await fail("192.0.2.9", `guess${i}`, now)
    await recordAttempt("192.0.2.9", "rehman", "password", true)
    await fail("192.0.2.9", "guess9", now)
    expect(await isLocked("192.0.2.9", "another", now)).toBe(true)
  })

  it("20 failures from one IP in 24 hours lock it for the day", async () => {
    const now = new Date("2026-10-10T10:00:00Z")
    // Spread out so no 15-minute window has 5.
    for (let i = 0; i < 20; i++) await fail("192.0.2.20", `u${i}`, new Date(now.getTime() - i * 60 * MIN))
    expect(await isLocked("192.0.2.20", "new-user", now)).toBe(true)
  })
})
