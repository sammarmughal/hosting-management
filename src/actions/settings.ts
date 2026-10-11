"use server"

import { cookies } from "next/headers"
import { z } from "zod"

import { currencyInUseError } from "@/lib/domain/currency"
import { DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/domain/default-templates"
import {
  businessSchema,
  emailSettingsSchema,
  invoiceSettingsSchema,
  reminderSettingsSchema,
  templateSchema,
  type PreferenceSection,
} from "@/lib/domain/preferences"
import { normalisePhone } from "@/lib/domain/whatsapp"
import { refreshApp } from "@/lib/server/action-utils"
import { audit } from "@/lib/server/audit"
import {
  hashPassword,
  hashRecoveryCodes,
  newRecoveryCodes,
  passwordProblem,
  verifyPassword,
  verifyTotp,
} from "@/lib/server/auth"
import { today } from "@/lib/server/clock"
import { encrypt } from "@/lib/server/crypto"
import { prisma } from "@/lib/server/db"
import { MailError, sendMail } from "@/lib/server/mail"
import { getAppSettings, getCurrencyUsage, updateSettings } from "@/lib/server/settings"
import {
  clientIp,
  cookieName,
  PASSWORD_STAGE_TTL,
  requireAdmin,
} from "@/lib/server/session"
import { failureDelay } from "@/lib/server/throttle"
import type { ActionResult } from "@/types/actions"

const TEMPLATE_KEYS = Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]
const sectionSchema = z.enum(["business", "reminders", "email", "invoices", ...TEMPLATE_KEYS])

/** Saves one Settings section (docs/07 §2 actions/settings.ts). */
export async function savePreferencesAction(
  section: PreferenceSection,
  input: unknown
): Promise<ActionResult> {
  await requireAdmin()
  const which = sectionSchema.safeParse(section)
  if (!which.success) return { ok: false, error: "Unknown settings section." }
  const first = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form fields."

  switch (which.data) {
    case "business": {
      const p = businessSchema.safeParse(input)
      if (!p.success) return { ok: false, error: first(p.error) }
      // A currency used by any client or service stays on (docs/13 §6).
      const inUse = currencyInUseError(p.data.enabledCurrencies, await getCurrencyUsage())
      if (inUse) return { ok: false, error: inUse }
      await updateSettings({
        business_name: p.data.businessName,
        business_phone: p.data.businessPhone,
        admin_email: p.data.adminEmail.toLowerCase(),
        admin_whatsapp: normalisePhone(p.data.adminWhatsapp) ?? "",
        default_currency: p.data.defaultCurrency,
        enabled_currencies: p.data.enabledCurrencies.join(","),
      })
      break
    }
    case "reminders": {
      const p = reminderSettingsSchema.safeParse(input)
      if (!p.success) return { ok: false, error: first(p.error) }
      await updateSettings({
        threshold_orange_days: String(p.data.orange),
        threshold_red_days: String(p.data.red),
        reminder_stages: [...p.data.stages].sort((a, b) => b - a).join(","),
        post_expiry_to_client: p.data.postExpiry ? "1" : "0",
        check_interval_minutes: String(p.data.interval),
        auto_send_emails: p.data.autoSend ? "1" : "0",
        auto_send_batch_size: String(p.data.batchSize),
      })
      break
    }
    case "email": {
      const p = emailSettingsSchema.safeParse(input)
      if (!p.success) return { ok: false, error: first(p.error) }
      await updateSettings({
        smtp_host: p.data.host,
        smtp_port: String(p.data.port),
        smtp_encryption: p.data.encryption,
        smtp_username: p.data.username,
        mail_from_email: p.data.fromEmail.toLowerCase(),
        mail_from_name: p.data.fromName,
        // Empty = keep the saved password (docs/05 §10). Encrypted at rest.
        ...(p.data.password ? { smtp_password_enc: encrypt(p.data.password) } : {}),
      })
      break
    }
    case "invoices": {
      const p = invoiceSettingsSchema.safeParse(input)
      if (!p.success) return { ok: false, error: first(p.error) }
      const v = p.data
      await prisma.$transaction(async (tx) => {
        await updateSettings(
          {
            invoice_prefix: v.prefix,
            invoice_lead_days: String(v.leadDays),
            invoice_logo: v.logo,
            business_address: v.address,
            invoice_ntn: v.ntn,
            pay_bank_name: v.bankName,
            pay_account_title: v.accountTitle,
            pay_account_number: v.accountNumber,
            pay_wallet: v.wallet,
            invoice_footer: v.footer,
            tax_enabled: v.taxEnabled ? "1" : "0",
            tax_rate: v.taxEnabled ? v.taxRate : "0",
          },
          tx
        )
        // The next number can only be set before the first invoice (docs/13 §11).
        if ((await tx.invoice.count()) === 0) {
          const year = Number(today().slice(0, 4))
          await tx.invoiceCounter.upsert({
            where: { year },
            create: { year, next: v.nextNumber },
            update: { next: v.nextNumber },
          })
        }
      })
      break
    }
    default: {
      const p = templateSchema.safeParse(input)
      if (!p.success) return { ok: false, error: first(p.error) }
      const key = which.data
      const hasSubject = DEFAULT_TEMPLATES[key].subject !== undefined
      if (hasSubject && p.data.subject.length > 190)
        return { ok: false, error: "Keep the subject under 190 characters." }
      const data = { subject: hasSubject ? p.data.subject : null, body: p.data.body }
      await prisma.messageTemplate.upsert({
        where: { key },
        create: { key, ...data },
        update: data,
      })
    }
  }
  await audit("settings.update", { details: { section: which.data }, ip: await clientIp() })
  refreshApp()
  return { ok: true }
}

/** Settings → Email → "Send test email" to the admin, with the saved SMTP settings. */
export async function sendTestEmailAction(): Promise<ActionResult> {
  await requireAdmin()
  const s = await getAppSettings()
  if (!s.adminEmail) return { ok: false, error: "Add your admin email in Business first." }
  try {
    await sendMail(s, {
      to: s.adminEmail,
      subject: `Test email from ${s.businessName || "Renewals"}`,
      html: "<p>Your email settings work. Reminder emails will be sent from this address.</p>",
      text: "Your email settings work. Reminder emails will be sent from this address.",
    })
  } catch (err) {
    return { ok: false, error: err instanceof MailError ? err.message : "Email failed" }
  }
  return { ok: true }
}

const securityInput = z.object({
  current: z.string().max(200).optional(),
  next: z.string().max(200).optional(),
  confirm: z.string().max(200).optional(),
  code: z.string().max(20).optional(),
})

/** Settings → Security: password change, recovery codes, 2FA reset, log out everywhere. */
export async function securityAction(
  kind: "password" | "recovery" | "reset" | "sessions",
  input: { current?: string; next?: string; confirm?: string; code?: string }
): Promise<ActionResult<{ codes?: string[] }>> {
  const { admin, session } = await requireAdmin()
  const k = z.enum(["password", "recovery", "reset", "sessions"]).safeParse(kind)
  const p = securityInput.safeParse(input)
  if (!k.success || !p.success) return { ok: false, error: "Invalid request." }
  const ip = await clientIp()
  const fail = async (error: string) => {
    await failureDelay()
    return { ok: false as const, error }
  }

  if (k.data === "sessions") {
    await prisma.session.deleteMany({ where: { adminId: admin.id } })
    ;(await cookies()).delete(cookieName())
    await audit("sessions.revoked", { ip })
    return { ok: true, data: {} }
  }

  if (!(await verifyPassword(admin.passwordHash, p.data.current ?? "")))
    return fail("Current password is incorrect.")

  if (k.data === "password" || k.data === "reset") {
    const totp =
      admin.totpSecretEnc &&
      (await verifyTotp(admin.totpSecretEnc, (p.data.code ?? "").trim(), admin.totpLastStep))
    if (!totp || !totp.ok) return fail("Invalid verification code.")
    await prisma.admin.update({ where: { id: admin.id }, data: { totpLastStep: totp.step } })
  }

  if (k.data === "password") {
    const next = p.data.next ?? ""
    const problem = passwordProblem(next)
    if (problem) return fail(problem)
    if (next !== p.data.confirm) return fail("Passwords do not match.")
    await prisma.$transaction([
      prisma.admin.update({
        where: { id: admin.id },
        data: { passwordHash: await hashPassword(next) },
      }),
      // Other devices must sign in again; this one stays signed in.
      prisma.session.deleteMany({ where: { adminId: admin.id, id: { not: session.id } } }),
    ])
    await audit("password.changed", { ip })
    return { ok: true, data: {} }
  }

  if (k.data === "recovery") {
    const codes = newRecoveryCodes()
    await prisma.admin.update({
      where: { id: admin.id },
      data: { recoveryCodes: await hashRecoveryCodes(codes) },
    })
    await audit("2fa.recovery_regenerated", { ip })
    return { ok: true, data: { codes } }
  }

  // reset: turn 2FA off; this session drops back to the password stage so
  // /2fa/setup can run straight away. Other sessions end.
  await prisma.$transaction([
    prisma.admin.update({
      where: { id: admin.id },
      data: { totpEnabled: false, totpSecretEnc: null, totpLastStep: null, recoveryCodes: [] },
    }),
    prisma.session.deleteMany({ where: { adminId: admin.id, id: { not: session.id } } }),
    prisma.session.update({
      where: { id: session.id },
      data: {
        stage: "password_ok",
        expiresAt: new Date(Date.now() + PASSWORD_STAGE_TTL),
        totpFailures: 0,
      },
    }),
  ])
  await audit("2fa.reset", { ip })
  return { ok: true, data: {} }
}
