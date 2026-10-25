// The companies_subscriptions migration (docs/14 §10), run as is on a
// scratch database next to hrm_test: the older migrations first, then
// legacy rows, then the new migration. Rows must survive the renames.
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { PrismaClient } from "@/generated/prisma/client"
import { mariadbConfig } from "@/lib/db-config"
import { DEFAULT_SERVICE_TYPES } from "@/lib/domain/service-types"
import { prisma } from "@/lib/server/db"

const enabled = !!process.env.TEST_DATABASE_URL
const SCRATCH = "hrm_migration_test"
const NEW = "_companies_subscriptions"

const dir = path.join(process.cwd(), "prisma", "migrations")
const migrations = readdirSync(dir)
  .filter((d) => /^\d{14}_/.test(d))
  .sort()

/** A migration's statements, comments dropped, in order. */
function statements(name: string): string[] {
  return readFileSync(path.join(dir, name, "migration.sql"), "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
}

describe.skipIf(!enabled)("companies_subscriptions migration (docs/14 §10)", () => {
  let db: PrismaClient

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${SCRATCH}\``)
    await prisma.$executeRawUnsafe(
      `CREATE DATABASE \`${SCRATCH}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    const url = new URL(process.env.TEST_DATABASE_URL!)
    url.pathname = `/${SCRATCH}`
    db = new PrismaClient({ adapter: new PrismaMariaDb(mariadbConfig(url.toString())) })
    const run = async (name: string) => {
      // One connection per migration: some use session variables.
      await db.$transaction(async (tx) => {
        for (const sql of statements(name)) await tx.$executeRawUnsafe(sql)
      })
    }
    const before = migrations.filter((m) => !m.endsWith(NEW))
    for (const m of before) await run(m)

    // Legacy data, as production could still hold it.
    await db.$executeRawUnsafe(`
      INSERT INTO clients (id, name, company, email, currency, updated_at) VALUES
        (1, 'Dr Noor', 'Noor Dental Clinic', 'noor@client.pk', 'PKR', UTC_TIMESTAMP(3)),
        (2, 'Ali', NULL, 'ali@client.pk', 'PKR', UTC_TIMESTAMP(3)),
        (3, 'Sara', '   ', 'sara@client.pk', 'AED', UTC_TIMESTAMP(3))`)
    await db.$executeRawUnsafe(`
      INSERT INTO services (id, client_id, domain, start_date, renewal_date, charge_amount, currency, updated_at) VALUES
        (10, 1, 'noordental.pk', '2025-10-30', '2026-10-30', 6500, 'PKR', UTC_TIMESTAMP(3)),
        (11, 2, 'ali.pk', '2025-10-30', '2026-10-30', 5000, 'PKR', UTC_TIMESTAMP(3))`)
    await db.$executeRawUnsafe(`
      INSERT INTO payments (id, service_id, amount, paid_on, period_from, period_to)
        VALUES (5, 10, 6500, '2025-10-30', '2025-10-30', '2026-10-30')`)
    await db.$executeRawUnsafe(`
      INSERT INTO reminders (service_id, cycle_date, stage, channel, recipient, updated_at)
        VALUES (10, '2026-10-30', 7, 'email', 'client', UTC_TIMESTAMP(3))`)
    await db.$executeRawUnsafe(`
      INSERT INTO notifications (service_id, type, title, dedupe_key) VALUES (10, 'expiring', 'x', 'k1')`)
    await db.$executeRawUnsafe(`
      INSERT INTO invoices (number, client_id, service_id, period_start, period_end, issue_date, due_date,
        currency, subtotal, total, bill_to, seller, public_token, updated_at)
      VALUES ('INV-2026-0001', 1, 10, '2026-10-30', '2027-10-30', '2026-10-01', '2026-10-30', 'PKR',
        6500, 6500, '{"name":"Dr Noor","company":"Noor Dental Clinic"}', '{}', REPEAT('a', 64), UTC_TIMESTAMP(3))`)

    await run(migrations.find((m) => m.endsWith(NEW))!)
  }, 60_000)

  afterAll(async () => {
    await db?.$disconnect()
    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${SCRATCH}\``)
    await prisma.$disconnect()
  })

  it("seeds the Service Catalog defaults", async () => {
    const types = await db.serviceType.findMany({ orderBy: { position: "asc" } })
    expect(types.map((t) => t.name)).toEqual([...DEFAULT_SERVICE_TYPES])
    expect(types.every((t) => t.isActive && t.defaultPrice === null)).toBe(true)
  })

  it("keeps every service as a Web Hosting subscription, with its history", async () => {
    const subs = await db.subscription.findMany({
      orderBy: { id: "asc" },
      include: {
        serviceType: true,
        payments: true,
        reminders: true,
        notifications: true,
        invoices: true,
      },
    })
    expect(subs.map((s) => [s.id, s.domain, s.serviceType.name])).toEqual([
      [10, "noordental.pk", "Web Hosting"],
      [11, "ali.pk", "Web Hosting"],
    ])
    expect(subs[0]).toMatchObject({
      payments: [expect.objectContaining({ id: 5 })],
      reminders: [expect.objectContaining({ stage: 7 })],
      notifications: [expect.objectContaining({ dedupeKey: "k1" })],
      invoices: [expect.objectContaining({ number: "INV-2026-0001" })],
    })
  })

  it("turns the old company text into a company and moves its subscriptions under it", async () => {
    const companies = await db.company.findMany()
    expect(companies.map((c) => [c.clientId, c.name])).toEqual([
      [1, "Noor Dental Clinic"],
    ])
    const sub = await db.subscription.findUniqueOrThrow({ where: { id: 10 } })
    expect(sub.companyId).toBe(companies[0]!.id)
    expect(
      (await db.subscription.findUniqueOrThrow({ where: { id: 11 } })).companyId
    ).toBeNull()
    const cols = await db.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${SCRATCH}' AND TABLE_NAME = 'clients'`
    )
    expect(cols.map((c) => c.COLUMN_NAME)).not.toContain("company")
  })

  it("leaves no service_id column or services table behind", async () => {
    const left = await db.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
      `SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${SCRATCH}' AND COLUMN_NAME = 'service_id'`
    )
    expect(left).toEqual([])
    const tables = await db.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${SCRATCH}' AND TABLE_NAME = 'services'`
    )
    expect(tables).toEqual([])
  })
})
