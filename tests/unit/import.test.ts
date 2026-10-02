import { describe, expect, it } from "vitest"
import { previewImport } from "@/lib/domain/import"
import { reminderSettingsSchema, INITIAL_PREFERENCES } from "@/lib/domain/preferences"

const row = {
  client_name: "Faisal Ahmed",
  email: "faisal@faisalprint.pk",
  domain: "faisalprint.pk",
  start_date: "30/09/2025",
  renewal_date: "30/09/2026",
  charge_amount: "6,500",
  currency: "PKR",
}
describe("import preview", () => {
  it("accepts day-first dates and validates normalized amounts", () => {
    const [r] = previewImport([row], [], "2026-10-02")
    expect(r?.status).toBe("valid")
    expect(r?.input.service.startDate).toBe("2025-09-30")
  })
  it("fills an omitted renewal date and warns without blocking", () => {
    const [r] = previewImport([{ ...row, renewal_date: "" }], [], "2026-10-02")
    expect(r?.input.service.renewalDate).toBe("2026-09-30")
    expect(r?.status).toBe("warning")
  })
  it("distinguishes existing domains from duplicate rows", () => {
    const rows = previewImport([row, row], [row.domain], "2026-10-02")
    expect(rows.map((r) => r.status)).toEqual(["warning", "error"])
    expect(rows[0]?.existing).toBe(true)
  })
  it("rejects invalid dates, contacts, and money", () => {
    for (const patch of [
      { start_date: "2025-02-30" },
      { email: "bad" },
      { charge_amount: "hello" },
    ])
      expect(previewImport([{ ...row, ...patch }], [])[0]?.status).toBe("error")
  })
})
describe("reminder settings validation", () => {
  it("requires ordered thresholds, unique bounded stages and a pre-expiry stage", () => {
    const valid = INITIAL_PREFERENCES.reminders
    expect(reminderSettingsSchema.safeParse(valid).success).toBe(true)
    for (const patch of [
      { red: 40 },
      { stages: [-3] },
      { stages: [7, 7] },
      { stages: [91] },
    ])
      expect(reminderSettingsSchema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
})
