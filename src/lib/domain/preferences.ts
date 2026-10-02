import { z } from "zod"
import { DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/domain/default-templates"
import { CURRENCIES } from "@/lib/domain/validation"
import { normalisePhone } from "@/lib/domain/whatsapp"

const phone = z
  .string()
  .refine((v) => normalisePhone(v) !== null, "Enter a valid phone number")
export const businessSchema = z.object({
  businessName: z.string().trim().min(2).max(150),
  businessPhone: phone,
  adminEmail: z.email(),
  adminWhatsapp: phone,
  defaultCurrency: z.enum(CURRENCIES),
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
export type BusinessSettings = z.infer<typeof businessSchema>
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>
export type EmailSettings = z.infer<typeof emailSettingsSchema>
export type TemplateSettings = z.infer<typeof templateSchema>
export interface Preferences {
  business: BusinessSettings
  reminders: ReminderSettings
  email: EmailSettings
  templates: Record<TemplateKey, TemplateSettings>
}
export type PreferenceSection = "business" | "reminders" | "email" | TemplateKey
export const INITIAL_PREFERENCES: Preferences = {
  business: {
    businessName: "Rehman Web Services",
    businessPhone: "0300 1112233",
    adminEmail: "billing@rehmanweb.pk",
    adminWhatsapp: "0300 1112233",
    defaultCurrency: "PKR",
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
  templates: Object.fromEntries(
    Object.entries(DEFAULT_TEMPLATES).map(([k, v]) => [
      k,
      { subject: v.subject ?? "", body: v.body },
    ])
  ) as Preferences["templates"],
}
