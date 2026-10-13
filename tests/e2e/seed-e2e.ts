// Run by the Playwright global setup with tsx (the generated Prisma client is
// ESM): wipes the e2e database and seeds settings, templates and an admin
// with a known TOTP secret (docs/10 §1b). Never point it at real data.
import { createCipheriv, randomBytes } from "node:crypto"

import { hash } from "@node-rs/argon2"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

import { PrismaClient } from "@/generated/prisma/client"
import { mariadbConfig } from "@/lib/db-config"
import { DEFAULT_TEMPLATES } from "@/lib/domain/default-templates"
import { SETTING_DEFAULTS } from "@/lib/server/settings-keys"

import { resetDb } from "../helpers/reset-db"
import { E2E } from "./e2e-config"

/** Same format as src/lib/server/crypto.ts (server-only, so not imported here). */
function encrypt(plain: string, appKey: string) {
  const key = Buffer.from(appKey.replace(/^base64:/, ""), "base64")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => p.toString("base64url")).join(".")
}

async function main() {
  const url = process.env.DATABASE_URL
  const appKey = process.env.APP_KEY
  if (!url || !appKey) throw new Error("DATABASE_URL and APP_KEY are required")
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(mariadbConfig(url)) })
  try {
    await resetDb(prisma, [
      "admins", "login_attempts", "clients", "settings", "message_templates", "audit_log",
      "invoice_counters", "rate_limits",
    ])
    const settings: Record<string, string | null> = {
      ...SETTING_DEFAULTS,
      business_name: "Rehman Web Services",
      business_phone: "+92 300 1112233",
      admin_email: "billing@rehmanweb.pk",
      admin_whatsapp: "923001112233",
      smtp_host: "127.0.0.1",
      smtp_port: String(E2E.smtpPort),
      smtp_encryption: "None",
      smtp_username: "billing@rehmanweb.pk",
      smtp_password_enc: encrypt("e2e-smtp-password", appKey),
      mail_from_email: "billing@rehmanweb.pk",
      mail_from_name: "Rehman Web Services",
      pay_bank_name: "Meezan Bank",
      pay_account_number: "PK36 MEZN 0001 2345 6789 0123",
    }
    for (const [key, value] of Object.entries(settings))
      await prisma.setting.create({ data: { key, value } })
    for (const [key, t] of Object.entries(DEFAULT_TEMPLATES))
      await prisma.messageTemplate.create({ data: { key, subject: t.subject ?? null, body: t.body } })
    await prisma.admin.create({
      data: {
        username: E2E.username,
        email: "billing@rehmanweb.pk",
        passwordHash: await hash(E2E.password),
        totpEnabled: true,
        totpSecretEnc: encrypt(E2E.totpSecret, appKey),
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
