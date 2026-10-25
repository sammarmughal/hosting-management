import { describe, expect, it } from "vitest"

import { addDays } from "@/lib/domain/dates"
import {
  checkIsDue,
  dueTitle,
  planCheck,
  rowsFor,
  type CheckConfig,
  type CheckSubscription,
} from "@/lib/domain/reminder-engine"
import { parseStages } from "@/lib/domain/stages"

const TODAY = "2026-10-10"
const cfg: CheckConfig = {
  today: TODAY,
  stages: parseStages("30,15,7,3,1,0,-3,-6,-9"),
  postExpiryToClient: true,
  hasAdminEmail: true,
  hasAdminWhatsapp: true,
}

let nextId = 1
function svc(days: number, patch: Partial<CheckSubscription> = {}): CheckSubscription {
  const id = nextId++
  return {
    id,
    domain: `site${id}.pk`,
    renewalDate: addDays(TODAY, days),
    status: "active",
    remindersEnabled: true,
    clientEmail: `c${id}@example.pk`,
    clientPhone: "923001234567",
    ...patch,
  }
}

describe("planCheck (docs/10 §1 reminders scenario)", () => {
  it("queues d = 30, 12, 0, −4 at stages 30, 15, 0, −3 and skips d = 45", () => {
    const services = [45, 30, 12, 0, -4].map((d) => svc(d))
    const plans = planCheck(services, cfg)
    expect(plans.map((p) => p.daysLeft)).toEqual([30, 12, 0, -4])
    expect(plans.map((p) => p.stage)).toEqual([30, 15, 0, -3])
  })

  it("catches up with only the latest stage (no late spam)", () => {
    // Not opened between day 30 and day 5: only stage 7 is due.
    const [plan] = planCheck([svc(5)], cfg)
    expect(plan?.stage).toBe(7)
  })

  it("stops after the last overdue stage once and keeps it", () => {
    expect(planCheck([svc(-40)], cfg)[0]?.stage).toBe(-9)
  })

  it("leaves out cancelled services and services with reminders off", () => {
    expect(
      planCheck(
        [svc(3, { status: "cancelled" }), svc(3, { remindersEnabled: false })],
        cfg
      )
    ).toEqual([])
  })

  it("keys rows and notifications to the cycle, so a repeat check is a no-op", () => {
    const s = svc(7)
    const [a] = planCheck([s], cfg)
    const [b] = planCheck([s], cfg)
    expect(a?.notification.dedupeKey).toBe(`stage:${s.id}:${s.renewalDate}:7`)
    expect(b?.notification.dedupeKey).toBe(a?.notification.dedupeKey)
    expect(a?.cycle).toBe(s.renewalDate)
  })

  it("titles and types the notification by days left", () => {
    const plans = planCheck([svc(12), svc(0), svc(-4), svc(1)], cfg)
    expect(plans.map((p) => p.notification.type)).toEqual([
      "expiring",
      "expiring",
      "expired",
      "expiring",
    ])
    expect(dueTitle("a.pk", 12)).toBe("a.pk expires in 12 days")
    expect(dueTitle("a.pk", 1)).toBe("a.pk expires in 1 day")
    expect(dueTitle("a.pk", 0)).toBe("a.pk expires today")
    expect(dueTitle("a.pk", -4)).toBe("a.pk expired 4 days ago")
  })

  it("has no plans when there are no stages", () => {
    expect(planCheck([svc(0)], { ...cfg, stages: [] })).toEqual([])
  })
})

describe("rowsFor (docs/04 §3.2)", () => {
  const both = { clientEmail: "a@b.pk", clientPhone: "923001234567" }

  it("queues client email + WhatsApp and admin email + WhatsApp", () => {
    expect(rowsFor(both, 7, cfg)).toEqual([
      { channel: "email", recipient: "client" },
      { channel: "whatsapp", recipient: "client" },
      { channel: "email", recipient: "admin" },
      { channel: "whatsapp", recipient: "admin" },
    ])
  })

  it("skips the client email row when the client has no email", () => {
    expect(rowsFor({ ...both, clientEmail: null }, 7, cfg)).not.toContainEqual({
      channel: "email",
      recipient: "client",
    })
    expect(rowsFor({ ...both, clientEmail: null }, 7, cfg)).toContainEqual({
      channel: "whatsapp",
      recipient: "client",
    })
  })

  it("after expiry with post_expiry_to_client = 0, queues admin rows only", () => {
    expect(rowsFor(both, -3, { ...cfg, postExpiryToClient: false })).toEqual([
      { channel: "email", recipient: "admin" },
      { channel: "whatsapp", recipient: "admin" },
    ])
    // Before expiry the client still gets them.
    expect(rowsFor(both, 0, { ...cfg, postExpiryToClient: false })).toHaveLength(4)
  })

  it("leaves out admin rows when the admin email / WhatsApp are not set", () => {
    expect(
      rowsFor(both, 7, { ...cfg, hasAdminEmail: false, hasAdminWhatsapp: false })
    ).toEqual([
      { channel: "email", recipient: "client" },
      { channel: "whatsapp", recipient: "client" },
    ])
  })
})

describe("checkIsDue (throttle for dashboard loads)", () => {
  const now = new Date("2026-10-10T10:00:00Z")
  it("runs when never run, or when the interval has passed", () => {
    expect(checkIsDue(null, 60, now)).toBe(true)
    expect(checkIsDue("2026-10-10T09:00:00Z", 60, now)).toBe(true)
    expect(checkIsDue("garbage", 60, now)).toBe(true)
  })
  it("skips inside the interval", () => {
    expect(checkIsDue("2026-10-10T09:30:00Z", 60, now)).toBe(false)
  })
})
