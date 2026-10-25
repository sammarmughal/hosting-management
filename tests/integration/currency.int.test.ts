// docs/13 §6 against the hrm_test database: the usage that keeps a currency
// switched on. (The Postgres-era backfill test went with the old migrations:
// the MySQL schema starts fresh, with the currency column required.)
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { currencyInUseError } from "@/lib/domain/currency"
import { prisma } from "@/lib/server/db"
import { toDbDate } from "@/lib/server/db-dates"
import { getCurrencyUsage } from "@/lib/server/settings"
import { SETTING_DEFAULTS } from "@/lib/server/settings-keys"

import { resetDb } from "../helpers/reset-db"

const enabled = !!process.env.TEST_DATABASE_URL

async function reset() {
  await resetDb(prisma, ["clients", "settings"])
  for (const [key, value] of Object.entries(SETTING_DEFAULTS))
    await prisma.setting.create({ data: { key, value } })
}

let seq = 0
async function client(name: string, subscriptionCurrencies: string[], currency: string) {
  const serviceTypeId = (
    await prisma.serviceType.findUniqueOrThrow({ where: { name: "Web Hosting" } })
  ).id
  return prisma.client.create({
    data: {
      name,
      email: `${name.toLowerCase()}@client.pk`,
      currency,
      subscriptions: {
        create: subscriptionCurrencies.map((c) => ({
          serviceTypeId,
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

describe.skipIf(!enabled)("currencies in use stay on (docs/13 §6)", () => {
  beforeEach(reset)
  afterAll(() => prisma.$disconnect())

  it("counts clients and subscriptions per currency", async () => {
    await client("Uae", ["AED", "USD"], "AED")
    await client("Pk", ["PKR"], "PKR")
    await client("Mixed", ["AED"], "PKR")
    const usage = await getCurrencyUsage()
    expect(usage).toEqual({
      AED: { clients: 1, subscriptions: 2 },
      PKR: { clients: 2, subscriptions: 1 },
      USD: { clients: 0, subscriptions: 1 },
    })
    expect(currencyInUseError(["AED", "PKR"], usage)).toBe(
      "USD is used by 1 subscription, so it can’t be turned off."
    )
    expect(currencyInUseError(["AED", "PKR", "USD"], usage)).toBeNull()
  })
})
