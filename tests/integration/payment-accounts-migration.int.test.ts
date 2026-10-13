// The data migration that turned the single set of bank details into one
// payment account marked Default (prisma/migrations/*_payment_accounts),
// run as is against the hrm_test database.
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { parsePaymentAccounts } from "@/lib/domain/payment-accounts"
import { prisma } from "@/lib/server/db"

import { FAKE_IBAN } from "../helpers/payment-fixtures"
import { resetDb } from "../helpers/reset-db"

const enabled = !!process.env.TEST_DATABASE_URL

/** The migration's statements, comments dropped, in order. */
function migrationStatements(): string[] {
  const dir = path.join(process.cwd(), "prisma", "migrations")
  const name = readdirSync(dir).find((d) => d.endsWith("_payment_accounts"))
  if (!name) throw new Error("payment_accounts migration not found")
  return readFileSync(path.join(dir, name, "migration.sql"), "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Runs the migration on one connection (it uses session variables). */
async function migrate() {
  await prisma.$transaction(async (tx) => {
    for (const sql of migrationStatements()) await tx.$executeRawUnsafe(sql)
  })
}

const setting = async (key: string) =>
  (await prisma.setting.findUnique({ where: { key } }))?.value ?? null

async function legacy(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values))
    await prisma.setting.create({ data: { key, value } })
}

describe.skipIf(!enabled)("payment accounts migration (docs/13 §11)", () => {
  beforeEach(() => resetDb(prisma, ["settings"]))
  afterAll(() => prisma.$disconnect())

  it("moves the bank details into one Default account; an IBAN-like number becomes the IBAN", async () => {
    await legacy({
      pay_bank_name: "Example Bank Pakistan",
      pay_account_title: "Rehman Web Services",
      pay_account_number: "pk11 test 0000 0012 3456 7890",
      pay_wallet: "0300 0000000",
    })
    await migrate()
    const accounts = parsePaymentAccounts(await setting("payment_accounts"))
    expect(accounts).toEqual([
      {
        id: "default",
        label: "Main account",
        bankName: "Example Bank Pakistan",
        accountTitle: "Rehman Web Services",
        accountNumber: "",
        iban: FAKE_IBAN.PK,
        swift: "",
        branchCode: "",
        currencies: [],
        isDefault: true,
      },
    ])
    // The stored JSON has a real boolean, not 1.
    expect(JSON.parse((await setting("payment_accounts"))!)[0].isDefault).toBe(true)
    // Old keys gone; the wallet stays.
    for (const key of ["pay_bank_name", "pay_account_title", "pay_account_number"])
      expect(await setting(key)).toBeNull()
    expect(await setting("pay_wallet")).toBe("0300 0000000")
  })

  it("keeps a plain account number as the account number, and escapes quotes", async () => {
    await legacy({
      pay_bank_name: 'Example "Quoted" Bank',
      pay_account_number: "0000-1234567890",
    })
    await migrate()
    const [a] = parsePaymentAccounts(await setting("payment_accounts"))
    expect(a).toMatchObject({
      bankName: 'Example "Quoted" Bank',
      accountTitle: "",
      accountNumber: "0000-1234567890",
      iban: "",
      isDefault: true,
    })
  })

  it("adds nothing when no bank details were set, and never overwrites existing accounts", async () => {
    await legacy({ pay_bank_name: "", pay_account_title: "", pay_account_number: "" })
    await migrate()
    expect(await setting("payment_accounts")).toBeNull()
    expect(await setting("pay_bank_name")).toBeNull()

    await legacy({ payment_accounts: "[]", pay_bank_name: "Example Bank" })
    await migrate()
    expect(await setting("payment_accounts")).toBe("[]")
  })
})
