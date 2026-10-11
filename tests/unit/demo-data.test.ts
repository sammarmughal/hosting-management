import { describe, expect, it } from "vitest"

import { serviceColour } from "@/lib/domain/status"
import { normalisePhone } from "@/lib/domain/whatsapp"

import { CLIENTS, NOTIFICATIONS, PAYMENTS, REMINDERS } from "../../prisma/demo-data"

// The demo seed (SEED_DEMO=1) must keep showing every colour, whatever today is.
const services = CLIENTS.flatMap((c) => c.services)

describe("demo data", () => {
  it("has 3 green, 4 orange, 3 red, 2 expired and 1 cancelled", () => {
    const colours = services.map((s) => serviceColour(s.days ?? 365, s.status ?? "active"))
    const count = (c: string) => colours.filter((x) => x === c).length
    expect(["green", "orange", "red", "expired", "cancelled"].map(count)).toEqual([
      3, 4, 3, 2, 1,
    ])
  })

  it("has two clients with two services, two without email and one without phone", () => {
    expect(CLIENTS.filter((c) => c.services.length === 2)).toHaveLength(2)
    expect(CLIENTS.filter((c) => !c.email)).toHaveLength(2)
    expect(CLIENTS.filter((c) => !c.phone)).toHaveLength(1)
    for (const c of CLIENTS) if (c.phone) expect(normalisePhone(c.phone)).not.toBeNull()
  })

  it("only refers to services that exist", () => {
    const ids = new Set(services.map((s) => s.id))
    for (const r of [...REMINDERS, ...NOTIFICATIONS, ...PAYMENTS])
      expect(ids.has(r.serviceId)).toBe(true)
    expect(new Set(services.map((s) => s.domain)).size).toBe(services.length)
  })

  it("uses no placeholder names", () => {
    expect(JSON.stringify(CLIENTS)).not.toMatch(/john doe|acme|example\.com|lorem|test client/i)
  })
})
