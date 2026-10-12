import "server-only"

import { cache } from "react"

import { DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/domain/default-templates"
import type {
  BusinessSettings,
  EmailSettings,
  InvoiceSettings,
  Preferences,
  ReminderSettings,
} from "@/lib/domain/preferences"
import { parseStages } from "@/lib/domain/stages"
import {
  FALLBACK_CURRENCY,
  isCurrencyCode,
  normaliseCurrencyList,
  type CurrencyUse,
} from "@/lib/domain/currency"
import { formatPhone } from "@/lib/domain/whatsapp"
import { today as clockToday } from "@/lib/server/clock"
import { prisma, type Tx } from "@/lib/server/db"
import { SETTING_DEFAULTS, type SettingKey } from "@/lib/server/settings-keys"

export interface AppSettings {
  adminName: string
  businessName: string
  businessPhone: string
  /** Optional; "" when not set. */
  businessTagline: string
  adminEmail: string
  /** Normalised digits ("923001112233"), "" when not set. */
  adminWhatsapp: string
  /** ISO 4217 code; new clients start in it. */
  defaultCurrency: string
  /** Alphabetical; always includes the default. */
  enabledCurrencies: string[]
  thresholds: { orange: number; red: number }
  stages: number[]
  postExpiryToClient: boolean
  checkIntervalMinutes: number
  autoSendEmails: boolean
  autoSendBatchSize: number
  lastCheckAt: string | null
  smtp: {
    host: string
    port: number
    encryption: "SSL" | "TLS" | "None"
    username: string
    /** Encrypted; decrypt only in lib/server/mail.ts. */
    passwordEnc: string
    fromEmail: string
    fromName: string
  }
  invoices: {
    prefix: string
    leadDays: number
    address: string
    ntn: string
    logo: string
    bankName: string
    accountTitle: string
    accountNumber: string
    wallet: string
    footer: string
    taxEnabled: boolean
    /** Percent, e.g. "17.00"; "0" when tax is off. */
    taxRate: string
  }
}

const int = (v: string | null | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isInteger(n) ? n : fallback
}

async function readAll(db: Tx | typeof prisma = prisma) {
  const rows = await db.setting.findMany()
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return (key: SettingKey): string => map.get(key) ?? SETTING_DEFAULTS[key] ?? ""
}

/** Typed settings, read once per request (React cache). */
export const getAppSettings = cache(async (): Promise<AppSettings> => {
  const [get, admin] = await Promise.all([
    readAll(),
    prisma.admin.findFirst({ select: { username: true } }),
  ])
  const stored = get("default_currency").trim().toUpperCase()
  const defaultCurrency = isCurrencyCode(stored) ? stored : FALLBACK_CURRENCY
  const encryption = get("smtp_encryption")
  return {
    adminName: admin?.username ?? "Admin",
    businessName: get("business_name"),
    businessPhone: get("business_phone"),
    businessTagline: get("business_tagline").trim(),
    adminEmail: get("admin_email"),
    adminWhatsapp: get("admin_whatsapp"),
    defaultCurrency,
    enabledCurrencies: normaliseCurrencyList([
      ...get("enabled_currencies").split(","),
      defaultCurrency,
    ]),
    thresholds: {
      orange: int(get("threshold_orange_days"), 30),
      red: int(get("threshold_red_days"), 7),
    },
    stages: parseStages(get("reminder_stages")),
    postExpiryToClient: get("post_expiry_to_client") === "1",
    checkIntervalMinutes: int(get("check_interval_minutes"), 60),
    autoSendEmails: get("auto_send_emails") === "1",
    autoSendBatchSize: int(get("auto_send_batch_size"), 10),
    lastCheckAt: get("last_check_at") || null,
    smtp: {
      host: get("smtp_host"),
      port: int(get("smtp_port"), 465),
      encryption: encryption === "TLS" || encryption === "None" ? encryption : "SSL",
      username: get("smtp_username"),
      passwordEnc: get("smtp_password_enc"),
      fromEmail: get("mail_from_email"),
      fromName: get("mail_from_name"),
    },
    invoices: {
      prefix: /^[A-Z0-9]{1,10}$/.test(get("invoice_prefix")) ? get("invoice_prefix") : "INV",
      leadDays: Math.min(120, Math.max(1, int(get("invoice_lead_days"), 30))),
      address: get("business_address"),
      ntn: get("invoice_ntn"),
      logo: get("invoice_logo"),
      bankName: get("pay_bank_name"),
      accountTitle: get("pay_account_title"),
      accountNumber: get("pay_account_number"),
      wallet: get("pay_wallet"),
      footer: get("invoice_footer"),
      taxEnabled: get("tax_enabled") === "1",
      taxRate: /^\d{1,3}(\.\d{1,2})?$/.test(get("tax_rate")) ? get("tax_rate") : "0",
    },
  }
})

/** Upserts the given keys (inside a transaction when `db` is one). */
export async function updateSettings(
  values: Partial<Record<SettingKey, string | null>>,
  db: Tx | typeof prisma = prisma
) {
  for (const [key, value] of Object.entries(values)) {
    await db.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    })
  }
}

/** The Settings page model (Preferences), with the SMTP password never sent back. */
export async function getPreferences(): Promise<Preferences> {
  const [s, rows] = await Promise.all([
    getAppSettings(),
    prisma.messageTemplate.findMany(),
  ])
  const business: BusinessSettings = {
    businessName: s.businessName,
    businessPhone: s.businessPhone,
    tagline: s.businessTagline,
    adminEmail: s.adminEmail,
    adminWhatsapp: s.adminWhatsapp ? formatPhone(s.adminWhatsapp) : "",
    defaultCurrency: s.defaultCurrency,
    enabledCurrencies: s.enabledCurrencies,
  }
  const reminders: ReminderSettings = {
    orange: s.thresholds.orange,
    red: s.thresholds.red,
    stages: s.stages,
    postExpiry: s.postExpiryToClient,
    interval: s.checkIntervalMinutes,
    autoSend: s.autoSendEmails,
    batchSize: s.autoSendBatchSize,
  }
  const email: EmailSettings = {
    host: s.smtp.host,
    port: s.smtp.port,
    encryption: s.smtp.encryption,
    username: s.smtp.username,
    password: "",
    passwordSaved: s.smtp.passwordEnc !== "",
    fromEmail: s.smtp.fromEmail,
    fromName: s.smtp.fromName,
  }
  const year = Number(clockToday().slice(0, 4))
  const counter = await prisma.invoiceCounter.findUnique({ where: { year } })
  const invoices: InvoiceSettings = {
    prefix: s.invoices.prefix,
    nextNumber: counter?.next ?? 1,
    leadDays: s.invoices.leadDays,
    logo: s.invoices.logo,
    address: s.invoices.address,
    ntn: s.invoices.ntn,
    bankName: s.invoices.bankName,
    accountTitle: s.invoices.accountTitle,
    accountNumber: s.invoices.accountNumber,
    wallet: s.invoices.wallet,
    footer: s.invoices.footer,
    taxEnabled: s.invoices.taxEnabled,
    taxRate: s.invoices.taxRate,
  }
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const templates = Object.fromEntries(
    (Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]).map((k) => {
      const row = byKey.get(k)
      const def = DEFAULT_TEMPLATES[k]
      return [k, { subject: row?.subject ?? def.subject ?? "", body: row?.body ?? def.body }]
    })
  ) as Preferences["templates"]
  return { business, reminders, email, invoices, templates }
}

/**
 * How many clients and services use each currency. A currency in use can't
 * be turned off (docs/13 §6), so Settings and savePreferencesAction both read this.
 */
export async function getCurrencyUsage(
  db: Tx | typeof prisma = prisma
): Promise<Record<string, CurrencyUse>> {
  const [clients, services] = await Promise.all([
    db.client.groupBy({ by: ["currency"], _count: { _all: true } }),
    db.service.groupBy({ by: ["currency"], _count: { _all: true } }),
  ])
  const usage: Record<string, CurrencyUse> = {}
  for (const c of clients) usage[c.currency] = { clients: c._count._all, services: 0 }
  for (const s of services)
    usage[s.currency] = { clients: usage[s.currency]?.clients ?? 0, services: s._count._all }
  return usage
}

/** Current template text (DB, falling back to the defaults). */
export async function getTemplate(key: TemplateKey) {
  const row = await prisma.messageTemplate.findUnique({ where: { key } })
  const def = DEFAULT_TEMPLATES[key]
  return { subject: row?.subject ?? def.subject ?? "", body: row?.body ?? def.body }
}
