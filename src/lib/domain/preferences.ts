import { z } from "zod"
import { DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/domain/default-templates"
import { currencySchema, DEFAULT_ENABLED_CURRENCIES } from "@/lib/domain/currency"
import { normalisePhone } from "@/lib/domain/whatsapp"

const phone = z
  .string()
  .refine((v) => normalisePhone(v) !== null, "Enter a valid phone number")
export const businessSchema = z
  .object({
    businessName: z.string().trim().min(2).max(150),
    businessPhone: phone,
    adminEmail: z.email(),
    adminWhatsapp: phone,
    defaultCurrency: currencySchema,
    enabledCurrencies: z
      .array(currencySchema)
      .min(1, "Turn on at least one currency")
      .max(60, "Turn on at most 60 currencies")
      .refine((c) => new Set(c).size === c.length, "Currencies must be unique")
      // Stored alphabetically, whatever order they were added in.
      .transform((c) => [...c].sort()),
  })
  .refine((b) => b.enabledCurrencies.includes(b.defaultCurrency), {
    path: ["defaultCurrency"],
    message: "The default currency must be turned on",
  })
export const reminderSettingsSchema = z
  .object({
    orange: z.number().int().min(1).max(90),
    red: z.number().int().min(0).max(89),
    stages: z
      .array(z.number().int().min(-60).max(90))
      .min(1)
      .refine(
        (s) => s.some((n) => n >= 0),
        "Include at least one stage on or before expiry"
      )
      .refine((s) => new Set(s).size === s.length, "Stages must be unique"),
    postExpiry: z.boolean(),
    interval: z.number().int().min(5).max(1440),
    autoSend: z.boolean(),
    batchSize: z.number().int().min(1).max(100),
  })
  .refine((v) => v.orange > v.red, {
    path: ["orange"],
    message: "Orange limit must be greater than the red limit",
  })
export const emailSettingsSchema = z.object({
  host: z.string().trim().min(1).max(190),
  port: z.number().int().min(1).max(65535),
  encryption: z.enum(["SSL", "TLS", "None"]),
  username: z.string().trim().min(1).max(190),
  password: z.string().max(500),
  passwordSaved: z.boolean(),
  fromEmail: z.email(),
  fromName: z.string().trim().min(2).max(150),
})
export const templateSchema = z.object({
  subject: z.string().max(1000),
  body: z.string().min(1, "Enter a message body").max(20000),
})

/** PNG or JPEG only (SVG can carry scripts); about 200 KB at most. */
export const LOGO_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/
export const LOGO_MAX_CHARS = 280_000
const optional = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`)

// Settings → Invoices (docs/13 §11).
export const invoiceSettingsSchema = z
  .object({
    prefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,10}$/, "Use 1–10 letters or digits, like INV"),
    /** The next sequence number for this year. Read-only once invoices exist. */
    nextNumber: z.number().int().min(1).max(999_999),
    leadDays: z.number().int().min(1, "At least 1 day").max(120, "At most 120 days"),
    logo: z
      .string()
      .max(LOGO_MAX_CHARS, "Use a logo under 200 KB")
      .refine((v) => v === "" || LOGO_RE.test(v), "Upload a PNG or JPEG logo"),
    address: optional(300),
    ntn: optional(30),
    bankName: optional(100),
    accountTitle: optional(100),
    accountNumber: optional(100),
    wallet: optional(100),
    footer: optional(500),
    taxEnabled: z.boolean(),
    taxRate: z
      .string()
      .trim()
      .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a rate like 17 or 16.5"),
  })
  .refine((v) => Number(v.taxRate) <= 100, { path: ["taxRate"], message: "At most 100%" })

export type BusinessSettings = z.infer<typeof businessSchema>
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>
export type EmailSettings = z.infer<typeof emailSettingsSchema>
export type TemplateSettings = z.infer<typeof templateSchema>
export type InvoiceSettings = z.infer<typeof invoiceSettingsSchema>
export interface Preferences {
  business: BusinessSettings
  reminders: ReminderSettings
  email: EmailSettings
  invoices: InvoiceSettings
  templates: Record<TemplateKey, TemplateSettings>
}
export type PreferenceSection = "business" | "reminders" | "email" | "invoices" | TemplateKey
export const INITIAL_PREFERENCES: Preferences = {
  business: {
    businessName: "Rehman Web Services",
    businessPhone: "0300 1112233",
    adminEmail: "billing@rehmanweb.pk",
    adminWhatsapp: "0300 1112233",
    defaultCurrency: "PKR",
    enabledCurrencies: [...DEFAULT_ENABLED_CURRENCIES].sort(),
  },
  reminders: {
    orange: 30,
    red: 7,
    stages: [30, 15, 7, 3, 1, 0, -3, -6, -9],
    postExpiry: false,
    interval: 60,
    autoSend: false,
    batchSize: 10,
  },
  email: {
    host: "smtp.hostinger.com",
    port: 465,
    encryption: "SSL",
    username: "billing@rehmanweb.pk",
    password: "",
    passwordSaved: true,
    fromEmail: "billing@rehmanweb.pk",
    fromName: "Rehman Web Services",
  },
  invoices: {
    prefix: "INV",
    nextNumber: 1,
    leadDays: 30,
    logo: "",
    address: "",
    ntn: "",
    bankName: "",
    accountTitle: "",
    accountNumber: "",
    wallet: "",
    footer: "Please pay before the due date to avoid service interruption.",
    taxEnabled: false,
    taxRate: "0",
  },
  templates: Object.fromEntries(
    Object.entries(DEFAULT_TEMPLATES).map(([k, v]) => [
      k,
      { subject: v.subject ?? "", body: v.body },
    ])
  ) as Preferences["templates"],
}
