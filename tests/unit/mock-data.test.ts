import { describe, expect, it } from "vitest"

import { buildMockData } from "@/lib/mock/data"

// The mock layer must always show every colour, whatever today is.
const NOWS = [
  "2026-09-29T07:00:00Z",
  "2026-09-29T18:59:59Z", // 23:59:59 in Pakistan
  "2026-09-29T19:00:00Z", // midnight in Pakistan
  "2028-02-29T09:00:00Z", // leap day
  "2027-12-31T12:00:00Z",
]

describe.each(NOWS)("buildMockData at %s", (iso) => {
  const d = buildMockData(new Date(iso))

  it("has 3 green, 4 orange, 3 red, 2 expired and 1 cancelled", () => {
    const count = (c: string) => d.services.filter((s) => s.colour === c).length
    expect([
      count("green"),
      count("orange"),
      count("red"),
      count("expired"),
      count("cancelled"),
    ]).toEqual([3, 4, 3, 2, 1])
  })

  it("has two clients with two services, two without email and one without phone", () => {
    expect(d.clients.filter((c) => c.services.length === 2)).toHaveLength(2)
    expect(d.clients.filter((c) => !c.email)).toHaveLength(2)
    expect(d.clients.filter((c) => !c.phone)).toHaveLength(1)
  })

  it("has valid dates and 10 reminders, 8 notifications, 10 payments", () => {
    for (const s of d.services) {
      expect(s.startDate < s.renewalDate).toBe(true)
      expect(s.renewalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    expect(d.reminders).toHaveLength(10)
    expect(new Set(d.reminders.map((r) => r.status))).toEqual(
      new Set(["pending", "sent", "opened", "failed"])
    )
    expect(d.notifications).toHaveLength(8)
    expect(d.payments).toHaveLength(10)
  })

  it("builds real wa.me links for WhatsApp rows", () => {
    for (const r of d.reminders.filter((r) => r.channel === "whatsapp")) {
      expect(r.waLink).toMatch(/^https:\/\/wa\.me\/92\d{10}\?text=/)
    }
  })
})

it("uses no placeholder names", () => {
  const text = JSON.stringify(buildMockData(new Date("2026-09-29T07:00:00Z")))
  expect(text).not.toMatch(/john doe|acme|example\.com|lorem|test client/i)
})
