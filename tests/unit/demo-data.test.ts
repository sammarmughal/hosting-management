import { describe, expect, it } from "vitest"

import { DEFAULT_SERVICE_TYPES } from "@/lib/domain/service-types"
import { subscriptionColour } from "@/lib/domain/status"
import { normalisePhone } from "@/lib/domain/whatsapp"

import { CLIENTS, NOTIFICATIONS, PAYMENTS, REMINDERS } from "../../prisma/demo-data"

// The demo seed (SEED_DEMO=1) must keep showing every colour, whatever today is.
const subs = CLIENTS.flatMap((c) => c.subscriptions)

describe("demo data", () => {
  it("has 3 green, 4 orange, 3 red, 2 expired and 1 cancelled", () => {
    const colours = subs.map((s) =>
      subscriptionColour(s.days ?? 365, s.status ?? "active")
    )
    const count = (c: string) => colours.filter((x) => x === c).length
    expect(["green", "orange", "red", "expired", "cancelled"].map(count)).toEqual([
      3, 4, 3, 2, 1,
    ])
  })

  it("has two clients with two subscriptions, two without email and one without phone", () => {
    expect(CLIENTS.filter((c) => c.subscriptions.length === 2)).toHaveLength(2)
    expect(CLIENTS.filter((c) => !c.email)).toHaveLength(2)
    expect(CLIENTS.filter((c) => !c.phone)).toHaveLength(1)
    for (const c of CLIENTS) if (c.phone) expect(normalisePhone(c.phone)).not.toBeNull()
  })

  it("only refers to subscriptions that exist", () => {
    const ids = new Set(subs.map((s) => s.id))
    for (const r of [...REMINDERS, ...NOTIFICATIONS, ...PAYMENTS])
      expect(ids.has(r.subscriptionId)).toBe(true)
    expect(new Set(subs.map((s) => s.domain)).size).toBe(subs.length)
  })

  it("puts subscriptions only under their own client's companies, and uses catalog names (docs/14)", () => {
    const catalog = new Set<string>(DEFAULT_SERVICE_TYPES)
    for (const c of CLIENTS) {
      const names = new Set((c.companies ?? []).map((co) => co.name))
      for (const s of c.subscriptions) {
        if (s.company) expect(names.has(s.company)).toBe(true)
        if (s.service) expect(catalog.has(s.service)).toBe(true)
      }
    }
    // Some companies, some subscriptions without one.
    expect(CLIENTS.some((c) => (c.companies?.length ?? 0) === 2)).toBe(true)
    expect(subs.some((s) => !s.company)).toBe(true)
  })

  it("uses no placeholder names", () => {
    expect(JSON.stringify(CLIENTS)).not.toMatch(
      /john doe|acme|example\.com|lorem|test client/i
    )
  })
})
