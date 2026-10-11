// `npm run setup:prod` loads no seed data: the app must work with empty
// settings and message_templates tables (built-in defaults), against hrm_test.
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { DEFAULT_TEMPLATES } from "@/lib/domain/default-templates"
import { prisma } from "@/lib/server/db"
import { runCheck } from "@/lib/server/reminders"
import { getAppSettings, getPreferences, getTemplate } from "@/lib/server/settings"

const enabled = !!process.env.TEST_DATABASE_URL

describe.skipIf(!enabled)("fresh production install (no seed data)", () => {
  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE clients, services, payments, reminders, notifications,
      settings, message_templates, audit_log, invoices, invoice_counters RESTART IDENTITY CASCADE`
    process.env.FAKE_TODAY = "2026-10-11"
  })
  afterAll(() => prisma.$disconnect())

  it("reads settings and templates from the built-in defaults", async () => {
    const s = await getAppSettings()
    expect(s.defaultCurrency).toBe("PKR")
    expect(s.enabledCurrencies).toEqual(["AED", "PKR", "USD"])
    expect(s.invoices.prefix).toBe("INV")
    const prefs = await getPreferences()
    expect(prefs.business.enabledCurrencies).toEqual(["AED", "PKR", "USD"])
    expect((await getTemplate("client_email")).body).toBe(
      DEFAULT_TEMPLATES.client_email.body
    )
  })

  it("runs the daily check on an empty database", async () => {
    const result = await runCheck({ force: true })
    expect(result).toBeTruthy()
    expect(
      (await prisma.setting.findUnique({ where: { key: "last_check_at" } }))?.value
    ).toBeTruthy()
  })
})
