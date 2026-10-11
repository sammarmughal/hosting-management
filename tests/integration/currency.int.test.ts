// docs/13 §6 against the hrm_test database: the client-currency backfill in
// the migration, and the usage that keeps a currency switched on.
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { currencyInUseError } from "@/lib/domain/currency"
import { prisma } from "@/lib/server/db"
import { toDbDate } from "@/lib/server/db-dates"
import { getCurrencyUsage, updateSettings } from "@/lib/server/settings"
import { SETTING_DEFAULTS } from "@/lib/server/settings-keys"

const enabled = !!process.env.TEST_DATABASE_URL

/** The UPDATE between "-- backfill:begin" and "-- backfill:end" in the migration. */
function backfillSql(): string {
  const dir = path.join(process.cwd(), "prisma", "migrations")
  const name = readdirSync(dir).find((d) =>
    d.endsWith("_client_currency_and_money_scale")
  )
  if (!name) throw new Error("client currency migration not found")
  const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8")
  const m = /-- backfill:begin\r?\n([\s\S]*?)-- backfill:end/.exec(sql)
  if (!m?.[1]) throw new Error("backfill markers not found")
  return m[1]
}

async function reset() {
  await prisma.$executeRaw`TRUNCATE clients, services, payments, reminders, notifications,
    settings, invoices RESTART IDENTITY CASCADE`
  for (const [key, value] of Object.entries(SETTING_DEFAULTS))
    await prisma.setting.create({ data: { key, value } })
}

let seq = 0
async function client(name: string, serviceCurrencies: string[], currency = "ZZZ") {
  return prisma.client.create({
    data: {
      name,
      email: `${name.toLowerCase()}@client.pk`,
      // "ZZZ" stands in for the empty column the migration adds.
      currency,
      services: {
        create: serviceCurrencies.map((c) => ({
          domain: `s${++seq}.pk`,
          startDate: toDbDate("2025-10-01"),
          renewalDate: toDbDate("2026-10-01"),
          chargeAmount: "100",
          currency: c,
        })),
      },
    },
  })
}

describe.skipIf(!enabled)("client currency migration (docs/13 §6)", () => {
  beforeEach(reset)
  afterAll(() => prisma.$disconnect())

  it("sets each client's currency from their services, else the app default", async () => {
    await updateSettings({ default_currency: "PKR" })
    const ids = {
      uae: (await client("Uae", ["AED", "AED", "USD"])).id,
      pk: (await client("Pk", ["PKR"])).id,
      tie: (await client("Tie", ["USD", "PKR"])).id, // tie → the app default
      tieNoDefault: (await client("TieNoDefault", ["USD", "AED"])).id, // → alphabetical
      none: (await client("None", [])).id,
    }
    // Plain SQL from the migration file (not app code), run as is.
    await prisma.$executeRawUnsafe(backfillSql())
    const rows = await prisma.client.findMany({ select: { id: true, currency: true } })
    const by = new Map(rows.map((r) => [r.id, r.currency]))
    expect(by.get(ids.uae)).toBe("AED")
    expect(by.get(ids.pk)).toBe("PKR")
    expect(by.get(ids.tie)).toBe("PKR")
    expect(by.get(ids.tieNoDefault)).toBe("AED")
    expect(by.get(ids.none)).toBe("PKR")
  })

  it("falls back to the default_currency setting, then PKR", async () => {
    await updateSettings({ default_currency: "aed" })
    const a = await client("NoServices", [])
    await prisma.$executeRawUnsafe(backfillSql())
    expect(
      (await prisma.client.findUniqueOrThrow({ where: { id: a.id } })).currency
    ).toBe("AED")

    await prisma.setting.delete({ where: { key: "default_currency" } })
    await prisma.$executeRawUnsafe(backfillSql())
    expect(
      (await prisma.client.findUniqueOrThrow({ where: { id: a.id } })).currency
    ).toBe("PKR")
  })
})

describe.skipIf(!enabled)("currencies in use stay on (docs/13 §6)", () => {
  beforeEach(reset)
  afterAll(() => prisma.$disconnect())

  it("counts clients and services per currency", async () => {
    await client("Uae", ["AED", "USD"], "AED")
    await client("Pk", ["PKR"], "PKR")
    await client("Mixed", ["AED"], "PKR")
    const usage = await getCurrencyUsage()
    expect(usage).toEqual({
      AED: { clients: 1, services: 2 },
      PKR: { clients: 2, services: 1 },
      USD: { clients: 0, services: 1 },
    })
    expect(currencyInUseError(["AED", "PKR"], usage)).toBe(
      "USD is used by 1 service, so it can’t be turned off."
    )
    expect(currencyInUseError(["AED", "PKR", "USD"], usage)).toBeNull()
  })
})
